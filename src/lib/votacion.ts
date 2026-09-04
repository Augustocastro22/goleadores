/** Días desde el partido antes de cerrar la votación aunque no hayan votado todos. */
export const VOTACION_DIAS_LIMITE = 7;

export function fechaLimiteVotacion(fechaPartido: string): Date {
  const limite = new Date(fechaPartido + "T00:00:00");
  limite.setDate(limite.getDate() + VOTACION_DIAS_LIMITE);
  return limite;
}

export function votacionCerrada({
  fechaPartido,
  totalParticipantes,
  votosMvp,
  votosPeor,
}: {
  fechaPartido: string;
  totalParticipantes: number;
  votosMvp: number;
  votosPeor: number;
}): boolean {
  if (totalParticipantes === 0) return false;
  const completa = votosMvp >= totalParticipantes && votosPeor >= totalParticipantes;
  if (completa) return true;
  return new Date() > fechaLimiteVotacion(fechaPartido);
}
