"use client";

import Link from "next/link";
import { votacionDelPartido, type AppConfig } from "@/lib/config";

export type VotarEnPartido = { mvp: boolean; peor: boolean };

/**
 * Al cargar el resultado (lo que abre la votación), el admin elige qué se
 * vota en ese partido. Arranca con lo que dicen las reglas del grupo y solo
 * deja sacar categorías, no agregar. Van también como campos "votar_mvp" y
 * "votar_peor" ("1"/"0") para los forms (ver createPartido).
 */
export default function VotacionPartidoFields({
  config,
  cantidadJugadores,
  value,
  onChange,
  reglasHref,
}: {
  config: Pick<AppConfig, "vota_mvp" | "vota_peor" | "min_jugadores_votacion">;
  cantidadJugadores: number;
  value: VotarEnPartido;
  onChange: (value: VotarEnPartido) => void;
  reglasHref: string;
}) {
  if (!config.vota_mvp && !config.vota_peor) return null;
  const { con_votacion } = votacionDelPartido(cantidadJugadores, config);

  const categorias = [
    config.vota_mvp && { clave: "mvp" as const, titulo: "Votar Mejor Jugador" },
    config.vota_peor && { clave: "peor" as const, titulo: "Votar Peor Jugador" },
  ].filter((c) => !!c);

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">Votación de este partido</p>
      {con_votacion ? (
        <>
          {categorias.map((c) => (
            <label key={c.clave} className="flex items-center gap-2.5 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={value[c.clave]}
                onChange={(e) => onChange({ ...value, [c.clave]: e.target.checked })}
                className="h-4 w-4 shrink-0 accent-primary-500"
              />
              {c.titulo}
            </label>
          ))}
          <input type="hidden" name="votar_mvp" value={value.mvp ? "1" : "0"} />
          <input type="hidden" name="votar_peor" value={value.peor ? "1" : "0"} />
        </>
      ) : (
        <p className="text-sm text-zinc-500">
          Juegan {cantidadJugadores}, menos que el mínimo para votar ({config.min_jugadores_votacion}): este
          partido no va a tener votación.
        </p>
      )}
      <p className="text-xs text-zinc-500">
        {con_votacion ? "Vale solo para este partido. Para cambiarlo en todos, andá a" : "El mínimo se cambia en"}{" "}
        <Link href={reglasHref} className="text-primary-400 hover:underline">
          las reglas del grupo
        </Link>
        .
      </p>
    </div>
  );
}
