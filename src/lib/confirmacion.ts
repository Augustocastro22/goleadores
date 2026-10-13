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

/**
 * Desde cuándo el admin puede cargar el resultado de un partido: una hora
 * después de la hora del partido (un partido a las 15 se carga desde las 16);
 * si no tiene hora, desde ese día. Argentina no tiene horario de verano, así
 * que alcanza con -03:00.
 */
export function resultadoHabilitadoDesde(fecha: string, hora: string | null): Date {
  const inicio = new Date(`${fecha}T${hora ? hora.slice(0, 5) : "00:00"}:00-03:00`);
  return hora ? new Date(inicio.getTime() + 60 * 60 * 1000) : inicio;
}

export function puedeCargarResultado(fecha: string, hora: string | null, ahora: Date = new Date()): boolean {
  return ahora >= resultadoHabilitadoDesde(fecha, hora);
}

/** "mar 14/10 a las 16:00", en hora de Argentina. */
export function formatearMomento(momento: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(momento)
      .map((p) => [p.type, p.value])
  );
  const dia = partes.weekday.replace(".", "");
  return `${dia} ${partes.day}/${partes.month} a las ${partes.hour}:${partes.minute}`;
}
