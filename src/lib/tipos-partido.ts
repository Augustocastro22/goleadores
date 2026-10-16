import type { SupabaseClient } from "@supabase/supabase-js";

/** Qué partidos cuenta la tabla de goleadores (ver get_goleadores en 0032_modo_juego.sql). */
export type FiltroPartidos = "todos" | "rivales" | "entre_nosotros";

export function leerFiltroPartidos(valor: string | undefined | null): FiltroPartidos {
  return valor === "rivales" || valor === "entre_nosotros" ? valor : "todos";
}

/**
 * Si el grupo jugó de los dos tipos (contra otros equipos y entre ellos): solo
 * entonces tiene sentido ofrecer el filtro. Entre ellos = alguien del grupo
 * jugó en el segundo equipo y no es un desafío (como esPartidoInterno).
 */
export async function jugoDeLosDosTipos(supabase: SupabaseClient, grupoId: string): Promise<boolean> {
  const { data: partidos } = await supabase
    .from("partidos")
    .select("id, desafio_id")
    .eq("grupo_id", grupoId)
    .eq("jugado", true);
  const lista = partidos ?? [];
  const candidatos = lista.filter((p) => !p.desafio_id).map((p) => p.id);
  if (lista.length < 2 || candidatos.length === 0) return false;
  const { data: equipo2 } = await supabase
    .from("partido_jugadores")
    .select("partido_id")
    .in("partido_id", candidatos)
    .eq("equipo", 2);
  const internos = new Set((equipo2 ?? []).map((r) => r.partido_id)).size;
  return internos > 0 && internos < lista.length;
}
