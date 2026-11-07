/**
 * La cancha para armar formaciones (ver components/cancha/ArmadorCancha):
 * cuántos juegan, formaciones, dónde va cada posición y cómo se reparten los
 * jugadores. Coordenadas en % de la cancha (x: izquierda→derecha, y:
 * arriba→abajo), en vertical.
 */

export const FUTBOL_OPCIONES = [5, 6, 7, 8, 9, 11] as const;

export const FORMACIONES_PRESET: Record<number, string[]> = {
  5: ["2-2", "3-1", "1-2-1"],
  6: ["2-2-1", "1-3-1", "3-2"],
  7: ["3-2-1", "2-3-1", "2-2-2"],
  8: ["3-3-1", "2-3-2", "3-2-2"],
  9: ["3-3-2", "4-3-1", "3-4-1"],
  11: ["4-4-2", "4-3-3", "3-5-2"],
};

export type Equipo = 1 | 2;

/**
 * Qué parte de la cancha ocupa un equipo:
 * - "completa": uno solo, toda la cancha, atacando hacia arriba;
 * - "abajo" / "arriba": dos equipos, cada uno en su mitad (el de arriba,
 *   espejado: su arquero arriba).
 */
export type Mitad = "completa" | "abajo" | "arriba";

export interface Slot {
  id: string;
  equipo: Equipo;
  xPct: number;
  yPct: number;
  arquero: boolean;
}

/** "3-2-1" → [3, 2, 1]; null si no son números positivos. */
export function parseFormacion(input: string): number[] | null {
  const partes = input
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number);
  if (partes.length === 0 || partes.some((n) => !Number.isInteger(n) || n <= 0)) return null;
  return partes;
}

function repartidoEnX(cantidad: number): number[] {
  const desde = 12;
  const hasta = 88;
  const ancho = hasta - desde;
  return Array.from({ length: cantidad }, (_, i) => desde + (i + 0.5) * (ancho / cantidad));
}

/** Las posiciones de un equipo: el arquero y una fila por línea, de defensa a ataque. */
export function armarSlots(lineas: number[], equipo: Equipo, mitad: Mitad): Slot[] {
  const [yArquero, yDefensa, yAtaque] = mitad === "completa" ? [92, 76, 14] : [90, 77, 61];
  const espejo = (y: number) => (mitad === "arriba" ? 100 - y : y);
  const slots: Slot[] = [{ id: `e${equipo}-arq`, equipo, xPct: 50, yPct: espejo(yArquero), arquero: true }];
  lineas.forEach((cantidad, i) => {
    const t = lineas.length === 1 ? 0 : i / (lineas.length - 1);
    const y = yDefensa - t * (yDefensa - yAtaque);
    repartidoEnX(cantidad).forEach((x, j) => {
      slots.push({ id: `e${equipo}-l${i}-${j}`, equipo, xPct: x, yPct: espejo(y), arquero: false });
    });
  });
  return slots;
}

/** La cantidad de jugadores por equipo que mejor encaja con los que hay (la opción más chica que alcanza). */
export function futbolPara(jugadores: number): number {
  return FUTBOL_OPCIONES.find((n) => n >= jugadores) ?? FUTBOL_OPCIONES[FUTBOL_OPCIONES.length - 1];
}

/**
 * Ubica jugadores en las posiciones, en orden (el primero al arco). Los que
 * no entran quedan afuera (suplentes). Devuelve posición → jugador.
 */
export function repartir(jugadores: string[], slots: Slot[]): Record<string, string> {
  const asignaciones: Record<string, string> = {};
  slots.forEach((slot, i) => {
    if (jugadores[i]) asignaciones[slot.id] = jugadores[i];
  });
  return asignaciones;
}

/** Los jugadores de un equipo en el orden en que están en la cancha (arquero, defensa… ataque). */
export function ordenEnCancha(asignaciones: Record<string, string>, slots: Slot[]): string[] {
  return slots.map((s) => asignaciones[s.id]).filter((id): id is string => Boolean(id));
}
