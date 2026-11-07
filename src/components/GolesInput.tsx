"use client";

import { useRef } from "react";
import { tap } from "@/lib/haptics";

/**
 * Cantidad de goles con botones de − y + grandes (en el celular es más
 * cómodo que tipear) y el número en el medio, que también se puede escribir.
 * Al sumar, el número salta y el teléfono vibra apenas.
 *
 * El 0 se muestra como placeholder (campo vacío) para que al escribir no
 * quede "10" en vez de "1", y al enfocar se selecciona lo que hay. Vacío
 * cuenta como 0 (también en el form).
 *
 * - "fila": horizontal, para la lista de jugadores.
 * - "marcador": vertical y con el número grande, para el resultado.
 */
export default function GolesInput({
  name,
  value,
  onChange,
  variante = "fila",
  etiqueta = "goles",
}: {
  name?: string;
  value: number;
  onChange: (v: number) => void;
  variante?: "fila" | "marcador";
  /** Para los lectores de pantalla: "goles de Lucho", "goles de Blancos". */
  etiqueta?: string;
}) {
  const numero = useRef<HTMLInputElement>(null);

  function cambiar(nuevo: number) {
    const v = Math.max(0, nuevo);
    if (v === value) return;
    onChange(v);
    tap();
    numero.current?.animate(
      [{ transform: "scale(1)" }, { transform: v > value ? "scale(1.3)" : "scale(0.8)" }, { transform: "scale(1)" }],
      { duration: 260, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.2)" }
    );
  }

  const marcador = variante === "marcador";
  const boton = (signo: "−" | "+") => (
    <button
      type="button"
      onClick={() => cambiar(signo === "+" ? value + 1 : value - 1)}
      disabled={signo === "−" && value === 0}
      aria-label={`${signo === "+" ? "Sumar" : "Restar"} un gol (${etiqueta})`}
      className={`flex shrink-0 items-center justify-center font-bold transition active:scale-90 disabled:opacity-25 ${
        signo === "+"
          ? "text-primary-400 hover:bg-primary-500/15"
          : "text-zinc-400 hover:bg-white/10 hover:text-white"
      } ${marcador ? "h-8 w-12 rounded-lg text-xl" : "h-9 w-9 rounded-lg text-lg"}`}
    >
      {signo}
    </button>
  );

  return (
    <div
      className={`flex shrink-0 items-center rounded-xl border border-border bg-white/5 ${
        marcador ? "flex-col-reverse p-1" : "p-0.5"
      }`}
    >
      {boton("−")}
      <input
        ref={numero}
        type="number"
        name={name}
        min={0}
        inputMode="numeric"
        placeholder="0"
        aria-label={etiqueta}
        value={value === 0 ? "" : value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
        className={`[appearance:textfield] bg-transparent text-center font-extrabold tabular-nums text-white outline-none placeholder:text-zinc-600 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          marcador ? "w-12 py-0.5 text-3xl" : "w-8 text-base"
        }`}
      />
      {boton("+")}
    </div>
  );
}
