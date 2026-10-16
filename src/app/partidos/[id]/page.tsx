import { notFound, redirect } from "next/navigation";
import { getContexto, getMiembros, rolEn } from "@/lib/grupo";
import { esPartidoInterno, getConfig, grupoVota as votaAlgo, nombresDelPartido } from "@/lib/config";
import Link from "next/link";
import { deletePartido } from "@/lib/actions/partidos";
import { urlConGrupo } from "@/lib/grupo-cookie";
import { votarDesempate, votarPartido } from "@/lib/actions/votos";
import { formatearCierreVotacion, votacionCerrada } from "@/lib/votacion";
import { cerrarDesempatesVencidos, cerrarVotacionSiCorresponde } from "@/lib/votaciones";
import { formatearMomento, partidoYaPaso, puedeCargarResultado, resultadoHabilitadoDesde } from "@/lib/confirmacion";
import type { Bloqueo, DesempatePartido, EstadoVotacion, Profile, RankingRow, Respuesta } from "@/lib/types";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { IconChevronRight } from "@/components/icons";
import type { DesafioVista } from "@/lib/desafios";
import { getCanchas, parecidas } from "@/lib/canchas";
import { unificarCanchas } from "@/lib/actions/admin";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import GolesEditor from "./GolesEditor";
import DesafioPanel, { type PropuestaResultado } from "./DesafioPanel";
import type { Ocupado } from "./ConvocadosEditor";
import ConvocadosEditor from "./ConvocadosEditor";
import VotoSelects, { type Candidato } from "./VotoSelects";
import { PendientesCard, RespuestaBadge, RespuestaCard, ResumenRespuestas } from "./Confirmacion";

interface ParticipanteRow {
  jugador_id: string;
  goles: number;
  equipo: 1 | 2;
  respuesta: Respuesta;
  profiles: Profile;
}

