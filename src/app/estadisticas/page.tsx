import Link from "next/link";
import { requireGrupo } from "@/lib/grupo";
import { getConfig, grupoVota } from "@/lib/config";
import { votacionCerrada } from "@/lib/votacion";
import type { DesempatePartido, EstadoVotacion, RankingRow } from "@/lib/types";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import { IconGoal, IconThumbsDown, IconTrophy } from "@/components/icons";
import { ComponentType, SVGProps } from "react";
import GrupoLogo from "@/components/ui/GrupoLogo";
import { BotonCompartir, type Imagen } from "@/components/Compartir";
import { OPCION_COLOR, OPCION_DISENO, OPCION_NOMBRES } from "@/lib/compartir/opciones";
import { jugoDeLosDosTipos, leerFiltroPartidos, type FiltroPartidos } from "@/lib/tipos-partido";
import { historialDesafios, type DesafioVista, type HistorialRival } from "@/lib/desafios";
import { RESULTADO_CLASS, RESULTADO_PLURAL } from "@/lib/resultado";
import PilaSobres, { SoloSiAbierto, type SobrePila } from "@/components/PilaSobres";
import type { GanadorSobre } from "@/components/SobreResultado";

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ goles?: string }>;
}) {
  const { supabase, grupo } = await requireGrupo();
  // La tabla de goleadores: de todos los partidos, solo contra otros equipos o solo entre ellos.
  const filtro = leerFiltroPartidos((await searchParams).goles);
  // Cada ranking de votos se muestra solo si el grupo vota esa categoría (los
  // votos de cuando sí votaba quedan guardados y vuelven si se reactiva).
  const [config, goleadores, mvp, peor, partidosRes, desafiosRes, dosTipos] = await Promise.all([
    getConfig(supabase, grupo.id),
    filtro === "todos"
      ? supabase.rpc("get_goleadores", { p_grupo_id: grupo.id })
      : supabase.rpc("get_goleadores", { p_grupo_id: grupo.id, p_filtro: filtro }),
    supabase.rpc("get_ranking_votos", { p_grupo_id: grupo.id, p_tipo: "MVP" }),
    supabase.rpc("get_ranking_votos", { p_grupo_id: grupo.id, p_tipo: "PEOR" }),
    supabase
      .from("partidos")
      .select("id, fecha, con_mvp, con_peor, votacion_cierra_en")
      .eq("grupo_id", grupo.id)
      .eq("jugado", true)
      .eq("con_votacion", true)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.rpc("get_desafios", { p_grupo_id: grupo.id }),
    jugoDeLosDosTipos(supabase, grupo.id),
  ]);
  const historial = historialDesafios((desafiosRes.data ?? []) as DesafioVista[]);
  const votacionActiva = grupoVota(config);

  // Estado de la votación de los últimos partidos, todos a la vez (no uno
  // por uno), para quedarse con el más reciente que ya cerró.
  const recientes = votacionActiva ? (partidosRes.data ?? []) : [];
  const cerrados = await Promise.all(
    recientes.map(async (partido) => {
      const { data: estado } = await supabase
        .rpc("get_estado_votacion", { p_partido_id: partido.id })
        .single<EstadoVotacion>();
      return votacionCerrada({
        cierraEn: partido.votacion_cierra_en,
        totalParticipantes: estado?.total_participantes ?? 0,
        votosMvp: estado?.votos_mvp ?? 0,
        votosPeor: estado?.votos_peor ?? 0,
        conMvp: partido.con_mvp,
        conPeor: partido.con_peor,
      });
    })
  );
  const ultimoPartidoCerradoId = recientes.find((_, i) => cerrados[i])?.id ?? null;

  let ultimoMvp: RankingRow[] = [];
  let ultimoPeor: RankingRow[] = [];
  let ultimoDesempates: DesempatePartido[] = [];
  // Todos los que recibieron votos en el último partido: son las caras que pasan por la ruleta del sobre.
  let desgloseMvp: RankingRow[] = [];
  let desglosePeor: RankingRow[] = [];
  if (ultimoPartidoCerradoId) {
    const [ultimoMvpRes, ultimoPeorRes, desempatesRes, desgloseMvpRes, desglosePeorRes] = await Promise.all([
      supabase.rpc("get_ganadores_votacion", {
        p_partido_id: ultimoPartidoCerradoId,
        p_tipo: "MVP",
      }),
      supabase.rpc("get_ganadores_votacion", {
        p_partido_id: ultimoPartidoCerradoId,
        p_tipo: "PEOR",
      }),
      supabase.rpc("get_desempates_partido", { p_partido_id: ultimoPartidoCerradoId }),
      supabase.rpc("get_desglose_votos", { p_partido_id: ultimoPartidoCerradoId, p_tipo: "MVP" }),
      supabase.rpc("get_desglose_votos", { p_partido_id: ultimoPartidoCerradoId, p_tipo: "PEOR" }),
    ]);
    desgloseMvp = (desgloseMvpRes.data ?? []) as RankingRow[];
    desglosePeor = (desglosePeorRes.data ?? []) as RankingRow[];
    ultimoDesempates = (desempatesRes.data ?? []) as DesempatePartido[];
    ultimoMvp = (ultimoMvpRes.data ?? []) as RankingRow[];
    ultimoPeor = (ultimoPeorRes.data ?? []) as RankingRow[];
  }

  // Los sobres del último partido (los mismos que en el partido: abrir uno acá o allá cuenta para los dos).
  const ultimoPartido = recientes.find((p) => p.id === ultimoPartidoCerradoId);
  const aCarta = (f: RankingRow): GanadorSobre => ({
    id: f.jugador_id,
    apodo: f.apodo,
    nombre: f.nombre,
    apellido: f.apellido,
    fotoUrl: f.foto_url,
    votos: f.votos,
  });
  const sobres: SobrePila[] = [];
  if (ultimoPartido) {
    // Con el desempate pendiente todavía no hay ganador a quien revelar.
    const sobreDe = (tipo: "MVP" | "PEOR", ganadores: RankingRow[], desglose: RankingRow[]): SobrePila | null =>
      ganadores.length === 0 || ultimoDesempates.some((d) => d.tipo === tipo && !d.resuelto)
        ? null
        : {
            id: `${ultimoPartido.id}-${tipo === "MVP" ? "mvp" : "peor"}`,
            titulo: tipo === "MVP" ? "Mejor Jugador" : "Peor Jugador",
            peor: tipo === "PEOR",
            ganadores: ganadores.map(aCarta),
            candidatos: (desglose.length > 0 ? desglose : ganadores).map(aCarta),
          };
    const mvpSobre = config.vota_mvp && ultimoPartido.con_mvp ? sobreDe("MVP", ultimoMvp, desgloseMvp) : null;
    const peorSobre = config.vota_peor && ultimoPartido.con_peor ? sobreDe("PEOR", ultimoPeor, desglosePeor) : null;
    if (mvpSobre) sobres.push(mvpSobre);
    if (peorSobre) sobres.push(peorSobre);
  }
  const sobreId = (tipo: "mvp" | "peor") =>
    sobres.find((s) => s.id.endsWith(`-${tipo}`))?.id;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-white">Estadísticas</h1>
      {sobres.length > 0 && <PilaSobres sobres={sobres} />}
      <RankingList
        titulo="Goleadores"
        icon={IconGoal}
        iconClassName="bg-primary-500/15 text-primary-400"
        rows={(goleadores.data ?? []) as RankingRow[]}
        valueKey="goles"
        compartir={{
          ruta: `/api/compartir?que=goleadores&grupo=${grupo.id}&filtro=${filtro}`,
          titulo: "Tabla de goleadores",
          archivo: "goleadores",
          opciones: [
            {
              param: "estilo",
              items: [
                { id: "podio", label: "Podio" },
                { id: "lista", label: "Lista" },
              ],
            },
            OPCION_NOMBRES,
            OPCION_COLOR,
            OPCION_DISENO,
          ],
        }}
        valueLabel="Goles"
        debajoDelTitulo={dosTipos ? <FiltroGoleadores actual={filtro} /> : undefined}
      />
      {config.vota_mvp && (
        <RankingList
          titulo="Mejor Jugador (MVP)"
          icon={IconTrophy}
          iconClassName="bg-gold-500/15 text-gold-400"
          rows={(mvp.data ?? []) as RankingRow[]}
          valueKey="veces_elegido"
          valueLabel="Veces"
          podio
          ultimoPartidoGanadores={ultimoMvp}
          ultimoPartidoSobreId={sobreId("mvp")}
          ultimoPartidoPendiente={ultimoDesempates.find((d) => d.tipo === "MVP" && !d.resuelto)}
        />
      )}
      {config.vota_peor && (
        <RankingList
          titulo="Peor Jugador"
          icon={IconThumbsDown}
          iconClassName="bg-danger-500/15 text-danger-400"
          rows={(peor.data ?? []) as RankingRow[]}
          valueKey="veces_elegido"
          valueLabel="Veces"
          podio
          ultimoPartidoGanadores={ultimoPeor}
          ultimoPartidoSobreId={sobreId("peor")}
          ultimoPartidoPendiente={ultimoDesempates.find((d) => d.tipo === "PEOR" && !d.resuelto)}
        />
      )}
      {historial.length > 0 && <HistorialDesafios filas={historial} />}
    </div>
  );
}

