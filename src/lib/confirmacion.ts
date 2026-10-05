/** Fecha ("YYYY-MM-DD") y hora ("HH:MM") de ahora en Argentina. */
function ahoraEnArgentina(ahora: Date) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(ahora)
      .map((p) => [p.type, p.value])
  );
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

/** Fecha de hoy en Argentina ("YYYY-MM-DD"), aunque el servidor esté en UTC. */
export function hoyArgentina(ahora: Date = new Date()): string {
  return ahoraEnArgentina(ahora).fecha;
}

/**
 * Si un partido ya pasó, según la hora de Argentina: un día anterior a hoy,
 * o hoy con la hora ya pasada. Uno de hoy sin hora cuenta como que todavía
 * no pasó (puede ser a la noche).
 *
 * Se usa al convocar: sumar gente a un partido que ya se jugó no es una
 * convocatoria, así que no se pide confirmación ni se avisa a nadie.
 */
export function partidoYaPaso(fecha: string, hora: string | null, ahora: Date = new Date()): boolean {
  const hoy = ahoraEnArgentina(ahora);
  if (fecha !== hoy.fecha) return fecha < hoy.fecha;
  if (!hora) return false;
  return hora.slice(0, 5) <= hoy.hora;
}
