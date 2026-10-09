/**
 * Desafíos entre grupos (ver supabase/migrations/0022_desafios.sql a
 * 0024_desafios_completo.sql y docs/plan-desafios.md). Lo que se decide sin
 * ir a la base: en qué estado se muestra un desafío, en qué sección va y qué
 * puede hacer el admin. La base valida lo mismo de nuevo.
 */

import { calcularResultado } from "@/lib/resultado";
import { partidoYaPaso } from "@/lib/confirmacion";

export type EstadoDesafio = "pendiente" | "aceptado" | "suspendido" | "rechazado" | "cancelado" | "vencido";

/**
 * Un pendiente cuya fecha ya pasó se muestra como vencido aunque en la base
 * siga pendiente (se pasa a vencido al crear otro desafío o en el cron).
 */
export type EstadoVisible = EstadoDesafio;

export type ResultadoEstado = "sin_cargar" | "en_discusion" | "verificado" | "sin_verificar";

/** Un desafío visto desde uno de los dos grupos (lo que devuelve get_desafios). */
export interface DesafioVista {
  id: string;
  estado: EstadoDesafio;
  fecha: string;
  hora: string | null;
  lugar: string;
  created_at: string;
  soy_desafiante: boolean;
  /** null si el otro grupo ya no existe. */
  rival_id: string | null;
  rival_nombre: string;
  rival_logo_url: string | null;
  /** El partido de este grupo (solo si se aceptó). */
  partido_id: string | null;
  cancelado_por_mi_grupo: boolean | null;
  /** Si alguno de los dos grupos ya cargó goles o hay resultado en juego. */
  resultado_cargado: boolean;
  suspendido_por_mi_grupo: boolean | null;
  /** Fecha nueva propuesta (null si no hay ninguna). */
  propuesta_fecha: string | null;
  propuesta_hora: string | null;
  propuesta_lugar: string | null;
  propuesta_es_mia: boolean | null;
  propuesta_vence_en: string | null;
  resultado_estado: ResultadoEstado;
  /** Mi versión del marcador: la verificada, o mi última propuesta (null si no hay). */
  marcador_mios: number | null;
  marcador_rival: number | null;
  /** La propuesta de resultado que espera respuesta (null si no hay). */
  resultado_pendiente_mios: number | null;
  resultado_pendiente_rival: number | null;
  resultado_pendiente_es_mio: boolean | null;
  resultado_pendiente_vence_en: string | null;
  /** Si los dos grupos ya dieron su versión del resultado. */
  ambos_propusieron: boolean;
}

type D<K extends keyof DesafioVista> = Pick<DesafioVista, K>;

export type SeccionDesafio = "responder" | "enviados" | "proximos" | "historial";

export function estadoVisible(d: D<"estado" | "fecha">, hoy: string): EstadoVisible {
  return d.estado === "pendiente" && d.fecha < hoy ? "vencido" : d.estado;
}

const enJuego = (estado: EstadoVisible) => estado === "aceptado" || estado === "suspendido";

/** Solo el desafiado responde, y solo mientras está pendiente y no venció. */
export function puedeResponder(d: D<"estado" | "fecha" | "soy_desafiante">, hoy: string): boolean {
  return !d.soy_desafiante && estadoVisible(d, hoy) === "pendiente";
}

/**
 * El desafiante cancela mientras está pendiente (el desafiado rechaza);
 * cualquiera de los dos una vez aceptado o suspendido, mientras no hay
 * resultado. Lo mismo que valida cancelar_desafio en la base.
 */
export function puedeCancelar(
  d: D<"estado" | "fecha" | "soy_desafiante" | "resultado_cargado">,
  hoy: string
): boolean {
  const estado = estadoVisible(d, hoy);
  if (estado === "pendiente") return d.soy_desafiante;
  return enJuego(estado) && !d.resultado_cargado;
}

/** Suspender: un aceptado, mientras no hay resultado. */
export function puedeSuspender(d: D<"estado" | "resultado_cargado">): boolean {
  return d.estado === "aceptado" && !d.resultado_cargado;
}

/** Proponer otra fecha: aceptado o suspendido, mientras no hay resultado. */
export function puedeReprogramar(d: D<"estado" | "resultado_cargado">): boolean {
  return enJuego(d.estado) && !d.resultado_cargado;
}

/** Aceptar o rechazar la fecha que propuso el otro grupo. */
export function puedeResponderFecha(d: D<"estado" | "propuesta_es_mia">): boolean {
  return enJuego(d.estado) && d.propuesta_es_mia === false;
}