/** Contra cada grupo desafiado: G/E/P de los resultados verificados y los sin verificar. */
function HistorialDesafios({ filas }: { filas: HistorialRival[] }) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-bold text-white">Desafíos</h2>
      <p className="mb-3 text-xs text-zinc-500">
        Contra otros grupos. Los sin verificar (sin acuerdo en el resultado) no cuentan como ganados ni
        perdidos.
      </p>
      <Card className="divide-y divide-border overflow-hidden py-1">
        {filas.map((f) => (
          <div key={f.rivalNombre} className="flex items-center gap-3 px-4 py-3">
            <GrupoLogo src={f.rivalLogoUrl} nombre={f.rivalNombre} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">vs {f.rivalNombre}</p>
              {f.sinVerificar > 0 && <p className="text-xs text-zinc-500">{f.sinVerificar} sin verificar</p>}
            </div>
            <div className="flex shrink-0 gap-1.5">
              {(["G", "E", "P"] as const).map((r) => (
                <span
                  key={r}
                  className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${RESULTADO_CLASS[r]}`}
                  title={RESULTADO_PLURAL[r]}
                >
                  {r === "G" ? f.ganados : r === "E" ? f.empatados : f.perdidos}
                  {r}
                </span>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}

const rankBadge = [
  "bg-gold-500/20 text-gold-400",
  "bg-white/10 text-zinc-300",
  "bg-orange-500/15 text-orange-400",
];

function RankingList({
  titulo,
  icon: Icon,
  iconClassName,
  rows,
  valueKey,
  valueLabel,
  podio = false,
  ultimoPartidoGanadores,
  ultimoPartidoSobreId,
  ultimoPartidoPendiente,
  compartir,
  debajoDelTitulo,
}: {
  /** El sobre del último partido: la línea con el ganador aparece recién cuando se abrió. */
  ultimoPartidoSobreId?: string;
  /** Algo entre el título y la tabla (el filtro de partidos de Goleadores). */
  debajoDelTitulo?: React.ReactNode;
  /** La imagen para compartir esta tabla (ver src/components/Compartir.tsx). */
  compartir?: Imagen;
  titulo: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName: string;
  rows: RankingRow[];
  valueKey: "goles" | "veces_elegido";
  valueLabel: string;
  podio?: boolean;
  ultimoPartidoGanadores?: RankingRow[];
  /** Empate del último partido que todavía se está definiendo. */
  ultimoPartidoPendiente?: DesempatePartido;
}) {
  const ordenadas = [...rows]
    .filter((r) => (r[valueKey] ?? 0) > 0)
    .sort((a, b) => (b[valueKey] ?? 0) - (a[valueKey] ?? 0));

  // Los empatados comparten puesto (1, 1, 3…).
  let filas = ordenadas.map((row) => ({
    row,
    puesto: ordenadas.findIndex((r) => (r[valueKey] ?? 0) === (row[valueKey] ?? 0)) + 1,
  }));
  // Podio: los tres primeros puestos, con todos los empatados en cada uno.
  if (podio) filas = filas.filter((f) => f.puesto <= 3);

  return (
    <section>
      <div className="mb-1 flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-white">{titulo}</h2>
          {podio && filas.length > 0 && <p className="text-xs text-zinc-500">Podio</p>}
        </div>
        {compartir && filas.length > 0 && <BotonCompartir {...compartir} />}
      </div>
      {debajoDelTitulo}
      {ultimoPartidoPendiente ? (
        <p className="mb-3 pl-10 text-xs text-zinc-500">
          Último partido: empataron{" "}
          <span className="text-zinc-400">{ultimoPartidoPendiente.candidatos_apodos.join(" y ")}</span>, falta definir
        </p>
      ) : ultimoPartidoGanadores && ultimoPartidoGanadores.length > 0 && (
        (() => {
          const linea = (
            <p className="mb-3 pl-10 text-xs text-zinc-500">
              Último partido:{" "}
              <span className="text-zinc-400">
                {ultimoPartidoGanadores.map((g) => g.apodo).join(" y ")}
              </span>{" "}
              con {ultimoPartidoGanadores[0].votos}{" "}
              {ultimoPartidoGanadores[0].votos === 1 ? "voto" : "votos"}
            </p>
          );
          return ultimoPartidoSobreId ? <SoloSiAbierto id={ultimoPartidoSobreId}>{linea}</SoloSiAbierto> : linea;
        })()
      )}
      {filas.length === 0 ? (
        <Card className="px-5 py-8 text-center text-sm text-zinc-500">Todavía no hay datos.</Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden py-1">
          {filas.map(({ row, puesto }) => (
            <div key={row.jugador_id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  rankBadge[puesto - 1] ?? "text-zinc-600"
                }`}
              >
                {puesto}
              </span>
              <Avatar
                src={row.foto_url}
                alt={row.apodo}
                size={36}
                className={row.sigue_en_grupo === false ? "opacity-50 grayscale" : ""}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  {row.nombre} {row.apellido}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {row.apodo} · {row.partidos_jugados ?? 0}{" "}
                  {row.partidos_jugados === 1 ? "partido" : "partidos"}
                  {row.sigue_en_grupo === false && " · ya no está en el grupo"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-lg font-bold tabular-nums text-white">{row[valueKey]}</span>
                <span className="hidden text-xs text-zinc-600 sm:inline">{valueLabel}</span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}

const FILTROS: { valor: FiltroPartidos; texto: string }[] = [
  { valor: "todos", texto: "Todos" },
  { valor: "rivales", texto: "Contra rivales" },
  { valor: "entre_nosotros", texto: "Entre nosotros" },
];

/** De qué partidos son los goles: solo aparece si el grupo jugó de los dos tipos. */
function FiltroGoleadores({ actual }: { actual: FiltroPartidos }) {
  return (
    <div className="mt-2 mb-3 flex gap-1.5">
      {FILTROS.map((f) => (
        <Link
          key={f.valor}
          href={f.valor === "todos" ? "/estadisticas" : `/estadisticas?goles=${f.valor}`}
          scroll={false}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            actual === f.valor
              ? "border-primary-500/40 bg-primary-500/10 text-primary-400"
              : "border-border text-zinc-400 hover:text-white"
          }`}
        >
          {f.texto}
        </Link>
      ))}
    </div>
  );
}
