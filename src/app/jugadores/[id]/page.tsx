import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ComponentType, SVGProps } from "react";
import { createClient } from "@/lib/supabase/server";
import { votacionCerrada } from "@/lib/votacion";
import type { EstadoVotacion, Profile, RankingRow } from "@/lib/types";
import { calcularResultado, RESULTADO_CLASS, type Resultado } from "@/lib/resultado";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { IconChevronRight, IconGoal, IconThumbsDown, IconTrophy, IconUsers } from "@/components/icons";

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
  };
}

interface Logro {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  titulo: string;
  detalle: string;
}

export default async function JugadorDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jugador } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single<Profile>();
  if (!jugador) notFound();

  const [goleadoresRes, mvpRes, peorRes, misPartidosRes, todosPartidosRes] = await Promise.all([
    supabase.rpc("get_goleadores"),
    supabase.rpc("get_ranking_votos", { p_tipo: "MVP" }),
    supabase.rpc("get_ranking_votos", { p_tipo: "PEOR" }),
    supabase
      .from("partido_jugadores")
      .select("partido_id, goles, equipo, partidos!inner(fecha, rival, lugar, goles_rival, goles_otros, jugado)")
      .eq("jugador_id", id)
      .eq("partidos.jugado", true),
    supabase.from("partidos").select("id, fecha").eq("jugado", true).order("fecha", { ascending: true }),
  ]);

  const goleadores = (goleadoresRes.data ?? []) as RankingRow[];
  const mvpRows = (mvpRes.data ?? []) as RankingRow[];
  const peorRows = (peorRes.data ?? []) as RankingRow[];

  const misStats = goleadores.find((r) => r.jugador_id === id);
  const goles = misStats?.goles ?? 0;
  const partidosJugados = misStats?.partidos_jugados ?? 0;
  const vecesMvp = mvpRows.find((r) => r.jugador_id === id)?.veces_elegido ?? 0;
  const vecesPeor = peorRows.find((r) => r.jugador_id === id)?.veces_elegido ?? 0;

  const misPartidos = (misPartidosRes.data ?? []) as unknown as PartidoJugadoRow[];
  misPartidos.sort((a, b) => b.partidos.fecha.localeCompare(a.partidos.fecha));

  const resultadosPorPartido = new Map<string, Resultado>();
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
      else acc.e2 += row.goles;
      acumulado.set(row.partido_id, acc);
    }

    for (const mp of misPartidos) {
      const acc = acumulado.get(mp.partido_id) ?? { e1: 0, e2: 0 };
      const g1 = acc.e1 + mp.partidos.goles_otros;
      const g2 = acc.e2 + mp.partidos.goles_rival;
      resultadosPorPartido.set(mp.partido_id, calcularResultado(g1, g2));
    }
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
  const presenciaPerfecta = totalPartidosGrupo > 0 && partidosJugados === totalPartidosGrupo;

  // Racha de MVP: partidos consecutivos (propios, con votación cerrada) elegido Mejor Jugador.
  const misPartidosAsc = [...misPartidos].sort((a, b) => a.partidos.fecha.localeCompare(b.partidos.fecha));
  const fueMvpPorPartido = await Promise.all(
    misPartidosAsc.map(async (mp) => {
      const { data: estado } = await supabase
        .rpc("get_estado_votacion", { p_partido_id: mp.partido_id })
        .single<EstadoVotacion>();
      const cerrada = votacionCerrada({
        fechaPartido: mp.partidos.fecha,
        totalParticipantes: estado?.total_participantes ?? 0,
        votosMvp: estado?.votos_mvp ?? 0,
        votosPeor: estado?.votos_peor ?? 0,
      });
      if (!cerrada) return false;
      const { data: ganadores } = await supabase.rpc("get_ganadores_votacion", {
        p_partido_id: mp.partido_id,
        p_tipo: "MVP",
      });
      return ((ganadores ?? []) as RankingRow[]).some((g) => g.jugador_id === id);
    })
  );

  let rachaMvpActual = 0;
  let rachaMvpMax = 0;
  for (const fueMvp of fueMvpPorPartido) {
    if (fueMvp) {
      rachaMvpActual += 1;
      rachaMvpMax = Math.max(rachaMvpMax, rachaMvpActual);
    } else {
      rachaMvpActual = 0;
    }
  }

  const logrosCandidatos: (Logro | null)[] = [
    partidosJugados > 0 && vecesPeor === 0
      ? { icon: IconThumbsDown, titulo: "Nunca la remó", detalle: "Nunca fue elegido Peor Jugador." }
      : null,
    rachaGolMax >= 3
      ? {
          icon: IconGoal,
          titulo: "Racha goleadora",
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
    rachaMvpMax >= 3
      ? {
          icon: IconTrophy,
          titulo: "Racha de MVP",
          detalle: `${rachaMvpMax} partidos seguidos elegido Mejor Jugador.`,
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
        <Badge variant={jugador.rol === "admin" ? "gold" : "neutral"}>
          {jugador.rol === "admin" ? "Admin" : "Jugador"}
        </Badge>
        <div className="mt-2 grid w-full grid-cols-4 divide-x divide-border border-t border-border pt-4">
          <StatCol value={goles} label="Goles" />
          <StatCol value={partidosJugados} label="Partidos" />
          <StatCol value={vecesMvp} label="MVP" />
          <StatCol value={vecesPeor} label="Peor" />
        </div>
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
        {misPartidos.length === 0 ? (
          <Card className="px-5 py-8 text-center text-sm text-zinc-500">
            Todavía no jugó ningún partido.
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden py-1">
            {misPartidos.map((mp) => {
              const fecha = new Date(mp.partidos.fecha + "T00:00:00");
              const resultado = resultadosPorPartido.get(mp.partido_id);
              return (
                <Link
                  key={mp.partido_id}
                  href={`/partidos/${mp.partido_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">vs {mp.partidos.rival}</p>
                    <p className="truncate text-xs text-zinc-500">
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

function StatCol({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <span className="text-lg font-bold tabular-nums text-white">{value}</span>
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}
