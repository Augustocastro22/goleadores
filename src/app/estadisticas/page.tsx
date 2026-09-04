import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RankingRow } from "@/lib/types";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import { IconGoal, IconThumbsDown, IconTrophy } from "@/components/icons";
import { ComponentType, SVGProps } from "react";

export default async function EstadisticasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [goleadores, mvp, peor] = await Promise.all([
    supabase.rpc("get_goleadores"),
    supabase.rpc("get_ranking_votos", { p_tipo: "MVP" }),
    supabase.rpc("get_ranking_votos", { p_tipo: "PEOR" }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-white">Estadísticas</h1>
      <RankingList
        titulo="Goleadores"
        icon={IconGoal}
        iconClassName="bg-primary-500/15 text-primary-400"
        rows={(goleadores.data ?? []) as RankingRow[]}
        valueKey="goles"
        valueLabel="Goles"
      />
      <RankingList
        titulo="Mejor Jugador (MVP)"
        icon={IconTrophy}
        iconClassName="bg-gold-500/15 text-gold-400"
        rows={(mvp.data ?? []) as RankingRow[]}
        valueKey="veces_elegido"
        valueLabel="Veces"
        onlyLideres
      />
      <RankingList
        titulo="Peor Jugador"
        icon={IconThumbsDown}
        iconClassName="bg-danger-500/15 text-danger-400"
        rows={(peor.data ?? []) as RankingRow[]}
        valueKey="veces_elegido"
        valueLabel="Veces"
        onlyLideres
      />
    </div>
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
  onlyLideres = false,
}: {
  titulo: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName: string;
  rows: RankingRow[];
  valueKey: "goles" | "veces_elegido";
  valueLabel: string;
  onlyLideres?: boolean;
}) {
  let ordenadas = [...rows]
    .filter((r) => (r[valueKey] ?? 0) > 0)
    .sort((a, b) => (b[valueKey] ?? 0) - (a[valueKey] ?? 0));

  if (onlyLideres && ordenadas.length > 0) {
    const max = ordenadas[0][valueKey] ?? 0;
    ordenadas = ordenadas.filter((r) => (r[valueKey] ?? 0) === max);
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-white">{titulo}</h2>
          {onlyLideres && ordenadas.length > 0 && (
            <p className="text-xs text-zinc-500">
              {ordenadas.length > 1 ? "Líderes empatados" : "Líder actual"}
            </p>
          )}
        </div>
      </div>
      {ordenadas.length === 0 ? (
        <Card className="px-5 py-8 text-center text-sm text-zinc-500">Todavía no hay datos.</Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden py-1">
          {ordenadas.map((row, i) => (
            <div key={row.jugador_id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  onlyLideres ? rankBadge[0] : (rankBadge[i] ?? "text-zinc-600")
                }`}
              >
                {onlyLideres ? 1 : i + 1}
              </span>
              <Avatar src={row.foto_url} alt={row.apodo} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  {row.nombre} {row.apellido}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {row.apodo} · {row.partidos_jugados ?? 0}{" "}
                  {row.partidos_jugados === 1 ? "partido" : "partidos"}
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
