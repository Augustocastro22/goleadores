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
import { calcularResultado, RESULTADO_LABEL, type Resultado } from "@/lib/resultado";
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

const RESULTADO_VARIANT: Record<Resultado, BadgeVariant> = {
  G: "primary",
  E: "neutral",
  P: "danger",
};

/** Qué está pasando con un desafío, en una o dos líneas (fecha propuesta, resultado). */
export function novedadesDesafio(d: DesafioVista): string[] {
  const lineas: string[] = [];
  if (d.estado === "suspendido") {
    lineas.push(d.suspendido_por_mi_grupo ? "Lo suspendieron ustedes." : `Lo suspendió ${d.rival_nombre}.`);
  }
  // Con resultado la propuesta de otra fecha ya no va (la base la descarta).
  if (d.propuesta_fecha && !d.resultado_cargado) {
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
  miGrupo,
}: {
  desafio: DesafioVista;
  hoy: string;
  esAdmin: boolean;
  /** El grupo desde el que se mira. */
  grupoId: string;
  /** Para el cara a cara: el escudo y el nombre del grupo propio. */
  miGrupo: { nombre: string; logoUrl: string | null };
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
  // Jugado y con el resultado acordado: el resultado reemplaza a "Aceptado" en el badge.
  const resultado =
    d.resultado_estado === "verificado" && d.marcador_mios !== null && d.marcador_rival !== null
      ? calcularResultado(d.marcador_mios, d.marcador_rival)
      : null;
  const novedades = novedadesDesafio(d).filter((linea) => !resultado || !linea.startsWith(RESULTADO_LABEL[resultado]));

  const conMarcador = d.marcador_mios !== null && d.marcador_rival !== null && d.resultado_estado !== "sin_cargar";
  return (
    <Card className="flex flex-col gap-3 overflow-hidden p-0">
      {/* Cara a cara: los dos escudos enfrentados, cada uno con su color, y el VS (o el resultado) al medio. */}
      <div
        className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-4 pb-3"
        style={{
          background:
            "linear-gradient(115deg, rgba(16,185,129,0.20) 0%, rgba(16,185,129,0.04) 46%, rgba(251,191,36,0.04) 54%, rgba(251,191,36,0.18) 100%)",
        }}
      >
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rotate-12 bg-white/10" />
        <div className="vs-izq flex min-w-0 flex-col items-center gap-1.5">
          <GrupoLogo src={miGrupo.logoUrl} nombre={miGrupo.nombre} size={48} />
          <span className="max-w-full truncate text-xs font-bold text-white">{miGrupo.nombre}</span>
        </div>
        <div className="vs-centro relative flex flex-col items-center">
          {conMarcador ? (
            <span className="font-mono text-3xl font-extrabold tabular-nums text-white">
              {d.marcador_mios}
              <span className="mx-1 text-zinc-500">-</span>
              {d.marcador_rival}
            </span>
          ) : (
            <span className="text-3xl font-black tracking-tighter text-white italic">
              V<span className="text-gold-400">S</span>
            </span>
          )}
          {resultado ? (
            <Badge variant={RESULTADO_VARIANT[resultado]} className="mt-1 !px-2 !py-0.5">
              {RESULTADO_LABEL[resultado]}
            </Badge>
          ) : (
            <Badge variant={ESTADO_VARIANT[estado]} className="mt-1 !px-2 !py-0.5">
              {ESTADO_DESAFIO_LABEL[estado]}
            </Badge>
          )}
        </div>
        <div className="vs-der flex min-w-0 flex-col items-center gap-1.5">
          <GrupoLogo src={d.rival_logo_url} nombre={d.rival_nombre} size={48} />
          <span className="max-w-full truncate text-xs font-bold text-white">{d.rival_nombre}</span>
        </div>
      </div>
      <div className="px-4">
        <p className="text-sm text-zinc-400">
          {fechaDesafio(d.fecha, d.hora)} · {d.lugar}
        </p>
        <p className="truncate text-xs text-zinc-600">{detalle}</p>
        {novedades.map((linea) => (
          <p key={linea} className="mt-1 text-xs text-gold-400">
            {linea}
          </p>
        ))}
      </div>

      {(responder || cancelar || d.partido_id) && (
        <div className="flex flex-wrap items-start gap-2 px-4">
          {responder && <ResponderDesafio desafioId={d.id} rival={d.rival_nombre} />}
          {d.partido_id && (
            <Link
              href={`/partidos/${d.partido_id}`}
              transitionTypes={["adelante"]}
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
      <div className="h-1" />
    </Card>
  );
}
