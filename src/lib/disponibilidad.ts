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

/** true si el bloqueo cae en esa fecha (sin mirar el horario). */
export function fechaCoincide(bloqueo: Bloqueo, fecha: string): boolean {
  // ?? []: por si la fila viene de antes de 0019_excepciones_bloqueos.sql.
  if ((bloqueo.excepciones ?? []).includes(fecha)) return false;
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
  const excepciones = [...(bloqueo.excepciones ?? [])].sort();
  const menos = excepciones.length > 0 ? ` (menos el ${excepciones.map(formatFecha).join(", ")})` : "";
  return `Todos los ${DIAS_SEMANA_PLURAL[bloqueo.dia_semana!]}${horario}${menos}`;
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

/** Lo que se guarda de un bloqueo nuevo (el resto lo completa el servidor). */
export type BloqueoNuevo = Pick<
  Bloqueo,
  "tipo" | "fecha_desde" | "fecha_hasta" | "dia_semana" | "hora_desde" | "hora_hasta"
> & { excepciones?: string[] };

export interface Horario {
  desde: string;
  hasta: string;
}

function aHora(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/**
 * Horarios para elegir, en horas enteras (al fútbol se juega a las 14, a las
 * 16...). "24:00" es medianoche al final del día (Postgres lo acepta como
 * time), para poder decir "de 20 a 24".
 */
export const HORARIOS: string[] = Array.from({ length: 25 }, (_, h) => aHora(h));

/** Horas que muestra la agenda semanal: cada celda va de h a h+1. */
export const AGENDA_DESDE = 10;
export const AGENDA_HASTA = 24;

/** Bloqueos que cubren, aunque sea en parte, de h a h+1 en esa fecha. */
export function bloqueosEnHora(bloqueos: Bloqueo[], fecha: string, h: number): Bloqueo[] {
  return bloqueos.filter(
    (b) =>
      fechaCoincide(b, fecha) &&
      (!b.hora_desde ||
        !b.hora_hasta ||
        (b.hora_desde.slice(0, 5) < aHora(h + 1) && b.hora_hasta.slice(0, 5) > aHora(h)))
  );
}

/**
 * Arma los bloqueos de lo marcado en la agenda semanal (fecha → horas). Las
 * horas seguidas de un día quedan en un solo horario, y un día con todas las
 * horas de la agenda marcadas queda como día entero. Con `repetir`, cada día
 * se guarda como "todos los <día de la semana>".
 */
export function bloqueosDeAgenda(marcadas: Map<string, number[]>, repetir: boolean): BloqueoNuevo[] {
  const total = AGENDA_HASTA - AGENDA_DESDE;
  const resultado: BloqueoNuevo[] = [];
  for (const fecha of [...marcadas.keys()].sort()) {
    const horas = [...new Set(marcadas.get(fecha))].sort((a, b) => a - b);
    if (horas.length === 0) continue;
    const base: Omit<BloqueoNuevo, "hora_desde" | "hora_hasta"> = repetir
      ? {
          tipo: "recurrente",
          fecha_desde: null,
          fecha_hasta: null,
          dia_semana: new Date(fecha + "T00:00:00Z").getUTCDay(),
        }
      : { tipo: "puntual", fecha_desde: fecha, fecha_hasta: null, dia_semana: null };
    if (horas.length === total) {
      resultado.push({ ...base, hora_desde: null, hora_hasta: null });
      continue;
    }
    for (let i = 0; i < horas.length; i++) {
      const desde = horas[i];
      while (i + 1 < horas.length && horas[i + 1] === horas[i] + 1) i++;
      resultado.push({ ...base, hora_desde: aHora(desde), hora_hasta: aHora(horas[i] + 1) });
    }
  }
  return resultado;
}

function diaSiguiente(fecha: string): string {
  const d = new Date(fecha + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Arma los bloqueos a guardar a partir de lo elegido en el calendario: los
 * días seguidos quedan como un rango, los sueltos como puntuales y cada día
 * de la semana como recurrente. Sin horarios bloquea el día entero; con
 * horarios, cada uno es un bloqueo aparte (ej: "de 14 a 16 y de 20 a 24").
 */
export function armarBloqueos({
  fechas,
  diasSemana,
  horarios,
}: {
  fechas: string[];
  diasSemana: number[];
  horarios: Horario[] | null;
}): BloqueoNuevo[] {
  const tramos: Omit<BloqueoNuevo, "hora_desde" | "hora_hasta">[] = [];

  const ordenadas = [...new Set(fechas)].sort();
  for (let i = 0; i < ordenadas.length; i++) {
    const desde = ordenadas[i];
    let hasta = desde;
    while (i + 1 < ordenadas.length && ordenadas[i + 1] === diaSiguiente(hasta)) {
      hasta = ordenadas[++i];
    }
    tramos.push(
      desde === hasta
        ? { tipo: "puntual", fecha_desde: desde, fecha_hasta: null, dia_semana: null }
        : { tipo: "rango", fecha_desde: desde, fecha_hasta: hasta, dia_semana: null }
    );
  }
  for (const dia of [...new Set(diasSemana)].sort()) {
    tramos.push({ tipo: "recurrente", fecha_desde: null, fecha_hasta: null, dia_semana: dia });
  }

  const franjas = horarios && horarios.length > 0 ? horarios : [null];
  return tramos.flatMap((t) =>
    franjas.map((h) => ({ ...t, hora_desde: h?.desde ?? null, hora_hasta: h?.hasta ?? null }))
  );
}

/** Mensaje de error si el bloqueo no es válido, o null. */
export function validarBloqueo(b: BloqueoNuevo): string | null {
  const esFecha = (f: string | null) => !!f && /^\d{4}-\d{2}-\d{2}$/.test(f);
  if (b.tipo === "puntual" && !esFecha(b.fecha_desde)) return "Elegí la fecha.";
  if (b.tipo === "rango") {
    if (!esFecha(b.fecha_desde) || !esFecha(b.fecha_hasta)) return "Completá desde y hasta.";
    if (b.fecha_desde! > b.fecha_hasta!) return "La fecha de hasta tiene que ser posterior a la de desde.";
  }
  if (b.tipo === "recurrente") {
    if (b.dia_semana === null || !Number.isInteger(b.dia_semana) || b.dia_semana < 0 || b.dia_semana > 6) {
      return "Elegí un día de la semana.";
    }
  }
  if (b.tipo !== "puntual" && b.tipo !== "rango" && b.tipo !== "recurrente") return "Tipo inválido.";
  if (b.excepciones !== undefined) {
    if (!Array.isArray(b.excepciones) || b.excepciones.length > 200 || !b.excepciones.every(esFecha)) {
      return "Excepciones inválidas.";
    }
  }
  if (!!b.hora_desde !== !!b.hora_hasta) return "Completá los dos extremos del horario.";
  if (b.hora_desde && b.hora_hasta) {
    if (!HORARIOS.includes(b.hora_desde) || !HORARIOS.includes(b.hora_hasta)) return "Horario inválido.";
    if (b.hora_hasta <= b.hora_desde) return "En cada horario, el \"hasta\" tiene que ser después del \"desde\".";
  }
  return null;
}

/** Las mismas columnas que se comparan para no guardar dos veces el mismo bloqueo. */
export function mismoBloqueo(
  a: BloqueoNuevo & { grupo_id?: string | null },
  b: BloqueoNuevo & { grupo_id?: string | null }
): boolean {
  const hora = (h: string | null) => h?.slice(0, 5) ?? null;
  return (
    a.tipo === b.tipo &&
    a.fecha_desde === b.fecha_desde &&
    a.fecha_hasta === b.fecha_hasta &&
    a.dia_semana === b.dia_semana &&
    hora(a.hora_desde) === hora(b.hora_desde) &&
    hora(a.hora_hasta) === hora(b.hora_hasta) &&
    (a.grupo_id ?? null) === (b.grupo_id ?? null) &&
    [...(a.excepciones ?? [])].sort().join() === [...(b.excepciones ?? [])].sort().join()
  );
}

/**
 * Lo que queda de un rango al liberar un día: la parte de antes y la de
 * después (cada una como rango, o puntual si queda de un solo día), con el
 * mismo horario. Si el día no está en el rango, devuelve el rango igual.
 */
export function partirRango(b: Bloqueo, fecha: string): BloqueoNuevo[] {
  if (b.tipo !== "rango" || fecha < b.fecha_desde! || fecha > b.fecha_hasta!) {
    return [
      {
        tipo: b.tipo,
        fecha_desde: b.fecha_desde,
        fecha_hasta: b.fecha_hasta,
        dia_semana: b.dia_semana,
        hora_desde: b.hora_desde,
        hora_hasta: b.hora_hasta,
      },
    ];
  }
  const anterior = (f: string) => {
    const d = new Date(f + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  const tramo = (desde: string, hasta: string): BloqueoNuevo => ({
    tipo: desde === hasta ? "puntual" : "rango",
    fecha_desde: desde,
    fecha_hasta: desde === hasta ? null : hasta,
    dia_semana: null,
    hora_desde: b.hora_desde,
    hora_hasta: b.hora_hasta,
  });
  const partes: BloqueoNuevo[] = [];
  if (fecha > b.fecha_desde!) partes.push(tramo(b.fecha_desde!, anterior(fecha)));
  if (fecha < b.fecha_hasta!) partes.push(tramo(diaSiguiente(fecha), b.fecha_hasta!));
  return partes;
}

/**
 * Lo que queda de un bloqueo al liberar un solo día: un rango se parte en
 * dos (ver partirRango), un "todos los <día>" suma esa fecha a sus
 * excepciones y un día puntual desaparece.
 */
export function liberarDia(b: Bloqueo, fecha: string): BloqueoNuevo[] {
  if (b.tipo === "puntual") return [];
  if (b.tipo === "rango") return partirRango(b, fecha);
  return [
    {
      tipo: b.tipo,
      fecha_desde: null,
      fecha_hasta: null,
      dia_semana: b.dia_semana,
      hora_desde: b.hora_desde,
      hora_hasta: b.hora_hasta,
      excepciones: [...new Set([...(b.excepciones ?? []), fecha])].sort(),
    },
  ];
}
