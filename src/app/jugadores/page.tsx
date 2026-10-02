import { getMiembros, requireGrupo } from "@/lib/grupo";
import type { RankingRow } from "@/lib/types";
import { getConfig } from "@/lib/config";
import JugadoresTabs from "./JugadoresTabs";

export default async function JugadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const { supabase, grupo } = await requireGrupo();

  const [jugadores, goleadoresRes, mvpRes, peorRes, config] = await Promise.all([
    getMiembros(supabase, grupo.id),
    supabase.rpc("get_goleadores", { p_grupo_id: grupo.id }),
    supabase.rpc("get_ranking_votos", { p_grupo_id: grupo.id, p_tipo: "MVP" }),
    supabase.rpc("get_ranking_votos", { p_grupo_id: grupo.id, p_tipo: "PEOR" }),
    getConfig(supabase, grupo.id),
  ]);

  return (
    <JugadoresTabs
      jugadores={jugadores}
      goleadores={(goleadoresRes.data ?? []) as RankingRow[]}
      mvpRows={(mvpRes.data ?? []) as RankingRow[]}
      peorRows={(peorRes.data ?? []) as RankingRow[]}
      votaMvp={config.vota_mvp}
      votaPeor={config.vota_peor}
      tabInicial={tab === "formacion" ? "formacion" : "plantel"}
    />
  );
}
