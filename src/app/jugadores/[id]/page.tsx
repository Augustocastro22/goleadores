import Link from "next/link";
import { notFound } from "next/navigation";
import { ComponentType, SVGProps } from "react";
import { requireGrupo } from "@/lib/grupo";
import { getConfig, nombresDelPartido } from "@/lib/config";
import type { Profile, RankingRow, Rol } from "@/lib/types";
import { calcularResultado, RESULTADO_CLASS, RESULTADO_PLURAL, type Resultado } from "@/lib/resultado";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { IconChevronRight, IconGoal, IconThumbsDown, IconTrophy, IconUsers } from "@/components/icons";
import { leerFiltroPartidos, type FiltroPartidos } from "@/lib/tipos-partido";

interface PartidoJugadoRow {
  partido_id: string;
  goles: number;
  equipo: 1 | 2;
  partidos: {
    fecha: string;
    rival: string;
    lugar: string;
    goles_rival: number;
    goles_otros: number;
    con_votacion: boolean;
    con_mvp: boolean;
    con_peor: boolean;
    votacion_cierra_en: string | null;
    desafio_id: string | null;
    nombre_equipo: string | null;
  };
}

/** Clases completas (Tailwind no ve clases armadas con template strings). */
const COLS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

interface Logro {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  titulo: string;
  detalle: string;
}

