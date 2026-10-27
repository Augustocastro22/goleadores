import type { Bloqueo } from "./types";

/** Datos de ejemplo para el boceto de la disponibilidad del equipo. */
export const JUGADORES_DEMO = [
  "Nico", "Fede", "Maxi", "Lucho", "Santi", "Tomi", "Joaco", "Ale", "Gonza", "Pipe", "Rama", "Bauti", "Mateo", "Fran",
].map((nombre, i) => ({ id: `demo-${i}`, nombre }));

let n = 0;
function b(
  jugador: number,
  dia: number | string,
  desde: string | null = null,
  hasta: string | null = null,
  nota: string | null = null
): Bloqueo {
  const recurrente = typeof dia === "number";
  return {
    id: `b${n++}`,
    jugador_id: `demo-${jugador}`,
    grupo_id: null,
    tipo: recurrente ? "recurrente" : "puntual",
    fecha_desde: recurrente ? null : dia,
    fecha_hasta: null,
    dia_semana: recurrente ? dia : null,
    hora_desde: desde,
    hora_hasta: hasta,
    nota,
    excepciones: [],
    created_at: "2026-10-01T00:00:00Z",
  };
}

// Jugador 13 (Fran) no cargó nada: sale como "sin cargar".
export const BLOQUEOS_DEMO: Bloqueo[] = [
  b(0, 1, "10:00", "20:00", "trabajo"),
  b(0, 2, "10:00", "20:00"),
  b(1, 4, "10:00", "22:00"),
  b(1, 6),
  b(2, 3, "10:00", "21:00"),
  b(2, 5, "10:00", "19:00"),
  b(3, 0, "10:00", "16:00"),
  b(3, 1, "10:00", "19:00"),
  b(4, 6, "10:00", "15:00"),
  b(4, 2, "10:00", "20:00"),
  b(5, 5, "10:00", "24:00"),
  b(5, 4, "10:00", "20:00"),
  b(6, 1, "10:00", "21:00"),
  b(6, 3, "10:00", "21:00"),
  b(6, 0, "10:00", "14:00"),
  b(7, 2),
  b(7, 4, "10:00", "19:00"),
  b(8, 6, "10:00", "18:00"),
  b(8, 3, "10:00", "20:00"),
  b(9, 5, "10:00", "22:00"),
  b(9, 1, "10:00", "20:00"),
  b(10, 0),
  b(11, 3, "19:00", "24:00"),
  b(12, 4, "20:00", "24:00"),
  b(2, 0, "17:00", "21:00"),
  b(7, 6, "20:00", "24:00"),
  b(4, 5, "20:00", "24:00"),
];
