"use client";

import { IconClose } from "@/components/icons";

export type EquipoElegido = "" | "1" | "2";

/**
 * Equipo de un jugador al crear el partido (campo "equipo-<id>": "1", "2" o
 * vacío = no juega). Tocar el equipo marcado, o la ✕, lo saca. Contra otro
 * equipo (`soloUno`) hay un solo botón, "Juega"; entre ellos, uno por equipo
 * con su nombre.
 */
export default function EquipoPicker({
  jugadorId,
  apodo,
  equipo,
  onChange,
  soloUno = false,
  nombres = ["Eq. 1", "Eq. 2"],
}: {
  jugadorId: string;
  apodo: string;
  equipo: EquipoElegido;
  onChange: (equipo: EquipoElegido) => void;
  soloUno?: boolean;
  /** Los nombres de los dos equipos, para los botones. */
  nombres?: [string, string];
}) {
  const alternar = (e: "1" | "2") => onChange(equipo === e ? "" : e);
  const boton = (e: "1" | "2", texto: string, colores: string) => (
    <button
      type="button"
      onClick={() => alternar(e)}
      aria-pressed={equipo === e}
      className={`max-w-24 truncate rounded-lg border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition ${
        equipo === e ? colores : "border-border text-zinc-400 hover:text-white"
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div className="flex shrink-0 gap-1.5">
      <input type="hidden" name={`equipo-${jugadorId}`} value={equipo} />
      {boton("1", soloUno ? "Juega" : nombres[0], "border-primary-500/40 bg-primary-500/10 text-primary-400")}
      {!soloUno && boton("2", nombres[1], "border-gold-500/40 bg-gold-500/10 text-gold-400")}
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
