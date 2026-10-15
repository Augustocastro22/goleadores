import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModoJuego } from "@/lib/config";

/**
 * Qué parece el grupo según los partidos que ya jugó, para sugerirlo en la
 * pregunta "¿Cómo juegan?": si en la mayoría hubo gente del grupo en los dos
 * equipos, juegan entre ellos. Sin partidos, no se sugiere nada.
 */
export async function sugerirModoJuego(supabase: SupabaseClient, grupoId: string): Promise<ModoJuego | null> {
  const { data: partidos } = await supabase
    .from("partidos")
    .select("id")
    .eq("grupo_id", grupoId)
    .eq("jugado", true)
    .is("desafio_id", null)
    .order("fecha", { ascending: false })
    .limit(30);
  const ids = (partidos ?? []).map((p) => p.id);
  if (ids.length === 0) return null;

  const { data: equipo2 } = await supabase
    .from("partido_jugadores")
    .select("partido_id")
    .in("partido_id", ids)
    .eq("equipo", 2);
  const internos = new Set((equipo2 ?? []).map((r) => r.partido_id)).size;
  return internos * 2 > ids.length ? "entre_nosotros" : "equipo";
}
