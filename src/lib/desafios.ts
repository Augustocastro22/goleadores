/**
 * Desafíos entre grupos (ver supabase/migrations/0022_desafios.sql y
 * docs/plan-desafios.md). Lo que se decide sin ir a la base: en qué estado
 * se muestra un desafío, en qué sección va y qué puede hacer el admin.
 */

export type EstadoDesafio = "pendiente" | "aceptado" | "rechazado" | "cancelado" | "vencido";

/**
 * Un pendiente cuya fecha ya pasó se muestra como vencido aunque en la base
 * siga pendiente (crear_desafio lo pasa a vencido recién cuando hace falta).
 */
export type EstadoVisible = EstadoDesafio;

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
  /** Si alguno de los dos grupos ya cargó el resultado. */
  resultado_cargado: boolean;
}

export type SeccionDesafio = "responder" | "enviados" | "proximos" | "historial";

export function estadoVisible(d: Pick<DesafioVista, "estado" | "fecha">, hoy: string): EstadoVisible {
  return d.estado === "pendiente" && d.fecha < hoy ? "vencido" : d.estado;
}

/** Dónde va en /partidos/desafios: lo que espera respuesta, lo que viene y lo que ya pasó. */
export function seccionDesafio(d: Pick<DesafioVista, "estado" | "fecha" | "soy_desafiante">, hoy: string): SeccionDesafio {
  const estado = estadoVisible(d, hoy);
  if (estado === "pendiente") return d.soy_desafiante ? "enviados" : "responder";
  if (estado === "aceptado" && d.fecha >= hoy) return "proximos";
  return "historial";
}

/** Solo el desafiado responde, y solo mientras está pendiente y no venció. */
export function puedeResponder(d: Pick<DesafioVista, "estado" | "fecha" | "soy_desafiante">, hoy: string): boolean {
  return !d.soy_desafiante && estadoVisible(d, hoy) === "pendiente";
}

/**
 * El desafiante cancela mientras está pendiente (el desafiado rechaza);
 * cualquiera de los dos una vez aceptado, mientras no se cargó el resultado.
 * Lo mismo que valida cancelar_desafio en la base.
 */
export function puedeCancelar(
  d: Pick<DesafioVista, "estado" | "fecha" | "soy_desafiante" | "resultado_cargado">,
  hoy: string
): boolean {
  const estado = estadoVisible(d, hoy);
  if (estado === "pendiente") return d.soy_desafiante;
  return estado === "aceptado" && !d.resultado_cargado;
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