export default async function PartidoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getContexto();
  const { supabase, user } = ctx;
  if (!user) redirect("/login");

  const { data: partido } = await supabase
    .from("partidos")
    .select("*")
    .eq("id", id)
    .single();
  if (!partido) notFound();

  // El rol que cuenta es el del grupo del partido (puede no ser el grupo activo).
  const isAdmin = rolEn(ctx, partido.grupo_id) === "admin";
  const conMvp = partido.con_votacion && partido.con_mvp;
  const conPeor = partido.con_votacion && partido.con_peor;

  // Lo que no depende entre sí se pide todo junto.
  const [config, { data: participantesRaw }, { data: misVotos }, todosLosJugadores, { data: desafioRaw }, canchas] =
    await Promise.all([
      getConfig(supabase, partido.grupo_id),
      supabase
        .from("partido_jugadores")
        .select("jugador_id, goles, equipo, respuesta, profiles(*)")
        .eq("partido_id", id),
      supabase.from("votos").select("tipo, jugador_votado_id").eq("partido_id", id).eq("jugador_que_vota_id", user.id),
      isAdmin && !partido.jugado ? getMiembros(supabase, partido.grupo_id) : Promise.resolve([] as Profile[]),
      partido.desafio_id
        ? supabase.rpc("get_desafios", { p_grupo_id: partido.grupo_id, p_desafio_id: partido.desafio_id })
        : Promise.resolve({ data: [] }),
      // Para proponer otro lugar en un desafío.
      isAdmin && partido.desafio_id ? getCanchas(supabase, partido.grupo_id) : Promise.resolve([]),
    ]);
  const desafio = ((desafioRaw ?? []) as DesafioVista[])[0] ?? null;
  // En un desafío el lugar lo escribió el otro grupo: si quedó en una cancha
  // nueva parecida a una que el grupo ya tenía ("Gren Park"), se ofrece unificarlas.
  const canchaNueva = canchas.find((c) => c.id === partido.cancha_id && c.partidos === 1);
  const canchaExistente = canchaNueva && canchas.find((c) => c.id !== canchaNueva.id && parecidas(c.nombre, canchaNueva.nombre));
  const canchaParecida = canchaNueva && canchaExistente ? { nueva: canchaNueva, existente: canchaExistente } : null;
  const grupoVota = votaAlgo(config);
  const participantes = (participantesRaw ?? []) as unknown as ParticipanteRow[];
  const equipo1 = participantes.filter((p) => p.equipo === 1);
  const equipo2 = participantes.filter((p) => p.equipo === 2);
  // Entre ellos (dos equipos del grupo) o contra otro equipo, y cómo se llama cada lado.
  const interno = esPartidoInterno(equipo2.length, partido.desafio_id);
  const { nosotros } = nombresDelPartido(partido, interno, config);

  // Confirmación de los convocados (ver 0020_confirmacion.sql). Solo antes de
  // cargar el resultado: después quedan nada más los que jugaron. Si hay
  // respuestas cargadas se muestran siempre (aunque el grupo haya apagado la
  // opción); si no, solo si el grupo la pide y el partido todavía no pasó (uno
  // cargado después de jugarse no tuvo convocatoria).
  const conConfirmacion =
    !partido.jugado &&
    (participantes.some((p) => p.respuesta !== "juega") ||
      (config.pedir_confirmacion && !partidoYaPaso(partido.fecha, partido.hora)));
  const juegan = (lista: ParticipanteRow[]) =>
    conConfirmacion ? lista.filter((p) => p.respuesta === "juega") : lista;
  const miRespuesta = participantes.find((p) => p.jugador_id === user.id)?.respuesta;
  const pendientes = participantes.filter((p) => p.respuesta === "pendiente");
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(
    new Date()
  );

  const soyParticipante = participantes.some((p) => p.jugador_id === user.id);
  // Convocados que se fueron del grupo antes de que salir los sacara de los
  // partidos pendientes (0029_votacion_24h.sql): el admin los tiene que ver para sacarlos.
  const idsMiembros = new Set(todosLosJugadores.map((j) => j.id));
  const exMiembrosConvocados =
    isAdmin && !partido.jugado
      ? participantes.filter((p) => !idsMiembros.has(p.jugador_id)).map((p) => p.profiles)
      : [];
  const resultadoHabilitado = puedeCargarResultado(partido.fecha, partido.hora);
  // Todavía sin el editor de goles: arriba va la tarjeta del partido.
  const programado = !(partido.jugado || (isAdmin && resultadoHabilitado));

  let bloqueos: Bloqueo[] = [];
  let ocupados: Ocupado[] = [];
  if (isAdmin && !partido.jugado) {
    const [{ data: bloqueosData }, { data: ocupadosData }] = await Promise.all([
      supabase
        .from("bloqueos_disponibilidad")
        .select("*")
        .in(
          "jugador_id",
          todosLosJugadores.map((j) => j.id)
        )
        // Los generales y los de este grupo; no los que el jugador marcó para otro grupo.
        .or(`grupo_id.is.null,grupo_id.eq.${partido.grupo_id}`)
        .returns<Bloqueo[]>(),
      // Los que ese día ya están convocados en un partido de otro grupo.
      supabase.rpc("get_ocupados_otro_grupo", { p_grupo_id: partido.grupo_id, p_fecha: partido.fecha }),
    ]);
    bloqueos = bloqueosData ?? [];
    ocupados = (ocupadosData ?? []) as Ocupado[];
  }

  // Desafío: el ida y vuelta del resultado entre los dos grupos.
  let propuestas: PropuestaResultado[] = [];
  if (desafio && desafio.resultado_estado !== "sin_cargar") {
    const { data: propuestasData } = await supabase
      .from("desafio_resultados")
      .select("id, propuesto_por_grupo_id, goles_desafiante, goles_desafiado, estado, created_at")
      .eq("desafio_id", desafio.id)
      .order("created_at", { ascending: false });
    propuestas = (propuestasData ?? []).map((p) => ({
      id: p.id,
      mia: p.propuesto_por_grupo_id === partido.grupo_id,
      mios: desafio.soy_desafiante ? p.goles_desafiante : p.goles_desafiado,
      rival: desafio.soy_desafiante ? p.goles_desafiado : p.goles_desafiante,
      estado: p.estado,
      createdAt: p.created_at,
    }));
  }
  const golesDeJugadores = participantes.filter((p) => p.equipo === 1).reduce((t, p) => t + p.goles, 0);

  const votoMvpId = (misVotos ?? []).find((v) => v.tipo === "MVP")?.jugador_votado_id ?? null;
  const votoPeorId = (misVotos ?? []).find((v) => v.tipo === "PEOR")?.jugador_votado_id ?? null;
  const candidatos = participantes.filter((p) => p.jugador_id !== user.id);

  let cerrada = false;
  let desgloseMvp: RankingRow[] = [];
  let desglosePeor: RankingRow[] = [];
  let desempates: DesempatePartido[] = [];
  // Hasta cuándo se puede definir cada desempate abierto.
  let plazosDesempate = new Map<string, string>();
  if (partido.jugado && partido.con_votacion) {
    const { data: estadoVotacion } = await supabase
      .rpc("get_estado_votacion", { p_partido_id: id })
      .single<EstadoVotacion>();
    const totalParticipantes = estadoVotacion?.total_participantes ?? participantes.length;
    const votosMvp = estadoVotacion?.votos_mvp ?? 0;
    const votosPeor = estadoVotacion?.votos_peor ?? 0;
    cerrada = votacionCerrada({
      cierraEn: partido.votacion_cierra_en,
      totalParticipantes,
      votosMvp,
      votosPeor,
      conMvp,
      conPeor,
    });

    if (cerrada) {
      // Venció el plazo y todavía no se cerró (el cron corre una vez por
      // día): se cierra ahora, así el aviso y los desempates salen antes de
      // mostrar el resultado.
      if (!partido.votacion_cerrada_notificada) await cerrarVotacionSiCorresponde(id);
      // Lo mismo con un desempate cuyo plazo venció.
      plazosDesempate = await cerrarDesempatesVencidos(id);
      const [mvpRes, peorRes, desempatesRes] = await Promise.all([
        supabase.rpc("get_desglose_votos", { p_partido_id: id, p_tipo: "MVP" }),
        supabase.rpc("get_desglose_votos", { p_partido_id: id, p_tipo: "PEOR" }),
        // Todos ven si hay un empate por definir, no solo quienes lo definen.
        supabase.rpc("get_desempates_partido", { p_partido_id: id }),
      ]);
      desgloseMvp = (mvpRes.data ?? []) as RankingRow[];
      desglosePeor = (peorRes.data ?? []) as RankingRow[];
      desempates = (desempatesRes.data ?? []) as DesempatePartido[];
    }
  }

  const reglasHref = urlConGrupo("/admin?tab=config", partido.grupo_id);

  // "Martes, 22 de septiembre": solo la primera en mayúscula (capitalize de CSS haría "De Septiembre").
  const diaLargo = new Date(partido.fecha + "T00:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fecha =
    diaLargo.charAt(0).toUpperCase() + diaLargo.slice(1) + (partido.hora ? ` · ${partido.hora.slice(0, 5)}hs` : "");

  const toJugador = (p: ParticipanteRow) => ({
    jugadorId: p.jugador_id,
    nombre: p.profiles.nombre,
    apellido: p.profiles.apellido,
    apodo: p.profiles.apodo,
    fotoUrl: p.profiles.foto_url,
    goles: p.goles,
  });

  return (
    <div className="flex flex-col gap-8">
      {desafio && (
        <DesafioPanel
          desafio={desafio}
          grupoId={partido.grupo_id}
          isAdmin={isAdmin}
          hoy={hoy}
          propuestas={propuestas}
          golesDeJugadores={golesDeJugadores}
          partidoJugado={partido.jugado}
          canchas={canchas}
        />
      )}

      {canchaParecida && (
        <Card className="flex flex-col gap-3 p-4">
          <p className="text-sm text-zinc-300">
            Este partido quedó en <span className="font-semibold text-white">{canchaParecida.nueva.nombre}</span>,
            una cancha nueva para el grupo. ¿Es la misma que{" "}
            <span className="font-semibold text-white">{canchaParecida.existente.nombre}</span>?
          </p>
          <ActionForm action={unificarCanchas} grupoId={partido.grupo_id} className="flex flex-col gap-1">
            <input type="hidden" name="cancha_id" value={canchaParecida.nueva.id} />
            <input type="hidden" name="hacia_id" value={canchaParecida.existente.id} />
            <SubmitButton size="sm" pendingText="Unificando…" className="self-start">
              Sí, es la misma
            </SubmitButton>
          </ActionForm>
          <p className="text-xs text-zinc-500">Si es otra cancha, ignorá este aviso.</p>
        </Card>
      )}

      {programado && (
        <PartidoProgramadoCard
          rival={partido.rival}
          fecha={fecha}
          lugar={partido.lugar}
          respuestas={conConfirmacion ? participantes.map((p) => p.respuesta) : null}
          aviso={
            isAdmin
              ? `El resultado lo vas a poder cargar desde el ${formatearMomento(
                  resultadoHabilitadoDesde(partido.fecha, partido.hora)
                )}.`
              : undefined
          }
        />
      )}

      {/* Una vez que empezó el partido ya no se cambia: lo corrige el admin. */}
      {conConfirmacion && miRespuesta && !partidoYaPaso(partido.fecha, partido.hora) && (
        <RespuestaCard partidoId={id} respuesta={miRespuesta} />
      )}

      {isAdmin && !partido.jugado && (
        <ConvocadosEditor
          partidoId={id}
          jugadores={[...todosLosJugadores, ...exMiembrosConvocados]}
          exMiembroIds={exMiembrosConvocados.map((j) => j.id)}
          equipo1IdsInit={equipo1.map((p) => p.jugador_id)}
          equipo2IdsInit={equipo2.map((p) => p.jugador_id)}
          partidoFecha={partido.fecha}
          partidoHora={partido.hora}
          bloqueos={bloqueos}
          respuestas={
            conConfirmacion
              ? Object.fromEntries(participantes.map((p) => [p.jugador_id, p.respuesta]))
              : undefined
          }
          // Contra otro equipo se elige solo quién juega (en un grupo que todavía no eligió cómo
          // juega, como siempre: los dos equipos).
          unSoloEquipo={!!partido.desafio_id || (config.modo_juego !== null && !interno)}
          nombresEquipos={interno ? [nosotros, partido.rival] : undefined}
          cambioDeModo={
            !partido.desafio_id && config.modo_juego !== null
              ? {
                  interno,
                  rival: partido.rival,
                  nombres: interno ? [nosotros, partido.rival] : [config.nombre_equipo_1, config.nombre_equipo_2],
                }
              : undefined
          }
          ocupados={ocupados}
          rival={partido.rival}
          // El resumen ya está en la tarjeta del partido, justo arriba.
          mostrarResumen={!programado}
        />
      )}

      {/* El día del partido (o después) el admin define a los que no respondieron. */}
      {isAdmin && conConfirmacion && pendientes.length > 0 && partido.fecha <= hoy && (
        <PendientesCard
          partidoId={id}
          pendientes={pendientes.map((p) => ({
            jugadorId: p.jugador_id,
            apodo: p.profiles.apodo,
            fotoUrl: p.profiles.foto_url,
          }))}
        />
      )}

      {!programado ? (
        <GolesEditor
          partidoId={id}
          rival={partido.rival}
          fecha={fecha}
          lugar={partido.lugar}
          equipo1={juegan(equipo1).map(toJugador)}
          equipo2={juegan(equipo2).map(toJugador)}
          golesOtrosInit={partido.goles_otros}
          golesRivalInit={partido.goles_rival}
          isAdmin={isAdmin}
          jugado={partido.jugado}
          marcadorDesafio={
            desafio
              ? {
                  mios: desafio.marcador_mios,
                  rival: desafio.marcador_rival,
                  aConfirmar: desafio.resultado_estado === "en_discusion",
                }
              : undefined
          }
          votacion={isAdmin && !partido.jugado ? { config, reglasHref } : undefined}
          nosotros={nosotros}
          interno={interno}
        />
      ) : (
        !isAdmin && (
          <ConvocadosProgramados
            nosotros={nosotros}
            rival={partido.rival}
            equipo1={equipo1}
            equipo2={equipo2}
            conConfirmacion={conConfirmacion}
          />
        )
      )}

      {/* Un partido sin votación de un grupo que ya no vota no muestra nada de votación.
          El admin que no jugó ve cómo quedó, una vez cerrada (mientras está abierta no ve nada). */}
      {(soyParticipante || (isAdmin && partido.con_votacion && cerrada)) &&
        partido.jugado &&
        (partido.con_votacion || grupoVota) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-white">Votación</h2>
          {partido.con_votacion && !cerrada && partido.votacion_cierra_en && (
            <p className="-mt-1 text-sm text-zinc-400">
              Se puede votar hasta el {formatearCierreVotacion(partido.votacion_cierra_en)}.
            </p>
          )}
          {/* Una votación abierta ya no se toca: al admin se le muestra dónde apagarla para los próximos. */}
          {isAdmin && partido.con_votacion && !cerrada && (
            <p className="-mt-1 text-xs text-zinc-500">
              Para no votar en los próximos partidos, apagalo en{" "}
              <Link href={reglasHref} className="text-primary-400 hover:underline">
                las reglas del grupo
              </Link>
              .
            </p>
          )}
          {!partido.con_votacion ? (
            <Card className="px-4 py-3 text-sm text-zinc-500">
              {participantes.length < config.min_jugadores_votacion
                ? `Jugaron ${participantes.length}, menos que el mínimo para votar, así que este partido no tiene votación.`
                : "Este partido no tiene votación."}
            </Card>
          ) : cerrada ? (
            <div className="flex flex-col gap-3">
              {conMvp && (
                <ResultadoVotacion
                  label="Mejor Jugador"
                  filas={desgloseMvp}
                  desempate={desempates.find((d) => d.tipo === "MVP") ?? null}
                  plazos={plazosDesempate}
                />
              )}
              {conPeor && (
                <ResultadoVotacion
                  label="Peor Jugador"
                  peor
                  filas={desglosePeor}
                  desempate={desempates.find((d) => d.tipo === "PEOR") ?? null}
                  plazos={plazosDesempate}
                />
              )}
            </div>
          ) : (
            <VotacionForm
              partidoId={id}
              candidatos={candidatos.map((c) => ({
                id: c.jugador_id,
                nombre: `${c.profiles.nombre} ${c.profiles.apellido} (${c.profiles.apodo})`,
              }))}
              conMvp={conMvp}
              conPeor={conPeor}
              votoMvpId={votoMvpId}
              votoPeorId={votoPeorId}
            />
          )}
        </section>
      )}

      {/* Un partido de desafío no se borra: se cancela el desafío, desde su panel (arriba). */}
      {isAdmin && !partido.desafio_id && (
        <section>
          <ActionForm action={deletePartido} className="flex flex-col gap-2">
            <input type="hidden" name="partido_id" value={id} />
            <ConfirmSubmitButton
              confirmMessage="¿Seguro que querés borrar este partido? Se pierden los goles y los votos cargados."
              confirmLabel="Eliminar"
              className="w-full rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-2.5 text-sm font-semibold text-danger-400 transition hover:bg-danger-500/20"
            >
              Eliminar partido
            </ConfirmSubmitButton>
          </ActionForm>
        </section>
      )}
    </div>
  );
}

