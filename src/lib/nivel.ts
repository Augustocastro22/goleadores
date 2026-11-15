import { sortearEquipos } from "./sorteo";

/**
 * Nivel de cada jugador (del 1 al 10) para armar equipos parejos, según su
 * historial en el grupo (todos los partidos jugados, entre ellos y contra
 * otros):
 *
 * - % de puntos: ganar suma 3, empatar 1, perder 0, sobre 3 por partido.
 * - Goles por partido.
 *
 * Cada uno se lleva a 0–1 con min/max entre los jugadores del grupo que tienen
 * historial suficiente, y se suman con pesos (los puntos pesan más: miden si
 * el equipo gana con vos; los goles favorecen a los de arriba).
 *
 * Con menos de MIN_PARTIDOS no se lo mide: vale el nivel que le puso el admin
 * a mano (0042_niveles_manuales.sql) o, si no le puso, el promedio.
 *
 * Los equipos se comparan por el promedio de sus jugadores, no por la suma:
 * con impares (4 contra 3) el lugar que falta lo completa un invitado, que
 * se supone del promedio.
 */

export const MIN_PARTIDOS = 5;
const PESO_PUNTOS = 0.7;
const PESO_GOLES = 0.3;

/** Una fila por jugador y partido jugado (partido_jugadores con su partido). */
export interface FilaHistorial {
  partido_id: string;
  jugador_id: string;
  goles: number;
  equipo: 1 | 2;
  /** Del partido: goles del rival (o del equipo 2 que no son del grupo) y en contra / sin dueño del equipo 1. */
  goles_rival: number;
  goles_otros: number;
}

export interface Historial {
  partidos: number;
  puntos: number;
  goles: number;
}

/** Partidos, puntos (3/1/0) y goles de cada jugador. */
export function historialPorJugador(filas: FilaHistorial[]): Map<string, Historial> {
  // Goles de cada equipo en cada partido, como en el resto de la app: los del
  // equipo más los goles_otros (equipo 1) o goles_rival (equipo 2).
  const marcador = new Map<string, { e1: number; e2: number }>();
  for (const f of filas) {
    const m = marcador.get(f.partido_id) ?? { e1: f.goles_otros, e2: f.goles_rival };
    if (f.equipo === 1) m.e1 += f.goles;
    else m.e2 += f.goles;
    marcador.set(f.partido_id, m);
  }

  const historial = new Map<string, Historial>();
  for (const f of filas) {
    const m = marcador.get(f.partido_id)!;
    const [mios, suyos] = f.equipo === 1 ? [m.e1, m.e2] : [m.e2, m.e1];
    const h = historial.get(f.jugador_id) ?? { partidos: 0, puntos: 0, goles: 0 };
    h.partidos += 1;
    h.puntos += mios > suyos ? 3 : mios === suyos ? 1 : 0;
    h.goles += f.goles;
    historial.set(f.jugador_id, h);
  }
  return historial;
}

/** Del 1 al 10, con un decimal. Es lo que viaja al componente (objetos planos). */
export interface Niveles {
  /** Los medidos con su historial. */
  medidos: Record<string, number>;
  /** Los que el admin puso a mano, de los que todavía no se pueden medir. */
  manuales: Record<string, number>;
  /** Lo que vale quien no tiene ni historial ni nivel a mano. */
  promedio: number;
}

const unDecimal = (n: number) => Math.round(n * 10) / 10;

/**
 * `miembros`: solo ellos cuentan (en un desafío también están los del otro
 * grupo, que no tienen que mover el min/max). `manuales`: lo que puso el
 * admin; solo vale para los que no tienen historial suficiente. null si no
 * hay nadie medido ni con nivel a mano: no hay con qué emparejar.
 */
export function calcularNiveles(
  historial: Map<string, Historial>,
  { miembros, manuales = {} }: { miembros?: Set<string>; manuales?: Record<string, number> } = {}
): Niveles | null {
  const esMiembro = (id: string) => !miembros || miembros.has(id);
  const conHistorial = [...historial.entries()].filter(([id, h]) => h.partidos >= MIN_PARTIDOS && esMiembro(id));

  const pct = conHistorial.map(([, h]) => h.puntos / (3 * h.partidos));
  const gpp = conHistorial.map(([, h]) => h.goles / h.partidos);
  const normalizar = (valores: number[]) => {
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    // Todos iguales: nadie es mejor que nadie en esto.
    return valores.map((v) => (max === min ? 0.5 : (v - min) / (max - min)));
  };
  const pctN = normalizar(pct);
  const gppN = normalizar(gpp);

  const medidos: Record<string, number> = {};
  conHistorial.forEach(([id], i) => {
    medidos[id] = unDecimal(1 + 9 * (PESO_PUNTOS * pctN[i] + PESO_GOLES * gppN[i]));
  });
  const aMano: Record<string, number> = {};
  for (const [id, nivel] of Object.entries(manuales)) {
    if (!(id in medidos) && esMiembro(id)) aMano[id] = nivel;
  }

  const valores = [...Object.values(medidos), ...Object.values(aMano)];
  if (valores.length === 0) return null;
  const promedio = unDecimal(valores.reduce((a, b) => a + b, 0) / valores.length);
  return { medidos, manuales: aMano, promedio };
}

export function nivelDe(niveles: Niveles, jugadorId: string): number {
  return niveles.medidos[jugadorId] ?? niveles.manuales[jugadorId] ?? niveles.promedio;
}

/** El promedio del nivel de cada equipo (0 si el equipo está vacío). */
export function puntajeEquipos(
  asignaciones: Record<string, 1 | 2>,
  nivel: (jugadorId: string) => number
): [number, number] {
  const suma = [0, 0];
  const cuantos = [0, 0];
  for (const [id, equipo] of Object.entries(asignaciones)) {
    suma[equipo - 1] += nivel(id);
    cuantos[equipo - 1] += 1;
  }
  return [cuantos[0] ? suma[0] / cuantos[0] : 0, cuantos[1] ? suma[1] / cuantos[1] : 0];
}

/**
 * Equipos parejos pero sorteados: prueba muchos repartos al azar (parejos en
 * cantidad) y elige uno al azar entre los de menor diferencia de promedio.
 * Así quedan equilibrados y no salen siempre los mismos.
 */
export function sortearParejos(
  ids: string[],
  nivel: (jugadorId: string) => number,
  azar: () => number = Math.random,
  intentos = 2000
): Record<string, 1 | 2> {
  if (ids.length < 2) return sortearEquipos(ids, azar);
  const repartos = Array.from({ length: intentos }, () => {
    const reparto = sortearEquipos(ids, azar);
    const [a, b] = puntajeEquipos(reparto, nivel);
    return { reparto, diferencia: Math.abs(a - b) };
  });
  repartos.sort((x, y) => x.diferencia - y.diferencia);
  // Entre el mejor 2% (y como mucho a 0,2 del mejor, para no meter uno desparejo).
  const mejor = repartos[0].diferencia;
  const candidatos = repartos
    .slice(0, Math.max(1, Math.floor(intentos * 0.02)))
    .filter((r) => r.diferencia <= mejor + 0.2);
  return candidatos[Math.floor(azar() * candidatos.length)].reparto;
}
