import Link from "next/link";
import {
  ESTADO_DESAFIO_LABEL,
  estadoVisible,
  fechaDesafio,
  puedeCancelar,
  puedeResponder,
  type DesafioVista,
  type EstadoVisible,
} from "@/lib/desafios";
import Card from "@/components/ui/Card";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import GrupoLogo from "@/components/ui/GrupoLogo";
import { buttonClass } from "@/components/ui/Button";
import { CancelarDesafio, ResponderDesafio } from "./AccionesDesafio";

const ESTADO_VARIANT: Record<EstadoVisible, BadgeVariant> = {
  pendiente: "gold",
  aceptado: "primary",
  rechazado: "danger",
  cancelado: "neutral",
  vencido: "neutral",
};

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

  let detalle = d.soy_desafiante ? "Los desafiaron ustedes" : "Los desafiaron a ustedes";
  if (estado === "cancelado") {
    detalle = d.cancelado_por_mi_grupo ? "Lo cancelaron ustedes" : `Lo canceló ${d.rival_nombre}`;
  }

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
        </div>
      </div>

      {(responder || cancelar || d.partido_id) && (
        <div className="flex flex-wrap items-start gap-2">
          {responder && <ResponderDesafio desafioId={d.id} rival={d.rival_nombre} />}
          {d.partido_id && (
            <Link href={`/partidos/${d.partido_id}`} className={buttonClass("secondary", "sm")}>
              Ver partido
            </Link>
          )}
          {cancelar && (
            <CancelarDesafio desafioId={d.id} grupoId={grupoId} rival={d.rival_nombre} aceptado={d.estado === "aceptado"} />
          )}
        </div>
      )}
    </Card>
  );
}
