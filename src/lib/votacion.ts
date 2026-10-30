import { formatearMomento } from "@/lib/confirmacion";

/**
 * Horas que dura la votación desde que se carga el resultado. El límite lo
 * fija la base al pasar el partido a jugado (partidos.votacion_cierra_en,
 * ver 0029_votacion_24h.sql y 0039_votacion_48h_cierre_manual.sql); esto es
 * solo para los textos.
 */
export const VOTACION_HORAS = 48;

/** Desde cuántas horas después de cargado el resultado un admin puede cerrar la votación a mano. */
export const VOTACION_CIERRE_MANUAL_HORAS = 24;

const MS_HORA = 60 * 60 * 1000;

/** Si ya pasó el límite de la votación (sin límite todavía no vence). */
export function votacionVencida(cierraEn: string | null, ahora: Date = new Date()): boolean {
  return cierraEn !== null && ahora >= new Date(cierraEn);
}

/**
 * Si un admin ya puede cerrar la votación a mano: pasaron
 * VOTACION_CIERRE_MANUAL_HORAS desde que se cargó el resultado, o sea que
 * faltan VOTACION_CIERRE_MANUAL_HORAS o menos para el cierre automático (mismo
 * criterio que cerrar_votacion() en la base).
 */
export function puedeCerrarVotacionAMano(cierraEn: string | null, ahora: Date = new Date()): boolean {
  if (cierraEn === null) return false;
  return ahora.getTime() >= new Date(cierraEn).getTime() - VOTACION_CIERRE_MANUAL_HORAS * MS_HORA;
}

/** Con cuántas horas por delante (como mucho) empieza a avisarse que la votación está abierta. */
const RECORDATORIO_DESDE_HORAS = 40;
/** Con cuántas horas por delante (o menos) el recordatorio es el último ("cierra hoy"). */
const RECORDATORIO_ULTIMO_HORAS = 24;

/**
 * Qué recordatorio de votación toca mandar ahora, o null si ninguno. El cron
 * corre una vez por día, así que son a lo sumo dos: uno cuando faltan unas
 * 40 horas o menos ("primero") y otro cuando faltan 24 o menos ("ultimo",
 * "cierra hoy"). `enviados` es partidos.votacion_recordatorios (0, 1 o 2); si
 * el primero cae ya dentro de las últimas 24 horas, cuenta como el último.
 */
export function proximoRecordatorioVotacion({
  cierraEn,
  enviados,
  ahora = new Date(),
}: {
  cierraEn: string | null;
  enviados: number;
  ahora?: Date;
}): "primero" | "ultimo" | null {
  if (cierraEn === null || enviados >= 2) return null;
  const restantes = (new Date(cierraEn).getTime() - ahora.getTime()) / MS_HORA;
  if (restantes <= 0) return null;
  if (restantes <= RECORDATORIO_ULTIMO_HORAS) return "ultimo";
  if (enviados === 0 && restantes <= RECORDATORIO_DESDE_HORAS) return "primero";
  return null;
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
