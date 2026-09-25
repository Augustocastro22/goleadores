"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { votarEncuesta, eliminarEncuesta } from "@/lib/actions/encuestas";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { IconTrash } from "@/components/icons";

interface OpcionConVotos {
  id: string;
  texto: string;
  votos: number;
}

export default function EncuestaCard({
  encuestaId,
  pregunta,
  creadorApodo,
  cierraEn,
  cerrada,
  opciones,
  miVoto,
  puedoBorrar,
}: {
  encuestaId: string;
  pregunta: string;
  creadorApodo: string;
  cierraEn: string;
  cerrada: boolean;
  opciones: OpcionConVotos[];
  miVoto: string | null;
  puedoBorrar: boolean;
}) {
  const router = useRouter();
  const [votando, setVotando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalVotos = opciones.reduce((sum, o) => sum + o.votos, 0);
  const yaVote = miVoto !== null;
  const soloLectura = cerrada || yaVote;

  async function handleVotar(opcionId: string) {
    setVotando(opcionId);
    setError(null);
    const formData = new FormData();
    formData.set("encuesta_id", encuestaId);
    formData.set("opcion_id", opcionId);
    const result = await votarEncuesta(formData);
    setVotando(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleEliminar() {
    const formData = new FormData();
    formData.set("encuesta_id", encuestaId);
    await eliminarEncuesta(formData);
    router.refresh();
  }

  const fechaCierre = new Date(cierraEn).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-white">{pregunta}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Creada por {creadorApodo} · {cerrada ? "Cerró" : "Cierra"} {fechaCierre}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={cerrada ? "neutral" : "primary"}>{cerrada ? "Cerrada" : "Abierta"}</Badge>
          {puedoBorrar && (
            <form action={handleEliminar}>
              <ConfirmSubmitButton
                confirmMessage="¿Borrar esta encuesta?"
                className="text-zinc-500 hover:text-danger-400"
              >
                <IconTrash className="h-4 w-4" />
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {opciones.map((op) => {
          const pct = totalVotos > 0 ? Math.round((op.votos / totalVotos) * 100) : 0;
          const esMiVoto = miVoto === op.id;
          return (
            <button
              key={op.id}
              type="button"
              disabled={soloLectura || votando !== null}
              onClick={() => handleVotar(op.id)}
              className={`relative overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-default ${
                esMiVoto
                  ? "border-primary-500/50"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <div
                className={`absolute inset-y-0 left-0 ${esMiVoto ? "bg-primary-500/20" : "bg-white/10"}`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <span className={esMiVoto ? "font-semibold text-white" : "text-zinc-200"}>
                  {op.texto}
                </span>
                {(soloLectura || votando) && (
                  <span className="shrink-0 tabular-nums text-zinc-400">
                    {pct}% · {op.votos}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {!soloLectura && (
        <p className="text-xs text-zinc-500">Tocá una opción para votar.</p>
      )}
      {error && <p className="text-xs text-danger-400">{error}</p>}
    </Card>
  );
}
