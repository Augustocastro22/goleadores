import { formatearMomento } from "@/lib/confirmacion";

/**
 * Horas que dura la votación desde que se carga el resultado. El límite lo
 * fija la base al pasar el partido a jugado (partidos.votacion_cierra_en,
 * ver 0029_votacion_24h.sql); esto es solo para los textos.
 */
export const VOTACION_HORAS = 24;

/** Si ya pasó el límite de la votación (sin límite todavía no vence). */
export function votacionVencida(cierraEn: string | null, ahora: Date = new Date()): boolean {
  return cierraEn !== null && ahora >= new Date(cierraEn);
}

/**
 * Cierra cuando votaron todos en las categorías que tiene el partido (una
 * categoría apagada no se espera), o al vencer el plazo. Mismo criterio que
 * votacion_cerrada() en la base (0029_votacion_24h.sql).
 */
export function votacionCerrada({
  cierraEn,
  totalParticipantes,
  votosMvp,
  votosPeor,
  conMvp = true,
  conPeor = true,
  ahora = new Date(),
}: {
  /** partidos.votacion_cierra_en */
  cierraEn: string | null;
  totalParticipantes: number;
  votosMvp: number;
  votosPeor: number;
  conMvp?: boolean;
  conPeor?: boolean;
  ahora?: Date;
}): boolean {
  if (votacionVencida(cierraEn, ahora)) return true;
  if (totalParticipantes === 0) return false;
  return (!conMvp || votosMvp >= totalParticipantes) && (!conPeor || votosPeor >= totalParticipantes);
}

/** "Mejor Jugador y Peor Jugador", "Mejor Jugador" o "Peor Jugador". */
export function categoriasTexto({ conMvp, conPeor }: { conMvp: boolean; conPeor: boolean }): string {
  return [conMvp && "Mejor Jugador", conPeor && "Peor Jugador"].filter(Boolean).join(" y ");
}

/** "mié 15/10 a las 16:00": hasta cuándo se puede votar. */
export function formatearCierreVotacion(cierraEn: string): string {
  return formatearMomento(new Date(cierraEn));
}
