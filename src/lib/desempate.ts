export interface VotoSimple {
  votante: string;
  votado: string;
}

export interface Empate {
  /** Candidatos empatados en el máximo de votos. */
  empatados: string[];
  /**
   * Participantes que no votaron a ningún empatado y no son ellos mismos
   * uno de los empatados: son quienes podrían definir el empate votando de
   * nuevo, solo entre los empatados.
   */
  elegibles: string[];
  /**
   * true si una revotación de los `elegibles` está garantizada a resolver
   * el empate sin importar cómo voten (nunca puede volver a quedar
   * empatado). Con 2 empatados alcanza con que `elegibles.length` sea
   * impar (no se puede repartir un número impar en mitades iguales). Con 3
   * o más empatados, solo está garantizado cuando hay exactamente 1
   * elegible (un solo voto adicional siempre rompe la simetría; 2 o más
   * podrían repartirse y generar un empate nuevo).
   */
  definible: boolean;
}

/**
 * Analiza los votos de una categoría (MVP o Peor) de un partido y detecta
 * si hay empate por el primer puesto, y si ese empate se puede definir con
 * una revotación entre quienes no votaron a ninguno de los empatados y no
 * son ellos mismos uno de los empatados.
 *
 * Devuelve `null` si no hay empate (ganador único) o si nadie recibió
 * votos.
 */
export function calcularEmpate(participantes: string[], votos: VotoSimple[]): Empate | null {
  const conteo = new Map<string, number>();
  for (const { votado } of votos) {
    conteo.set(votado, (conteo.get(votado) ?? 0) + 1);
  }
  if (conteo.size === 0) return null;

  const maxVotos = Math.max(...conteo.values());
  const empatados = [...conteo.entries()].filter(([, n]) => n === maxVotos).map(([id]) => id);
  if (empatados.length < 2) return null;

  const empatadosSet = new Set(empatados);
  const votoDe = new Map(votos.map(({ votante, votado }) => [votante, votado]));

  const elegibles = participantes.filter((id) => {
    if (empatadosSet.has(id)) return false;
    const votoEmitido = votoDe.get(id);
    return !votoEmitido || !empatadosSet.has(votoEmitido);
  });

  const definible =
    elegibles.length > 0 &&
    (empatados.length === 2 ? elegibles.length % 2 === 1 : elegibles.length === 1);

  return { empatados, elegibles, definible };
}

/** Horas que tienen los elegibles para definir un desempate desde que se abre. */
export const DESEMPATE_HORAS = 24;

export function cierreDesempate(abiertoEn: string): Date {
  return new Date(new Date(abiertoEn).getTime() + DESEMPATE_HORAS * 60 * 60 * 1000);
}

/**
 * Resultado de un desempate con los votos que hay: gana el que tiene más; si
 * siguen parejos (o nadie votó) no hay ganador y cuentan todos los empatados.
 * Así, no votar no le saca nada a nadie: es lo mismo que abstenerse.
 */
export function ganadorDesempate(votados: string[]): string | null {
  const conteo = new Map<string, number>();
  for (const id of votados) conteo.set(id, (conteo.get(id) ?? 0) + 1);
  if (conteo.size === 0) return null;
  const max = Math.max(...conteo.values());
  const primeros = [...conteo.entries()].filter(([, n]) => n === max);
  return primeros.length === 1 ? primeros[0][0] : null;
}