/** Arriba de todo en un partido que todavía no se jugó: cuándo, dónde, contra quién y cuántos van. */
function PartidoProgramadoCard({
  rival,
  fecha,
  lugar,
  respuestas,
  aviso,
}: {
  rival: string;
  fecha: string;
  lugar: string;
  /** Si el grupo pide confirmación, las respuestas de los convocados. */
  respuestas: Respuesta[] | null;
  /** Para el admin: desde cuándo puede cargar el resultado. */
  aviso?: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500">
        <span className="truncate">{fecha}</span>
        <span className="truncate">{lugar}</span>
      </div>
      <div className="mt-4 flex flex-col items-center gap-2">
        <Badge>Partido programado</Badge>
        <p className="text-lg font-bold text-white">vs {rival}</p>
        {respuestas && <ResumenRespuestas respuestas={respuestas} />}
        {aviso && <p className="mt-1 text-center text-xs text-zinc-500">{aviso}</p>}
      </div>
    </Card>
  );
}

/** Los convocados de un partido que todavía no se jugó, para quien no es admin (el admin usa ConvocadosEditor). */
function ConvocadosProgramados({
  nosotros,
  rival,
  equipo1,
  equipo2,
  conConfirmacion,
}: {
  /** "Nosotros", o el nombre del primer equipo cuando juegan entre ellos. */
  nosotros: string;
  rival: string;
  equipo1: ParticipanteRow[];
  equipo2: ParticipanteRow[];
  conConfirmacion: boolean;
}) {
  // Con confirmación, los que dijeron que no van aparte.
  const enEquipo = (lista: ParticipanteRow[]) =>
    conConfirmacion ? lista.filter((p) => p.respuesta !== "no_juega") : lista;
  const noJuegan = conConfirmacion ? [...equipo1, ...equipo2].filter((p) => p.respuesta === "no_juega") : [];

  return (
    <div className="flex flex-col gap-6">
      <ConvocadosList
        titulo={enEquipo(equipo2).length > 0 ? `Convocados · ${nosotros}` : "Convocados"}
        jugadores={enEquipo(equipo1)}
        conRespuesta={conConfirmacion}
      />
      {enEquipo(equipo2).length > 0 && (
        <ConvocadosList
          titulo={`Convocados · ${rival}`}
          jugadores={enEquipo(equipo2)}
          conRespuesta={conConfirmacion}
        />
      )}
      {noJuegan.length > 0 && <ConvocadosList titulo="No juegan" jugadores={noJuegan} />}
    </div>
  );
}

