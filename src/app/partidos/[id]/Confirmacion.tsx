"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Respuesta } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import { IconChevronRight } from "@/components/icons";
import { fijarRespuesta, responderConvocatoria } from "@/lib/actions/partidos";

/**
 * Lo relacionado a la confirmación de los convocados (ver
 * supabase/migrations/0020_confirmacion.sql): el convocado responde si juega,
 * y el admin ve las respuestas y define a los que no respondieron.
 */

const ETIQUETA: Record<Respuesta, string> = {
  juega: "Juega",
  no_juega: "No juega",
  pendiente: "Sin responder",
};

export function RespuestaBadge({ respuesta }: { respuesta: Respuesta }) {
  const variant =
    respuesta === "juega"
      ? "primary"
      : respuesta === "no_juega"
        ? "danger"
        : "neutral";
  return <Badge variant={variant}>{ETIQUETA[respuesta]}</Badge>;
}

/** "8 juegan · 2 no · 3 sin responder" */
export function ResumenRespuestas({ respuestas }: { respuestas: Respuesta[] }) {
  const juegan = respuestas.filter((r) => r === "juega").length;
  const no = respuestas.filter((r) => r === "no_juega").length;
  const pendientes = respuestas.filter((r) => r === "pendiente").length;
  return (
    <p className="text-xs text-zinc-500">
      <span className="font-semibold text-primary-400">
        {juegan} {juegan === 1 ? "juega" : "juegan"}
      </span>
      {no > 0 && (
        <>
          {" "}
          · <span className="font-semibold text-danger-400">{no} no</span>
        </>
      )}
      {pendientes > 0 && <> · {pendientes} sin responder</>}
    </p>
  );
}

function ErrorMsg({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-400">
      {text}
    </p>
  );
}

/** Tarjeta del convocado para decir si juega (y cambiarlo después). */
export function RespuestaCard({
  partidoId,
  respuesta,
}: {
  partidoId: string;
  respuesta: Respuesta;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function responder(juega: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await responderConvocatoria(partidoId, juega);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (respuesta === "pendiente") {
    return (
      <Card className="flex flex-col gap-3 border-primary-500/30 p-4">
        <div>
          <p className="font-semibold text-white">Estás convocado</p>
          <p className="text-sm text-zinc-400">
            Confirmá si jugás para que el admin sepa con quién cuenta.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => responder(true)}
            disabled={pending}
            className="flex-1"
          >
            Juego
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => responder(false)}
            disabled={pending}
            className="flex-1"
          >
            No juego
          </Button>
        </div>
        <ErrorMsg text={error} />
      </Card>
    );
  }

  const juega = respuesta === "juega";
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-3">
        {juega ? (
          <p className="text-sm font-semibold text-primary-400">
            ✓ Confirmaste que jugás.
          </p>
        ) : (
          <p className="text-sm font-semibold text-danger-400">
            Avisaste que no jugás.
          </p>
        )}
        <button
          type="button"
          onClick={() => responder(!juega)}
          disabled={pending}
          className="shrink-0 text-xs font-semibold text-zinc-400 hover:text-white disabled:opacity-50"
        >
          {pending
            ? "Guardando..."
            : juega
              ? "Al final no juego"
              : "Al final juego"}
        </button>
      </div>
      <ErrorMsg text={error} />
    </Card>
  );
}

/**
 * Selector del admin para la respuesta de un convocado, con pinta de badge.
 * Es un <select> nativo para que en el celular abra el selector del sistema.
 */
export function RespuestaSelect({
  partidoId,
  jugadorId,
  respuesta,
}: {
  partidoId: string;
  jugadorId: string;
  respuesta: Respuesta;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useState(respuesta);

  const colores =
    valor === "juega"
      ? "border-primary-500/20 bg-primary-500/15 text-primary-400"
      : valor === "no_juega"
        ? "border-danger-500/20 bg-danger-500/15 text-danger-400"
        : "border-white/10 bg-white/5 text-zinc-400";

  return (
    <span className="relative shrink-0">
      <select
        value={valor}
        disabled={pending}
        aria-label="Respuesta"
        onChange={(e) => {
          const nueva = e.target.value as Respuesta;
          const anterior = valor;
          setValor(nueva);
          startTransition(async () => {
            const result = await fijarRespuesta(partidoId, jugadorId, nueva);
            if (result.error) setValor(anterior);
            else router.refresh();
          });
        }}
        className={`field-sizing-content cursor-pointer appearance-none rounded-full border py-1 pr-6 pl-2.5 text-xs font-medium outline-none disabled:opacity-50 ${colores}`}
      >
        {(Object.keys(ETIQUETA) as Respuesta[]).map((r) => (
          <option key={r} value={r} className="bg-surface text-white">
            {ETIQUETA[r]}
          </option>
        ))}
      </select>
      <IconChevronRight className="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 rotate-90 opacity-70" />
    </span>
  );
}

/**
 * Para el admin, antes de cargar el resultado: los que no respondieron, para
 * definir si jugaron o no.
 */
export function PendientesCard({
  partidoId,
  pendientes,
}: {
  partidoId: string;
  pendientes: { jugadorId: string; apodo: string; fotoUrl: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function definir(jugadorId: string, respuesta: Respuesta) {
    setError(null);
    startTransition(async () => {
      const result = await fijarRespuesta(partidoId, jugadorId, respuesta);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3 border-gold-500/30 p-4">
      <div>
        <p className="font-semibold text-white">
          {pendientes.length === 1
            ? "1 convocado no respondió"
            : `${pendientes.length} convocados no respondieron`}
        </p>
        <p className="text-sm text-zinc-400">
          Antes de cargar el resultado, definí si jugaron. Los que no jugaron
          salen del partido.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {pendientes.map((j) => (
          <div
            key={j.jugadorId}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/5 px-3.5 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar src={j.fotoUrl} alt={j.apodo} size={28} />
              <span className="truncate text-sm text-zinc-200">{j.apodo}</span>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => definir(j.jugadorId, "juega")}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-zinc-300 transition hover:border-primary-500/40 hover:text-primary-400 disabled:opacity-50"
              >
                Jugó
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => definir(j.jugadorId, "no_juega")}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-zinc-300 transition hover:border-danger-500/40 hover:text-danger-400 disabled:opacity-50"
              >
                No jugó
              </button>
            </div>
          </div>
        ))}
      </div>
      <ErrorMsg text={error} />
    </Card>
  );
}
