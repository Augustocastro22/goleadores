"use client";

import { useState } from "react";
import { IconChevronRight } from "@/components/icons";

export interface Candidato {
  id: string;
  nombre: string;
}

/**
 * Los selects de Mejor y Peor Jugador. A quien elegiste en una categoría no
 * lo podés elegir en la otra (tampoco si ya lo votaste antes).
 */
export default function VotoSelects({
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
