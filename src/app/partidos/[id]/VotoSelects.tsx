"use client";

import { useState } from "react";
import { IconChevronRight } from "@/components/icons";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import Card from "@/components/ui/Card";
import { votarPartido } from "@/lib/actions/votos";

export interface Candidato {
  id: string;
  nombre: string;
}

/**
 * La votación de un partido abierto. Si ya votó todo lo que se vota, muestra
 * a quién votó (el voto no se cambia: votado, queda).
 */
export default function VotacionForm({
  partidoId,
  candidatos,
  conMvp,
  conPeor,
  votoMvpId,
  votoPeorId,
}: {
  partidoId: string;
  candidatos: Candidato[];
  conMvp: boolean;
  conPeor: boolean;
  votoMvpId: string | null;
  votoPeorId: string | null;
}) {
  const yaVoto = (!conMvp || votoMvpId !== null) && (!conPeor || votoPeorId !== null);
  const nombreDe = (id: string | null) => candidatos.find((c) => c.id === id)?.nombre ?? "?";

  if (yaVoto) {
    return (
      <Card className="flex flex-col gap-2 px-4 py-3 text-sm">
        <p className="text-zinc-400">Ya votaste en este partido:</p>
        {conMvp && (
          <p className="text-zinc-300">
            Mejor Jugador: <span className="font-semibold text-white">{nombreDe(votoMvpId)}</span>
          </p>
        )}
        {conPeor && (
          <p className="text-zinc-300">
            Peor Jugador: <span className="font-semibold text-white">{nombreDe(votoPeorId)}</span>
          </p>
        )}
      </Card>
    );
  }
  if (candidatos.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4 p-4">
      <ActionForm action={votarPartido} className="flex flex-col gap-4">
        <input type="hidden" name="partido_id" value={partidoId} />
        <VotoSelects
          candidatos={candidatos}
          conMvp={conMvp}
          conPeor={conPeor}
          votoMvpId={votoMvpId}
          votoPeorId={votoPeorId}
        />
        <SubmitButton pendingText="Votando..." size="sm" className="self-start">
          Votar
        </SubmitButton>
        <p className="text-xs text-zinc-500">Una vez que votás, el voto queda.</p>
      </ActionForm>
    </Card>
  );
}

/**
 * Los selects de Mejor y Peor Jugador. Una categoría ya votada no se vuelve a
 * votar. A quien elegiste en una categoría no lo podés elegir en la otra.
 */
function VotoSelects({
  candidatos,
  conMvp,
  conPeor,
  votoMvpId,
  votoPeorId,
}: {
  candidatos: Candidato[];
  conMvp: boolean;
  conPeor: boolean;
  votoMvpId: string | null;
  votoPeorId: string | null;
}) {
  const [mvp, setMvp] = useState(votoMvpId ?? "");
  const [peor, setPeor] = useState(votoPeorId ?? "");

  return (
    <>
      {conMvp &&
        (votoMvpId ? (
          <p className="text-sm text-zinc-500">Ya votaste Mejor Jugador en este partido.</p>
        ) : (
          <VotoSelect
            label="Mejor Jugador"
            name="mvp_jugador_id"
            candidatos={candidatos}
            value={mvp}
            onChange={setMvp}
            excluido={peor}
          />
        ))}
      {conPeor &&
        (votoPeorId ? (
          <p className="text-sm text-zinc-500">Ya votaste Peor Jugador en este partido.</p>
        ) : (
          <VotoSelect
            label="Peor Jugador"
            name="peor_jugador_id"
            candidatos={candidatos}
            value={peor}
            onChange={setPeor}
            excluido={mvp}
          />
        ))}
    </>
  );
}

function VotoSelect({
  label,
  name,
  candidatos,
  value,
  onChange,
  excluido,
}: {
  label: string;
  name: string;
  candidatos: Candidato[];
  value: string;
  onChange: (v: string) => void;
  /** El elegido en la otra categoría. */
  excluido: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <label className="text-sm font-semibold text-zinc-300 sm:w-32 sm:shrink-0">{label}</label>
      <div className="relative flex-1">
        <select
          name={name}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-border bg-white/5 py-2.5 pr-9 pl-3.5 text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
        >
          <option value="" disabled className="bg-surface">
            Elegí un jugador...
          </option>
          {candidatos
            .filter((c) => c.id !== excluido)
            .map((c) => (
              <option key={c.id} value={c.id} className="bg-surface">
                {c.nombre}
              </option>
            ))}
        </select>
        <IconChevronRight className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 rotate-90 text-zinc-500" />
      </div>
    </div>
  );
}