export default async function JugadorDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { id } = await params;
  const { supabase, grupo } = await requireGrupo();

  // Las estadísticas que se muestran son las del grupo activo.
  const [{ data: membresia }, config] = await Promise.all([
    supabase
      .from("grupo_miembros")
      .select("rol, profiles(*)")
      .eq("grupo_id", grupo.id)
      .eq("jugador_id", id)
      .maybeSingle(),
    getConfig(supabase, grupo.id),
  ]);
  const jugador = (membresia?.profiles ?? null) as unknown as Profile | null;
  if (!membresia || !jugador) notFound();
  const rol = membresia.rol as Rol;
  const { vota_mvp: votaMvp, vota_peor: votaPeor } = config;

  const [goleadoresRes, mvpRes, peorRes, misPartidosRes, todosPartidosRes] = await Promise.all([
    supabase.rpc("get_goleadores", { p_grupo_id: grupo.id }),
    supabase.rpc("get_ranking_votos", { p_grupo_id: grupo.id, p_tipo: "MVP" }),
    supabase.rpc("get_ranking_votos", { p_grupo_id: grupo.id, p_tipo: "PEOR" }),
    supabase
      .from("partido_jugadores")
      .select("partido_id, goles, equipo, partidos!inner(fecha, rival, lugar, goles_rival, goles_otros, jugado, grupo_id, con_votacion, con_mvp, con_peor, votacion_cierra_en, desafio_id, nombre_equipo)")
      .eq("jugador_id", id)
      .eq("partidos.jugado", true)
      .eq("partidos.grupo_id", grupo.id),
    supabase
      .from("partidos")
      .select("id, fecha")
      .eq("grupo_id", grupo.id)
      .eq("jugado", true)
      .order("fecha", { ascending: true }),
  ]);

  const goleadores = (goleadoresRes.data ?? []) as RankingRow[];
  const mvpRows = (mvpRes.data ?? []) as RankingRow[];
  const peorRows = (peorRes.data ?? []) as RankingRow[];

  const misStats = goleadores.find((r) => r.jugador_id === id);
  // Totales de todos los partidos: los logros se miden con esto; lo que se muestra arriba puede filtrarse (más abajo).
  const golesTotales = misStats?.goles ?? 0;
  const partidosTotales = misStats?.partidos_jugados ?? 0;
  const vecesMvp = mvpRows.find((r) => r.jugador_id === id)?.veces_elegido ?? 0;
  const vecesPeor = peorRows.find((r) => r.jugador_id === id)?.veces_elegido ?? 0;

  const misPartidos = (misPartidosRes.data ?? []) as unknown as PartidoJugadoRow[];
  misPartidos.sort((a, b) => b.partidos.fecha.localeCompare(a.partidos.fecha));

  const resultadosPorPartido = new Map<string, Resultado>();
  // Los partidos que jugaron entre ellos (alguien del grupo en el segundo equipo).
  const internos = new Set<string>();
  if (misPartidos.length > 0) {
    const { data: pj } = await supabase
      .from("partido_jugadores")
      .select("partido_id, goles, equipo")
      .in(
        "partido_id",
        misPartidos.map((mp) => mp.partido_id)
      );

    const acumulado = new Map<string, { e1: number; e2: number }>();
    for (const row of pj ?? []) {
      const acc = acumulado.get(row.partido_id) ?? { e1: 0, e2: 0 };
      if (row.equipo === 1) acc.e1 += row.goles;
      else {
        acc.e2 += row.goles;
        internos.add(row.partido_id);
      }
      acumulado.set(row.partido_id, acc);
    }
    for (const mp of misPartidos) if (mp.partidos.desafio_id) internos.delete(mp.partido_id);

    for (const mp of misPartidos) {
      const acc = acumulado.get(mp.partido_id) ?? { e1: 0, e2: 0 };
      const g1 = acc.e1 + mp.partidos.goles_otros;
      const g2 = acc.e2 + mp.partidos.goles_rival;
      // Desde el lado del jugador: en un partido interno puede estar en el Equipo 2.
      const resultado = mp.equipo === 2 ? calcularResultado(g2, g1) : calcularResultado(g1, g2);
      resultadosPorPartido.set(mp.partido_id, resultado);
    }
  }
  // Si jugó de los dos tipos (contra otros equipos y entre ellos), se puede ver cada uno por separado.
  const hayDosTipos = internos.size > 0 && internos.size < misPartidos.length;
  const filtro: FiltroPartidos = hayDosTipos ? leerFiltroPartidos((await searchParams).tipo) : "todos";
  const visibles = misPartidos.filter(
    (mp) => filtro === "todos" || (filtro === "entre_nosotros") === internos.has(mp.partido_id)
  );
  const goles = filtro === "todos" ? golesTotales : visibles.reduce((total, mp) => total + mp.goles, 0);
  const partidosJugados = filtro === "todos" ? partidosTotales : visibles.length;
  const conteo: Record<Resultado, number> = { G: 0, E: 0, P: 0 };
  for (const mp of visibles) {
    const resultado = resultadosPorPartido.get(mp.partido_id);
    if (resultado) conteo[resultado] += 1;
  }

  // Racha goleadora: partidos consecutivos (propios) convirtiendo al menos un gol.
  let rachaGolActual = 0;
  let rachaGolMax = 0;
  for (const mp of [...misPartidos].reverse()) {
    if (mp.goles > 0) {
      rachaGolActual += 1;
      rachaGolMax = Math.max(rachaGolMax, rachaGolActual);
    } else {
      rachaGolActual = 0;
    }
  }

  // Racha de presencia: partidos consecutivos del grupo (en orden) sin faltar.
  const misPartidosIds = new Set(misPartidos.map((mp) => mp.partido_id));
  let rachaPresenciaActual = 0;
  let rachaPresenciaMax = 0;
  for (const p of todosPartidosRes.data ?? []) {
    if (misPartidosIds.has(p.id)) {
      rachaPresenciaActual += 1;
      rachaPresenciaMax = Math.max(rachaPresenciaMax, rachaPresenciaActual);
    } else {
      rachaPresenciaActual = 0;
    }
  }
  const totalPartidosGrupo = (todosPartidosRes.data ?? []).length;
  const presenciaPerfecta = totalPartidosGrupo > 0 && partidosTotales === totalPartidosGrupo;

  // MVP: el nivel más alto de veces elegido Mejor Jugador (no hace falta que sean seguidas).
  const nivelMvp = votaMvp ? ([10, 5].find((n) => vecesMvp >= n) ?? 0) : 0;

  // Hat-trick: partidos con 3 o más goles propios.
  const hatTricks = misPartidos.filter((mp) => mp.goles >= 3).length;
  const maxGolesEnUnPartido = Math.max(0, ...misPartidos.map((mp) => mp.goles));

  // Veterano: el nivel más alto de partidos jugados que alcanzó.
  const nivelVeterano = [100, 50, 25].find((n) => partidosTotales >= n) ?? 0;

  // Goleador del grupo: tiene la mayor cantidad de goles (empatado cuenta).
  const maxGolesGrupo = Math.max(0, ...goleadores.map((r) => r.goles ?? 0));
  const esGoleadorDelGrupo = golesTotales > 0 && golesTotales === maxGolesGrupo;

  const logrosCandidatos: (Logro | null)[] = [
    esGoleadorDelGrupo
      ? { icon: IconGoal, titulo: "Goleador del grupo", detalle: `Máximo goleador del grupo, con ${golesTotales} goles.` }
      : null,
    hatTricks > 0
      ? {
          icon: IconGoal,
          titulo: "Hat-trick",
          detalle:
            hatTricks === 1
              ? `Metió ${maxGolesEnUnPartido} goles en un partido.`
              : `${hatTricks} partidos con 3 goles o más (récord: ${maxGolesEnUnPartido}).`,
        }
      : null,
    nivelVeterano > 0
      ? { icon: IconUsers, titulo: "Veterano", detalle: `Jugó ${nivelVeterano} partidos o más con el grupo.` }
      : null,
    votaPeor && partidosTotales > 0 && vecesPeor === 0
      ? { icon: IconThumbsDown, titulo: "Nunca la remó", detalle: "Nunca fue elegido Peor Jugador." }
      : null,
    rachaGolMax >= 3
      ? {
          icon: IconGoal,
          titulo: "Mejor racha goleadora",
          detalle: `${rachaGolMax} partidos seguidos convirtiendo gol.`,
        }
      : null,
    presenciaPerfecta
      ? {
          icon: IconUsers,
          titulo: "Presencia perfecta",
          detalle: `Jugó los ${totalPartidosGrupo} partidos del grupo.`,
        }
      : rachaPresenciaMax >= 5
        ? {
            icon: IconUsers,
            titulo: "Siempre presente",
            detalle: `${rachaPresenciaMax} partidos seguidos sin faltar.`,
          }
        : null,
    nivelMvp > 0
      ? {
          icon: IconTrophy,
          titulo: nivelMvp >= 10 ? "Crack del grupo" : "Figura",
          detalle: `Elegido Mejor Jugador ${nivelMvp} veces o más.`,
        }
      : null,
  ];
  const logros = logrosCandidatos.filter((l): l is Logro => l !== null);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/jugadores"
        className="inline-flex w-fit items-center gap-1 text-sm text-zinc-500 hover:text-white"
      >
        <IconChevronRight className="h-4 w-4 rotate-180" /> Jugadores
      </Link>

      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <Avatar src={jugador.foto_url} alt={jugador.apodo} size={96} />
        <div>
          <p className="text-lg font-bold text-white">
            {jugador.nombre} {jugador.apellido}
          </p>
          <p className="text-sm text-zinc-500">{jugador.apodo}</p>
        </div>
        <Badge variant={rol === "admin" ? "gold" : "neutral"}>
          {rol === "admin" ? "Admin" : "Jugador"}
        </Badge>
        {hayDosTipos && <FiltroTipo jugadorId={id} actual={filtro} />}
        <div
          className={`mt-2 grid w-full divide-x divide-border border-t border-border pt-4 ${
            COLS[2 + Number(votaMvp) + Number(votaPeor)]
          }`}
        >
          <StatCol value={goles} label="Goles" />
          <StatCol value={partidosJugados} label="Partidos" />
          {votaMvp && <StatCol value={vecesMvp} label="MVP" />}
          {votaPeor && <StatCol value={vecesPeor} label="Peor" />}
        </div>
        {filtro !== "todos" && (votaMvp || votaPeor) && (
          <p className="text-[11px] text-zinc-600">MVP y Peor cuentan todos los partidos.</p>
        )}
        {misPartidos.length > 0 && (
          <div className="flex items-center justify-center gap-4">
            {(["G", "E", "P"] as const).map((r) => (
              <span key={r} className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${RESULTADO_CLASS[r]}`}
                >
                  {conteo[r]}
                </span>
                {RESULTADO_PLURAL[r]}
              </span>
            ))}
          </div>
        )}
      </Card>

      {logros.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">Logros</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {logros.map((logro) => (
              <Card key={logro.titulo} className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-500/15 text-gold-400">
                  <logro.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{logro.titulo}</p>
                  <p className="truncate text-xs text-zinc-500">{logro.detalle}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold text-white">Historial de partidos</h2>
        {visibles.length === 0 ? (
          <Card className="px-5 py-8 text-center text-sm text-zinc-500">
            Todavía no jugó ningún partido.
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden py-1">
            {visibles.map((mp) => {
              const fecha = new Date(mp.partidos.fecha + "T00:00:00");
              const resultado = resultadosPorPartido.get(mp.partido_id);
              // Entre ellos: "Blancos vs Negros" y en cuál jugó (si no, "vs Negros" confundía al que jugó en Negros).
              const interno = internos.has(mp.partido_id);
              const { nosotros } = nombresDelPartido(mp.partidos, interno, config);
              return (
                <Link
                  key={mp.partido_id}
                  href={`/partidos/${mp.partido_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {interno ? `${nosotros} vs ${mp.partidos.rival}` : `vs ${mp.partidos.rival}`}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {interno && <span className="text-zinc-300">Jugó en {mp.equipo === 1 ? nosotros : mp.partidos.rival} · </span>}
                      {fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} ·{" "}
                      {mp.partidos.lugar}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-bold tabular-nums text-white">
                      {mp.goles} {mp.goles === 1 ? "gol" : "goles"}
                    </span>
                    {resultado && (
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${RESULTADO_CLASS[resultado]}`}
                      >
                        {resultado}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}

const FILTROS: { valor: FiltroPartidos; texto: string }[] = [
  { valor: "todos", texto: "Todos" },
  { valor: "rivales", texto: "Contra rivales" },
  { valor: "entre_nosotros", texto: "Entre nosotros" },
];

/** Qué partidos cuentan las estadísticas de arriba: solo aparece si jugó de los dos tipos. */
function FiltroTipo({ jugadorId, actual }: { jugadorId: string; actual: FiltroPartidos }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {FILTROS.map((f) => (
        <Link
          key={f.valor}
          href={f.valor === "todos" ? `/jugadores/${jugadorId}` : `/jugadores/${jugadorId}?tipo=${f.valor}`}
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

function StatCol({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <span className="text-lg font-bold tabular-nums text-white">{value}</span>
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}
