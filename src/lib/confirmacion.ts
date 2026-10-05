/**
 * Si un partido ya pasó, según la hora de Argentina: un día anterior a hoy,
 * o hoy con la hora ya pasada. Uno de hoy sin hora cuenta como que todavía
 * no pasó (puede ser a la noche).
 *
 * Se usa al convocar: cargar un partido que ya se jugó (porque se olvidaron
 * de cargarlo antes) no es una convocatoria, así que no se pide confirmación
 * ni se avisa a nadie.
 */
export function partidoYaPaso(fecha: string, hora: string | null, ahora: Date = new Date()): boolean {
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
  const hoy = `${partes.year}-${partes.month}-${partes.day}`;
  if (fecha !== hoy) return fecha < hoy;
  if (!hora) return false;
  return hora.slice(0, 5) <= `${partes.hour}:${partes.minute}`;
}
