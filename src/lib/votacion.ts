/** Días desde el partido antes de cerrar la votación aunque no hayan votado todos. */
export const VOTACION_DIAS_LIMITE = 7;

export function fechaLimiteVotacion(fechaPartido: string): Date {
  const limite = new Date(fechaPartido + "T00:00:00");
  limite.setDate(limite.getDate() + VOTACION_DIAS_LIMITE);
  return limite;
}

/**
 * Cierra cuando votaron todos en las categorías que tiene el partido (una
 * categoría apagada no se espera), o al vencer el plazo. Mismo criterio que
 * get_ranking_votos (0018_votacion_separada.sql).
 */
export function votacionCerrada({
  fechaPartido,
  totalParticipantes,
  votosMvp,
  votosPeor,
  conMvp = true,
  conPeor = true,
}: {
  fechaPartido: string;
  totalParticipantes: number;
  votosMvp: number;
  votosPeor: number;
  conMvp?: boolean;
  conPeor?: boolean;
}): boolean {
  if (totalParticipantes === 0) return false;
  const completa =
    (!conMvp || votosMvp >= totalParticipantes) && (!conPeor || votosPeor >= totalParticipantes);
  if (completa) return true;
  return new Date() > fechaLimiteVotacion(fechaPartido);
}

/** "Mejor Jugador y Peor Jugador", "Mejor Jugador" o "Peor Jugador". */
export function categoriasTexto({ conMvp, conPeor }: { conMvp: boolean; conPeor: boolean }): string {
  return [conMvp && "Mejor Jugador", conPeor && "Peor Jugador"].filter(Boolean).join(" y ");
}
