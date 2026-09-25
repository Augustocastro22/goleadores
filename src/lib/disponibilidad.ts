import type { Bloqueo } from "./types";

export const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

const DIAS_SEMANA_PLURAL = [
  "domingos",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábados",
] as const;

function fechaCoincide(bloqueo: Bloqueo, fecha: string): boolean {
  if (bloqueo.tipo === "puntual") return bloqueo.fecha_desde === fecha;
  if (bloqueo.tipo === "rango") {
    return fecha >= bloqueo.fecha_desde! && fecha <= bloqueo.fecha_hasta!;
  }
  const diaSemana = new Date(fecha + "T00:00:00").getDay();
  return diaSemana === bloqueo.dia_semana;
}

function formatFecha(fecha: string): string {
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

function formatHorario(bloqueo: Bloqueo): string {
  if (!bloqueo.hora_desde || !bloqueo.hora_hasta) return "";
  return ` de ${bloqueo.hora_desde.slice(0, 5)} a ${bloqueo.hora_hasta.slice(0, 5)}`;
}

/** Descripción corta y legible de un bloqueo, para mostrar en listas y avisos. */
export function describirBloqueo(bloqueo: Bloqueo): string {
  const horario = formatHorario(bloqueo);
  if (bloqueo.tipo === "puntual") {
    return `${formatFecha(bloqueo.fecha_desde!)}${horario}`;
  }
  if (bloqueo.tipo === "rango") {
    return `${formatFecha(bloqueo.fecha_desde!)} – ${formatFecha(bloqueo.fecha_hasta!)}${horario}`;
  }
  return `Todos los ${DIAS_SEMANA_PLURAL[bloqueo.dia_semana!]}${horario}`;
}

/**
 * true si el bloqueo choca con la fecha (y hora, si se especifica) de un
 * partido. Si el bloqueo no tiene horario, bloquea el día entero. Si el
 * partido no tiene hora cargada, no se puede descartar el choque por
 * horario, así que se avisa igual (es solo un aviso, no excluye a nadie).
 */
export function bloqueaFecha(bloqueo: Bloqueo, fecha: string, hora: string | null): boolean {
  if (!fechaCoincide(bloqueo, fecha)) return false;
  if (!bloqueo.hora_desde || !bloqueo.hora_hasta || !hora) return true;
  return hora >= bloqueo.hora_desde && hora <= bloqueo.hora_hasta;
}
