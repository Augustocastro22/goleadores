/**
 * Registro de qué días entra cada usuario (para /metricas). El proxy llama a
 * registrar_visita() la primera vez en el día y deja esta cookie con la
 * fecha, así el resto de las pantallas de ese día no tocan la base.
 * Vive aparte (sin next/headers) para poder usarse desde el proxy.
 */
export const VISITA_COOKIE = "visita_dia";

export const VISITA_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 48,
  sameSite: "lax" as const,
  httpOnly: true,
};

const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha (AAAA-MM-DD) en hora de Argentina; la misma que guarda registrar_visita(). */
export function diaArgentina(fecha: Date = new Date()): string {
  return formatoDia.format(fecha);
}
