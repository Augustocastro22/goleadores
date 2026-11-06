import type { SupabaseClient } from "@supabase/supabase-js";
import { desafiosConGolesDeMas, type DesafioVista } from "@/lib/desafios";

/**
 * Partidos de desafío del grupo con goles de jugadores de más (ver
 * desafiosConGolesDeMas): el otro grupo corrigió el resultado y los goles
 * cargados ya no cierran. Se avisa al admin (en Partidos y al cargar uno
 * nuevo) para que no se pierda la corrección, sin frenar nada más.
 */
export async function golesPorCorregir(
  supabase: SupabaseClient,
  grupoId: string
): Promise<{ partidoId: string; rival: string }[]> {
  const { data } = await supabase.rpc("get_desafios", { p_grupo_id: grupoId });
  const conResultado = ((data ?? []) as DesafioVista[]).filter((d) => d.partido_id && d.marcador_mios !== null);
  if (conResultado.length === 0) return [];

  const { data: pj } = await supabase
    .from("partido_jugadores")
    .select("partido_id, goles")
    .in(
      "partido_id",
      conResultado.map((d) => d.partido_id!)
    )
    .eq("equipo", 1);
  const goles = new Map<string, number>();
  for (const row of pj ?? []) goles.set(row.partido_id, (goles.get(row.partido_id) ?? 0) + row.goles);

  return desafiosConGolesDeMas(conResultado, goles).map((d) => ({ partidoId: d.partido_id!, rival: d.rival_nombre }));
}

/** El aviso para el admin cuando hay goles de un desafío por corregir. */
export function avisoGolesPorCorregir(pendientes: { rival: string }[]): string {
  return `Corregí los goles del partido contra ${pendientes[0].rival}: suman más que el resultado del desafío.`;
}
