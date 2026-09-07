import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ComponentType, SVGProps } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, RankingRow } from "@/lib/types";
import { calcularResultado, RESULTADO_CLASS, type Resultado } from "@/lib/resultado";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { IconChevronRight, IconGoal, IconThumbsDown, IconTrophy } from "@/components/icons";

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

  const [goleadoresRes, mvpRes, peorRes, misPartidosRes, totalPartidosRes] = await Promise.all([
    supabase.rpc("get_goleadores"),
    supabase.rpc("get_ranking_votos", { p_tipo: "MVP" }),
    supabase.rpc("get_ranking_votos", { p_tipo: "PEOR" }),
    supabase
      .from("partido_jugadores")
      .select("partido_id, goles, equipo, partidos(fecha, rival, lugar, goles_rival, goles_otros)")
      .eq("jugador_id", id),
    supabase.from("partidos").select("id", { count: "exact", head: true }),
  ]);

  const goleadores = (goleadoresRes.data ?? []) as RankingRow[];
  const mvpRows = (mvpRes.data ?? []) as RankingRow[];
  const peorRows = (peorRes.data ?? []) as RankingRow[];

  const misStats = goleadores.find((r) => r.jugador_id === id);
  const goles = misStats?.goles ?? 0;
  const partidosJugados = misStats?.partidos_jugados ?? 0;
  const vecesMvp = mvpRows.find((r) => r.jugador_id === id)?.veces_elegido ?? 0;
  const vecesPeor = peorRows.find((r) => r.jugador_id === id)?.veces_elegido ?? 0;

  const maxGoles = Math.max(0, ...goleadores.map((r) => r.goles ?? 0));
  const esMaximoGoleador = goles > 0 && goles === maxGoles;
  const totalPartidosGrupo = totalPartidosRes.count ?? 0;
  const presenciaPerfecta = totalPartidosGrupo > 0 && partidosJugados === totalPartidosGrupo;

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

  let rachaActual = 0;
  let rachaMax = 0;
  for (const mp of [...misPartidos].reverse()) {
    if (mp.goles > 0) {
      rachaActual += 1;
      rachaMax = Math.max(rachaMax, rachaActual);
    } else {
      rachaActual = 0;
    }
  }

  const logrosCandidatos: (Logro | null)[] = [
    esMaximoGoleador
      ? { icon: IconGoal, titulo: "Máximo goleador", detalle: `Lidera la tabla con ${goles} goles.` }
      : null,
    vecesMvp >= 2
      ? { icon: IconTrophy, titulo: "MVP recurrente", detalle: `Elegido Mejor Jugador ${vecesMvp} veces.` }
      : null,
    partidosJugados > 0 && vecesPeor === 0
      ? { icon: IconThumbsDown, titulo: "Nunca la remó", detalle: "Nunca fue elegido Peor Jugador." }
      : null,
    vecesPeor >= 2
      ? {
          icon: IconThumbsDown,
          titulo: "Peor jugador serial",
          detalle: `Elegido Peor Jugador ${vecesPeor} veces.`,
        }
      : null,
    rachaMax >= 3
      ? { icon: IconGoal, titulo: "En racha", detalle: `${rachaMax} partidos seguidos convirtiendo gol.` }
      : null,
    presenciaPerfecta
      ? {
          icon: IconTrophy,
          titulo: "Presencia perfecta",
          detalle: `Jugó los ${totalPartidosGrupo} partidos del grupo.`,
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
