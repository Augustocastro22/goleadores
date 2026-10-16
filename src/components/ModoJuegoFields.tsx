"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import type { AppConfig, ModoJuego } from "@/lib/config";

const OPCIONES: { valor: ModoJuego; titulo: string; detalle: string; ejemplo: string }[] = [
  {
    valor: "equipo",
    titulo: "Somos un equipo",
    detalle: "Jugamos juntos contra otros: torneos, ligas, desafíos.",
    ejemplo: "Martes FC 4 – 3 Los Leones",
  },
  {
    valor: "entre_nosotros",
    titulo: "Entre nosotros",
    detalle: "Nos dividimos en dos equipos: el fulbito de siempre.",
    ejemplo: "Blancos 5 – 4 Negros",
  },
];

/**
 * "¿Cómo juegan?" (campos modo_juego, nombre_equipo_1 y nombre_equipo_2, los
 * lee parseModoJuego): en Admin → Reglas, al crear el grupo y en la pregunta
 * única a los grupos que todavía no eligieron.
 */
export default function ModoJuegoFields({
  inicial,
  sugerido = null,
}: {
  inicial: Pick<AppConfig, "modo_juego" | "nombre_equipo_1" | "nombre_equipo_2">;
  /** Lo que parece según los partidos que ya cargaron (se marca "Parece lo suyo"). */
  sugerido?: ModoJuego | null;
}) {
  const [modo, setModo] = useState<ModoJuego | null>(inicial.modo_juego);

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-sm font-semibold text-white">¿Cómo juegan?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPCIONES.map((o) => {
          const elegido = modo === o.valor;
          return (
            <label
              key={o.valor}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3.5 transition ${
                elegido ? "border-primary-500/50 bg-primary-500/10" : "border-border bg-white/5 hover:border-border-strong"
              }`}
            >
              <input
                type="radio"
                name="modo_juego"
                value={o.valor}
                checked={elegido}
                onChange={() => setModo(o.valor)}
                required
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold ${elegido ? "text-primary-400" : "text-white"}`}>{o.titulo}</span>
                {sugerido === o.valor && !elegido && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-zinc-300">Parece lo suyo</span>
                )}
              </span>
              <span className="text-xs text-zinc-400">{o.detalle}</span>
              <span className="mt-1 text-xs text-zinc-500">Ej.: {o.ejemplo}</span>
            </label>
          );
        })}
      </div>

      {modo === "entre_nosotros" ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-white">Nombres de los equipos</span>
          <div className="flex items-center gap-2">
            <Input name="nombre_equipo_1" defaultValue={inicial.nombre_equipo_1} maxLength={30} placeholder="Blancos" />
            <span className="shrink-0 text-xs text-zinc-500">vs</span>
            <Input name="nombre_equipo_2" defaultValue={inicial.nombre_equipo_2} maxLength={30} placeholder="Negros" />
          </div>
          <span className="text-xs text-zinc-500">Los ves en cada partido. Ej.: Blancos y Negros, Pecheras y Sin pecheras.</span>
        </div>
      ) : (
        // Se mantienen al cambiar de modo, para no perderlos si vuelven a "Entre nosotros".
        <>
          <input type="hidden" name="nombre_equipo_1" value={inicial.nombre_equipo_1} />
          <input type="hidden" name="nombre_equipo_2" value={inicial.nombre_equipo_2} />
        </>
      )}
      {modo && (
        <p className="text-xs text-zinc-500">
          {modo === "equipo"
            ? "Si algún día juegan entre ustedes, en ese partido se puede armar con dos equipos."
            : "Si algún día juegan contra otro equipo, en ese partido se puede poner el rival."}
        </p>
      )}
    </fieldset>
  );
}
