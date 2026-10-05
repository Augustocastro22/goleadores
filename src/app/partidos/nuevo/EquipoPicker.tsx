"use client";

import { IconClose } from "@/components/icons";

export type EquipoElegido = "" | "1" | "2";

/**
 * Equipo de un jugador al crear el partido (campo "equipo-<id>": "1", "2" o
 * vacío = no juega). Tocar el equipo marcado, o la ✕, lo saca.
 */
export default function EquipoPicker({
  jugadorId,
  apodo,
  equipo,
  onChange,
}: {
  jugadorId: string;
  apodo: string;
  equipo: EquipoElegido;
  onChange: (equipo: EquipoElegido) => void;
}) {
  const alternar = (e: "1" | "2") => onChange(equipo === e ? "" : e);

  return (
    <div className="flex shrink-0 gap-1.5">
      <input type="hidden" name={`equipo-${jugadorId}`} value={equipo} />
      <button
        type="button"
        onClick={() => alternar("1")}
        aria-pressed={equipo === "1"}
        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
          equipo === "1"
            ? "border-primary-500/40 bg-primary-500/10 text-primary-400"
            : "border-border text-zinc-400 hover:text-white"
        }`}
      >
        Eq. 1
      </button>
      <button
        type="button"
        onClick={() => alternar("2")}
        aria-pressed={equipo === "2"}
        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
          equipo === "2"
            ? "border-gold-500/40 bg-gold-500/10 text-gold-400"
            : "border-border text-zinc-400 hover:text-white"
        }`}
      >
        Eq. 2
      </button>
      <button
        type="button"
        onClick={() => onChange("")}
        aria-label={`Sacar a ${apodo} del partido`}
        className={`flex w-7 items-center justify-center rounded-lg border border-border text-zinc-500 transition hover:border-danger-500/40 hover:text-danger-400 ${
          equipo ? "" : "invisible"
        }`}
      >
        <IconClose className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