/** Cargar (o contraproponer) el resultado: después del partido, mientras no quedó cerrado. */
export function puedeCargarResultado(
  d: D<"estado" | "fecha" | "hora" | "resultado_estado">,
  ahora: Date = new Date()
): boolean {
  return (
    d.estado === "aceptado" &&
    (d.resultado_estado === "sin_cargar" || d.resultado_estado === "en_discusion") &&
    partidoYaPaso(d.fecha, d.hora, ahora)
  );
}

/** Confirmar el resultado que cargó el otro grupo. */
export function puedeConfirmarResultado(d: D<"resultado_estado" | "resultado_pendiente_es_mio">): boolean {
  return d.resultado_estado === "en_discusion" && d.resultado_pendiente_es_mio === false;
}

/** "No nos ponemos de acuerdo": cuando los dos grupos ya dieron su versión. */
export function puedeCortar(d: D<"resultado_estado" | "ambos_propusieron">): boolean {
  return d.resultado_estado === "en_discusion" && d.ambos_propusieron;
}

/** Si hay algo que el admin de este grupo tiene que responder. */
export function esperaMiRespuesta(
  d: D<"estado" | "fecha" | "soy_desafiante" | "propuesta_es_mia" | "resultado_estado" | "resultado_pendiente_es_mio">,
  hoy: string
): boolean {
  return puedeResponder(d, hoy) || puedeResponderFecha(d) || puedeConfirmarResultado(d);
}

/** Dónde va en /partidos/desafios: lo que espera respuesta, lo que viene y lo que ya pasó. */
export function seccionDesafio(
  d: D<"estado" | "fecha" | "soy_desafiante" | "propuesta_es_mia" | "resultado_estado" | "resultado_pendiente_es_mio">,
  hoy: string
): SeccionDesafio {
  if (esperaMiRespuesta(d, hoy)) return "responder";
  const estado = estadoVisible(d, hoy);
  if (estado === "pendiente") return "enviados";
  if (enJuego(estado) && (d.resultado_estado === "sin_cargar" || d.resultado_estado === "en_discusion")) {
    return "proximos";
  }
  return "historial";
}

/** Historial contra cada grupo: ganados, empatados y perdidos verificados, y los sin verificar. */
export interface HistorialRival {
  rivalNombre: string;
  rivalLogoUrl: string | null;
  ganados: number;
  empatados: number;
  perdidos: number;
  sinVerificar: number;
}

export function historialDesafios(
  desafios: D<"rival_id" | "rival_nombre" | "rival_logo_url" | "resultado_estado" | "marcador_mios" | "marcador_rival">[]
): HistorialRival[] {
  const porRival = new Map<string, HistorialRival>();
  for (const d of desafios) {
    if (d.resultado_estado !== "verificado" && d.resultado_estado !== "sin_verificar") continue;
    const clave = d.rival_id ?? `nombre:${d.rival_nombre}`;
    const fila = porRival.get(clave) ?? {
      rivalNombre: d.rival_nombre,
      rivalLogoUrl: d.rival_logo_url,
      ganados: 0,
      empatados: 0,
      perdidos: 0,
      sinVerificar: 0,
    };
    if (d.resultado_estado === "sin_verificar") {
      fila.sinVerificar += 1;
    } else if (d.marcador_mios !== null && d.marcador_rival !== null) {
      const r = calcularResultado(d.marcador_mios, d.marcador_rival);
      if (r === "G") fila.ganados += 1;
      else if (r === "E") fila.empatados += 1;
      else fila.perdidos += 1;
    }
    porRival.set(clave, fila);
  }
  return [...porRival.values()].sort(
    (a, b) =>
      b.ganados + b.empatados + b.perdidos + b.sinVerificar - (a.ganados + a.empatados + a.perdidos + a.sinVerificar) ||
      a.rivalNombre.localeCompare(b.rivalNombre, "es")
  );
}

/**
 * El código de desafío dentro de lo que pegó el admin: puede pegar el
 * mensaje entero de "Compartir" ("Desafiá a X ... con este código: abc").
 * Los códigos son 10 caracteres hexa; si no hay ninguno, lo pegado tal cual.
 */
export function extraerCodigo(texto: string): string {
  const codigos = texto.match(/\b[0-9a-f]{10}\b/gi);
  return codigos ? codigos[codigos.length - 1].toLowerCase() : texto.trim();
}

export const ESTADO_DESAFIO_LABEL: Record<EstadoVisible, string> = {
  pendiente: "Pendiente",
  aceptado: "Aceptado",
  suspendido: "Suspendido",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

/** "12 de octubre a las 20:00" (sin hora si no tiene). */
export function fechaDesafio(fecha: string, hora: string | null): string {
  const dia = new Date(fecha + "T00:00:00").toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
  });
  return hora ? `${dia} a las ${hora.slice(0, 5)}` : dia;
}

/** "12 de octubre" de un timestamp (para "se acepta sola el ..."). */
export function diaDe(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}
