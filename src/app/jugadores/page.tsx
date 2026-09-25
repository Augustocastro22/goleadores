import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, RankingRow } from "@/lib/types";
import JugadoresTabs from "./JugadoresTabs";

export default async function JugadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
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

  return (
    <JugadoresTabs
      jugadores={jugadoresRes.data ?? []}
      goleadores={(goleadoresRes.data ?? []) as RankingRow[]}
      mvpRows={(mvpRes.data ?? []) as RankingRow[]}
      peorRows={(peorRes.data ?? []) as RankingRow[]}
      tabInicial={tab === "formacion" ? "formacion" : "plantel"}
    />
  );
}
