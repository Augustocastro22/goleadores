import Link from "next/link";
import {
  ESTADO_DESAFIO_LABEL,
  esperaMiRespuesta,
  estadoVisible,
  fechaDesafio,
  puedeCancelar,
  puedeResponder,
  type DesafioVista,
  type EstadoVisible,
} from "@/lib/desafios";
import { calcularResultado, RESULTADO_LABEL } from "@/lib/resultado";
import Card from "@/components/ui/Card";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import GrupoLogo from "@/components/ui/GrupoLogo";
import { buttonClass } from "@/components/ui/Button";
import { CancelarDesafio, ResponderDesafio } from "./AccionesDesafio";

export const ESTADO_VARIANT: Record<EstadoVisible, BadgeVariant> = {
  pendiente: "gold",
  aceptado: "primary",
  suspendido: "gold",
  rechazado: "danger",
  cancelado: "neutral",
  vencido: "neutral",
};

/** Qué está pasando con un desafío, en una o dos líneas (fecha propuesta, resultado). */
export function novedadesDesafio(d: DesafioVista): string[] {
  const lineas: string[] = [];
  if (d.estado === "suspendido") {
    lineas.push(d.suspendido_por_mi_grupo ? "Lo suspendieron ustedes." : `Lo suspendió ${d.rival_nombre}.`);
  }
  if (d.propuesta_fecha) {
    const cuando = `${fechaDesafio(d.propuesta_fecha, d.propuesta_hora)} en ${d.propuesta_lugar}`;
    lineas.push(
      d.propuesta_es_mia
        ? `Propusieron jugarlo el ${cuando}: falta que ${d.rival_nombre} responda.`
        : `${d.rival_nombre} propone jugarlo el ${cuando}.`
    );
  }
  if (d.resultado_estado === "en_discusion" && d.resultado_pendiente_mios !== null) {
    const marcador = `ustedes ${d.resultado_pendiente_mios} – ${d.resultado_pendiente_rival} ${d.rival_nombre}`;
    lineas.push(
      d.resultado_pendiente_es_mio
        ? `Cargaron ${marcador}: falta que lo confirmen.`
        : `${d.rival_nombre} cargó ${marcador}. Confirmalo o corregilo.`
    );
  }
  if (d.resultado_estado === "verificado" && d.marcador_mios !== null && d.marcador_rival !== null) {
    const r = calcularResultado(d.marcador_mios, d.marcador_rival);
    lineas.push(`${RESULTADO_LABEL[r]} ${d.marcador_mios}-${d.marcador_rival}.`);
  }
  if (d.resultado_estado === "sin_verificar") {
    lineas.push(
      `Sin verificar: no hubo acuerdo con el resultado` +
        (d.marcador_mios !== null ? ` (ustedes dicen ${d.marcador_mios}-${d.marcador_rival}).` : ".")
    );
  }
  return lineas;
}

/** Un desafío en /partidos/desafios, con lo que el admin puede hacer. */
export default function DesafioCard({
  desafio: d,
  hoy,
  esAdmin,
  grupoId,
}: {
  desafio: DesafioVista;
  hoy: string;
  esAdmin: boolean;
  /** El grupo desde el que se mira. */
  grupoId: string;
}) {
  const estado = estadoVisible(d, hoy);
  const responder = esAdmin && puedeResponder(d, hoy);
  const cancelar = esAdmin && puedeCancelar(d, hoy);
  // Las fechas y el resultado se responden desde la página del partido.
  const responderEnPartido = esAdmin && !responder && esperaMiRespuesta(d, hoy);

  let detalle = d.soy_desafiante ? "Los desafiaron ustedes" : "Los desafiaron a ustedes";
  if (estado === "cancelado") {
    detalle = d.cancelado_por_mi_grupo ? "Lo cancelaron ustedes" : `Lo canceló ${d.rival_nombre}`;
  }
  const novedades = novedadesDesafio(d);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <GrupoLogo src={d.rival_logo_url} nombre={d.rival_nombre} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-semibold text-white">vs {d.rival_nombre}</p>
            <Badge variant={ESTADO_VARIANT[estado]} className="shrink-0 !px-2 !py-0.5">
              {ESTADO_DESAFIO_LABEL[estado]}
            </Badge>
          </div>
          <p className="text-sm text-zinc-500">
            {fechaDesafio(d.fecha, d.hora)} · {d.lugar}
          </p>
          <p className="truncate text-xs text-zinc-600">{detalle}</p>
          {novedades.map((linea) => (
            <p key={linea} className="mt-1 text-xs text-gold-400">
              {linea}
            </p>
          ))}
        </div>
      </div>

      {(responder || cancelar || d.partido_id) && (
        <div className="flex flex-wrap items-start gap-2">
          {responder && <ResponderDesafio desafioId={d.id} rival={d.rival_nombre} />}
          {d.partido_id && (
            <Link
              href={`/partidos/${d.partido_id}`}
              className={buttonClass(responderEnPartido ? "primary" : "secondary", "sm")}
            >
              {responderEnPartido ? "Responder" : "Ver partido"}
            </Link>
          )}
          {cancelar && (
            <CancelarDesafio desafioId={d.id} grupoId={grupoId} rival={d.rival_nombre} estado={d.estado} />
          )}
        </div>
      )}
    </Card>
  );
}
