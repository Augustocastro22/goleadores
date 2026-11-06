/**
 * Reparte jugadores en dos equipos al azar, lo más parejo posible en cantidad
 * (si son impares, el que sobra va a cualquiera de los dos). `azar` es para
 * los tests; por defecto, Math.random.
 */
export function sortearEquipos(ids: string[], azar: () => number = Math.random): Record<string, 1 | 2> {
  const mezclados = [...ids];
  // Fisher-Yates.
  for (let i = mezclados.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [mezclados[i], mezclados[j]] = [mezclados[j], mezclados[i]];
  }
  // Con impares, a qué equipo va el que sobra también es al azar.
  const primero: 1 | 2 = azar() < 0.5 ? 1 : 2;
  const segundo: 1 | 2 = primero === 1 ? 2 : 1;
  return Object.fromEntries(mezclados.map((id, i) => [id, i % 2 === 0 ? primero : segundo]));
}
