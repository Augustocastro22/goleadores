import { armarSlots, FUTBOL_OPCIONES, parseFormacion, type Equipo } from "@/lib/cancha";

/**
 * La formación guardada de un partido (partidos.formacion, ver
 * 0041_formacion_partido.sql). La guarda el admin desde "La cancha"; si está,
 * todos la ven igual.
 */
export type Lugar = { jugador: string } | { invitado: string };

export interface FormacionGuardada {
  /** De cuánto se juega (jugadores por equipo). */
  futbol: number;
  /** "3-2-1": las líneas sin el arquero. */
  formacion: string;
  /** Quién va en cada posición: un jugador del grupo o un invitado (solo el nombre). */
  lugares: Record<string, Lugar>;
  /** Las posiciones movidas a mano (en % de la cancha). */
  posiciones: Record<string, { x: number; y: number }>;
  guardada_en?: string;
}

export const MAX_NOMBRE_INVITADO = 20;

/**
 * Revisa una formación antes de guardarla: cantidad y formación válidas,
 * posiciones que existen, jugadores que están convocados (sin repetir) y
 * nombres de invitados razonables. Devuelve la formación limpia o el error.
 */
export function validarFormacion(
  raw: unknown,
  { jugadores, dosEquipos }: { jugadores: Set<string>; dosEquipos: boolean }
): { formacion: FormacionGuardada } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Formación inválida." };
  const f = raw as Partial<FormacionGuardada>;
  const futbol = Number(f.futbol);
  if (!(FUTBOL_OPCIONES as readonly number[]).includes(futbol)) return { error: "Elegí de cuánto se juega." };
  const lineas = parseFormacion(String(f.formacion ?? ""));
  if (!lineas || lineas.reduce((a, b) => a + b, 0) !== futbol - 1) {
    return { error: `La formación tiene que sumar ${futbol - 1} jugadores, sin contar el arquero.` };
  }

  const equipos: Equipo[] = dosEquipos ? [1, 2] : [1];
  const slots = equipos.flatMap((e) => armarSlots(lineas, e, dosEquipos ? (e === 1 ? "abajo" : "arriba") : "completa"));
  const ids = new Set(slots.map((s) => s.id));

  const lugares: Record<string, Lugar> = {};
  const usados = new Set<string>();
  for (const [slot, lugar] of Object.entries(f.lugares ?? {})) {
    if (!ids.has(slot)) return { error: "Hay una posición que no existe en esa formación." };
    if (lugar && typeof lugar === "object" && "jugador" in lugar && typeof lugar.jugador === "string") {
      if (!jugadores.has(lugar.jugador)) return { error: "Hay un jugador que no está convocado a este partido." };
      if (usados.has(lugar.jugador)) return { error: "Un jugador no puede estar en dos posiciones." };
      usados.add(lugar.jugador);
      lugares[slot] = { jugador: lugar.jugador };
    } else if (lugar && typeof lugar === "object" && "invitado" in lugar && typeof lugar.invitado === "string") {
      const nombre = lugar.invitado.trim();
      if (!nombre) continue;
      if (nombre.length > MAX_NOMBRE_INVITADO) {
        return { error: `El nombre de un invitado puede tener hasta ${MAX_NOMBRE_INVITADO} letras.` };
      }
      lugares[slot] = { invitado: nombre };
    } else {
      return { error: "Formación inválida." };
    }
  }

  const posiciones: Record<string, { x: number; y: number }> = {};
  for (const [slot, p] of Object.entries(f.posiciones ?? {})) {
    if (!ids.has(slot) || !p || typeof p.x !== "number" || typeof p.y !== "number") continue;
    posiciones[slot] = { x: Math.min(95, Math.max(5, p.x)), y: Math.min(95, Math.max(5, p.y)) };
  }

  return { formacion: { futbol, formacion: lineas.join("-"), lugares, posiciones } };
}
