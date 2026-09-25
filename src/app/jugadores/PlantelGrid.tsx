import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import type { Profile, RankingRow } from "@/lib/types";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { IconGoal, IconThumbsDown, IconTrophy } from "@/components/icons";

export default function PlantelGrid({
  jugadores,
  goleadores,
  mvpRows,
  peorRows,
}: {
  jugadores: Profile[];
  goleadores: RankingRow[];
  mvpRows: RankingRow[];
  peorRows: RankingRow[];
}) {
  const goles = new Map(goleadores.map((r) => [r.jugador_id, r.goles ?? 0]));
  const partidosJugados = new Map(goleadores.map((r) => [r.jugador_id, r.partidos_jugados ?? 0]));
  const vecesMvp = new Map(mvpRows.map((r) => [r.jugador_id, r.veces_elegido ?? 0]));
  const vecesPeor = new Map(peorRows.map((r) => [r.jugador_id, r.veces_elegido ?? 0]));

  if (jugadores.length === 0) {
    return (
      <Card className="px-5 py-10 text-center text-sm text-zinc-500">
        Todavía no hay jugadores registrados.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {jugadores.map((j) => (
        <Link key={j.id} href={`/jugadores/${j.id}`} className="block">
          <Card className="flex min-w-0 flex-col items-center gap-3 p-5 text-center transition hover:border-border-strong hover:bg-surface-2/80">
            <Avatar src={j.foto_url} alt={j.apodo} size={72} />
            <div className="w-full min-w-0">
              <p className="truncate font-semibold text-white">
                {j.nombre} {j.apellido}
              </p>
              <p className="truncate text-sm text-zinc-500">{j.apodo}</p>
            </div>
            <Badge variant={j.rol === "admin" ? "gold" : "neutral"}>
              {j.rol === "admin" ? "Admin" : "Jugador"}
            </Badge>
            <div className="mt-1 grid w-full grid-cols-3 divide-x divide-border border-t border-border pt-3">
              <Stat icon={IconGoal} value={goles.get(j.id) ?? 0} label="Goles" />
              <Stat icon={IconTrophy} value={vecesMvp.get(j.id) ?? 0} label="MVP" />
              <Stat icon={IconThumbsDown} value={vecesPeor.get(j.id) ?? 0} label="Peor" />
            </div>
            <p className="text-[11px] text-zinc-600">
              {partidosJugados.get(j.id) ?? 0}{" "}
              {(partidosJugados.get(j.id) ?? 0) === 1 ? "partido jugado" : "partidos jugados"}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <Icon className="h-4 w-4 text-zinc-500" />
      <span className="text-sm font-bold tabular-nums text-white">{value}</span>
      <span className="text-[10px] text-zinc-600">{label}</span>
    </div>
  );
}
