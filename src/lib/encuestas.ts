/**
 * Cierra cuando vence el plazo, o antes si ya votó todo el plantel — mismo
 * criterio que votacionCerrada (ver src/lib/votacion.ts), pero sin el
 * margen de 7 días: acá el plazo lo elige quien crea la encuesta.
 */
export function encuestaCerrada({
  cierraEn,
  totalParticipantes,
  totalVotos,
}: {
  cierraEn: string;
  totalParticipantes: number;
  totalVotos: number;
}): boolean {
  if (totalParticipantes > 0 && totalVotos >= totalParticipantes) return true;
  return new Date() > new Date(cierraEn);
}
