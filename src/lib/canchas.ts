import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Canchas de cada grupo (ver supabase/migrations/0026_canchas.sql). La
 * cancha de un partido la asigna la base según el lugar que se guarda: acá
 * solo se leen, para sugerirlas al escribir el lugar y para Admin → Canchas.
 */
export interface Cancha {
  id: string;
  grupo_id: string;
  nombre: string;
  /** Partidos del grupo en esa cancha. */
  partidos: number;
}

/** Igual que public.normalizar_lugar: sin mayúsculas, tildes ni espacios de más. */
export function normalizarLugar(texto: string): string {
  return texto
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Las canchas que coinciden con lo escrito (todas si no hay nada escrito). */
export function filtrarCanchas<T extends Pick<Cancha, "nombre">>(canchas: T[], texto: string): T[] {
  const buscado = normalizarLugar(texto);
  if (!buscado) return canchas;
  return canchas.filter((c) => normalizarLugar(c.nombre).includes(buscado));
}

/** La cancha que es exactamente lo escrito (salvo mayúsculas, tildes y espacios). */
export function canchaExacta<T extends Pick<Cancha, "nombre">>(canchas: T[], texto: string): T | undefined {
  const buscado = normalizarLugar(texto);
  return buscado ? canchas.find((c) => normalizarLugar(c.nombre) === buscado) : undefined;
}

/** Las canchas de uno o varios grupos, las más usadas primero. */
export async function getCanchas(supabase: SupabaseClient, grupoIds: string | string[]): Promise<Cancha[]> {
  const ids = Array.isArray(grupoIds) ? grupoIds : [grupoIds];
  if (ids.length === 0) return [];
  const { data } = await supabase.from("canchas").select("id, grupo_id, nombre, partidos(count)").in("grupo_id", ids);
  return ((data ?? []) as { id: string; grupo_id: string; nombre: string; partidos: { count: number }[] }[])
    .map((c) => ({ id: c.id, grupo_id: c.grupo_id, nombre: c.nombre, partidos: c.partidos[0]?.count ?? 0 }))
    .sort((a, b) => b.partidos - a.partidos || a.nombre.localeCompare(b.nombre, "es"));
}
