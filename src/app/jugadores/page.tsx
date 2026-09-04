import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, RankingRow } from "@/lib/types";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { IconGoal, IconThumbsDown, IconTrophy } from "@/components/icons";
import { ComponentType, SVGProps } from "react";

export default async function JugadoresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [jugadoresRes, goleadoresRes, mvpRes, peorRes] = await Promise.all([
    supabase.from("profiles").select("*").order("nombre").returns<Profile[]>(),
    supabase.rpc("get_goleadores"),
    supabase.rpc("get_ranking_votos", { p_tipo: "MVP" }),
    supabase.rpc("get_ranking_votos", { p_tipo: "PEOR" }),
  ]);

  const jugadores = jugadoresRes.data ?? [];
  const goles = new Map<string, number>();
  const partidosJugados = new Map<string, number>();
  const vecesMvp = new Map<string, number>();
  const vecesPeor = new Map<string, number>();

  for (const r of (goleadoresRes.data ?? []) as RankingRow[]) {
    goles.set(r.jugador_id, r.goles ?? 0);
    partidosJugados.set(r.jugador_id, r.partidos_jugados ?? 0);
  }
  for (const r of (mvpRes.data ?? []) as RankingRow[]) {
    vecesMvp.set(r.jugador_id, r.veces_elegido ?? 0);
  }
  for (const r of (peorRes.data ?? []) as RankingRow[]) {
    vecesPeor.set(r.jugador_id, r.veces_elegido ?? 0);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-white">Jugadores</h1>
      <p className="mb-6 text-sm text-zinc-500">El plantel completo del grupo.</p>

      {jugadores.length === 0 ? (
        <Card className="px-5 py-10 text-center text-sm text-zinc-500">
          Todavía no hay jugadores registrados.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {jugadores.map((j) => (
            <Card
              key={j.id}
              className="flex min-w-0 flex-col items-center gap-3 p-5 text-center"
            >
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
          ))}
        </div>
      )}
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
