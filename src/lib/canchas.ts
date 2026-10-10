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

/**
 * Igual que public.normalizar_lugar (0027_canchas_misma_clave.sql): sin
 * mayúsculas, tildes, espacios ni signos. "GreenPark" y "Green Park" son la misma.
 */
export function normalizarLugar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Cuántas letras hay que cambiar, agregar o sacar para pasar de una a otra. */
function distancia(a: string, b: string): number {
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++) {
      fila[j] = Math.min(anterior[j] + 1, fila[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = fila;
  }
  return anterior[b.length];
}

/**
 * Si dos nombres parecen la misma cancha mal escrita ("Gren Park" y "Green
 * Park"): difieren en 1 letra, o en 2 si son largos. Los iguales no cuentan.
 */
export function parecidas(a: string, b: string): boolean {
  const x = normalizarLugar(a);
  const y = normalizarLugar(b);
  if (!x || !y || x === y) return false;
  // "Cancha 1" y "Cancha 2" son distintas: los números tienen que coincidir.
  if (x.replace(/\D/g, "") !== y.replace(/\D/g, "")) return false;
  const tolerancia = Math.min(x.length, y.length) >= 8 ? 2 : 1;
  return Math.min(x.length, y.length) >= 4 && distancia(x, y) <= tolerancia;
}

/**
 * Las canchas que coinciden con lo escrito (todas si no hay nada escrito),
 * más las que parecen la misma mal escrita.
 */
export function filtrarCanchas<T extends Pick<Cancha, "nombre">>(canchas: T[], texto: string): T[] {
  const buscado = normalizarLugar(texto);
  if (!buscado) return canchas;
  return canchas.filter((c) => normalizarLugar(c.nombre).includes(buscado) || parecidas(c.nombre, texto));
}

/** La cancha que es exactamente lo escrito (salvo mayúsculas, tildes, espacios y signos). */
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