function ConvocadosList({
  titulo,
  jugadores,
  conRespuesta = false,
}: {
  titulo: string;
  jugadores: ParticipanteRow[];
  conRespuesta?: boolean;
}) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-white">{titulo}</h2>
      <Card className="divide-y divide-border overflow-hidden py-1">
        {jugadores.map((p) => (
          <div key={p.jugador_id} className="flex items-center gap-3 px-4 py-3">
            <Avatar src={p.profiles.foto_url} alt={p.profiles.apodo} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
              {p.profiles.nombre} {p.profiles.apellido}{" "}
              <span className="text-zinc-500">({p.profiles.apodo})</span>
            </span>
            {conRespuesta && <RespuestaBadge respuesta={p.respuesta} />}
          </div>
        ))}
      </Card>
    </div>
  );
}

/**
 * Cómo quedó una categoría. Si hubo empate por el primer puesto:
 * - mientras se define (desempate pendiente) no hay ganador, y se dice clarito;
 * - si se definió, gana solo el elegido;
 * - si no había cómo definirlo (o volvió a empatar), cuentan todos los empatados.
 */
function ResultadoVotacion({
  label,
  peor = false,
  filas,
  desempate,
  plazos,
}: {
  label: string;
  /** El ganador se marca en rojo en vez de verde. */
  peor?: boolean;
  filas: RankingRow[];
  desempate: DesempatePartido | null;
  /** Hasta cuándo se puede definir cada desempate abierto (cerrarDesempatesVencidos). */
  plazos: Map<string, string>;
}) {
  if (filas.length === 0) {
    return (
      <Card className="px-4 py-3 text-sm text-zinc-500">
        {label}: nadie votó a tiempo en este partido.
      </Card>
    );
  }

  const maxVotos = filas[0].votos ?? 0;
  const empatados = filas.filter((f) => (f.votos ?? 0) === maxVotos);
  const pendiente = desempate !== null && !desempate.resuelto;
  const ganadores = pendiente
    ? []
    : desempate?.ganador_id
      ? [desempate.ganador_id]
      : empatados.map((f) => f.jugador_id);
  const nombresEmpatados = (desempate?.candidatos_apodos ?? empatados.map((f) => f.apodo)).join(" y ");
  const apodoDe = (id: string) => filas.find((f) => f.jugador_id === id)?.apodo ?? "?";

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{label}</p>
        {pendiente && <Badge variant="gold">Empate · falta definir</Badge>}
      </div>
      {/* Todas las filas iguales (misma foto y alto); el ganador se marca solo con el fondo. */}
      <div className="-mx-2 flex flex-col gap-1">
        {filas.map((f) => {
          const esGanador = ganadores.includes(f.jugador_id);
          const enDisputa = pendiente && desempate.candidatos.includes(f.jugador_id);
          return (
            <div
              key={f.jugador_id}
              className={`flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm ${
                esGanador ? (peor ? "bg-danger-500/10" : "bg-primary-500/10") : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar src={f.foto_url} alt={f.apodo} size={32} />
                <span className={`truncate ${esGanador || enDisputa ? "font-semibold text-white" : "text-zinc-400"}`}>
                  {f.nombre} {f.apellido} <span className="text-zinc-500">({f.apodo})</span>
                </span>
              </span>
              <span
                className={`shrink-0 font-bold tabular-nums ${
                  esGanador ? (peor ? "text-danger-400" : "text-primary-400") : enDisputa ? "text-gold-400" : "text-zinc-500"
                }`}
              >
                {f.votos}
              </span>
            </div>
          );
        })}
      </div>

      {pendiente ? (
        desempate.puedo_definir ? (
          <DefinirDesempate desempate={desempate} plazo={plazos.get(desempate.id)} />
        ) : (
          <p className="border-t border-border pt-3 text-sm text-zinc-400">
            Empataron {nombresEmpatados}. Todavía <span className="font-semibold text-white">no hay ganador</span>:
            lo definen con un voto extra los que no votaron a ninguno de los empatados
            {plazos.get(desempate.id) ? `, hasta el ${formatearCierreVotacion(plazos.get(desempate.id)!)}` : ""}.
            Si sigue parejo, cuentan todos.
          </p>
        )
      ) : desempate?.ganador_id ? (
        <p className="border-t border-border pt-3 text-sm text-zinc-400">
          Empataron {nombresEmpatados}: se definió por desempate y ganó{" "}
          <span className="font-semibold text-white">{apodoDe(desempate.ganador_id)}</span>.
        </p>
      ) : (
        empatados.length > 1 && (
          <p className="border-t border-border pt-3 text-sm text-zinc-400">
            Empataron {nombresEmpatados} y no se pudo definir, así que cuentan{" "}
            {empatados.length === 2 ? "los dos" : "todos"}.
          </p>
        )
      )}
    </Card>
  );
}

function DefinirDesempate({ desempate, plazo }: { desempate: DesempatePartido; plazo?: string }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <p className="text-sm text-zinc-300">
        Empataron {desempate.candidatos_apodos.join(" y ")}. Como no votaste a ninguno, tu voto define quién gana
        {plazo ? ` (hasta el ${formatearCierreVotacion(plazo)})` : ""}.
      </p>
      <ActionForm action={votarDesempate} className="flex flex-col gap-2">
        <input type="hidden" name="desempate_id" value={desempate.id} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <select
              name="jugador_votado_id"
              required
              defaultValue=""
              className="w-full appearance-none rounded-xl border border-border bg-white/5 py-2.5 pr-9 pl-3.5 text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
            >
              <option value="" disabled className="bg-surface">
                Elegí un jugador...
              </option>
              {desempate.candidatos.map((cid, i) => (
                <option key={cid} value={cid} className="bg-surface">
                  {desempate.candidatos_apodos[i]}
                </option>
              ))}
            </select>
            <IconChevronRight className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 rotate-90 text-zinc-500" />
          </div>
          <SubmitButton pendingText="Enviando..." size="sm">
            Definir
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

function VotacionForm({
  partidoId,
  candidatos,
  conMvp,
  conPeor,
  votoMvpId,
  votoPeorId,
}: {
  partidoId: string;
  candidatos: Candidato[];
  conMvp: boolean;
  conPeor: boolean;
  votoMvpId: string | null;
  votoPeorId: string | null;
}) {
  if ((!conMvp || votoMvpId) && (!conPeor || votoPeorId)) {
    return (
      <Card className="px-4 py-3 text-sm text-zinc-500">Ya votaste en este partido.</Card>
    );
  }

  if (candidatos.length === 0) {
    return null;
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <ActionForm action={votarPartido} className="flex flex-col gap-4">
        <input type="hidden" name="partido_id" value={partidoId} />
        <VotoSelects
          candidatos={candidatos}
          conMvp={conMvp}
          conPeor={conPeor}
          votoMvpId={votoMvpId}
          votoPeorId={votoPeorId}
        />
        <SubmitButton pendingText="Votando..." size="sm" className="self-start">
          Votar
        </SubmitButton>
      </ActionForm>
    </Card>
  );
}
