"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { MAX_MIN_JUGADORES, type AppConfig } from "@/lib/config";

/**
 * Campos de las reglas de votación de un grupo (los lee parseConfig). Se usan
 * al crear el grupo y en Admin → Reglas.
 */
export default function ReglasFields({ inicial }: { inicial: AppConfig }) {
  const [votacionActiva, setVotacionActiva] = useState(inicial.votacion_activa);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-2.5 text-sm text-zinc-300">
        <input
          type="checkbox"
          name="votacion_activa"
          checked={votacionActiva}
          onChange={(e) => setVotacionActiva(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500"
        />
        <span>
          Votar Mejor y Peor Jugador
          <span className="block text-xs font-normal text-zinc-500">
            Después de cada partido los que jugaron votan, y se arma el ranking de MVP y de Peor
            Jugador. Si lo apagás, el grupo solo lleva goles y partidos.
          </span>
        </span>
      </label>

      {votacionActiva ? (
        <label className="ml-6.5 flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
          Mínimo de jugadores para votar
          <Input
            type="number"
            name="min_jugadores_votacion"
            min={0}
            max={MAX_MIN_JUGADORES}
            required
            defaultValue={inicial.min_jugadores_votacion}
            className="max-w-28"
          />
          <span className="text-xs font-normal text-zinc-500">
            Si en un partido juegan menos, ese partido no tiene votación. Cuentan los dos equipos.
            0 = sin mínimo.
          </span>
        </label>
      ) : (
        <input type="hidden" name="min_jugadores_votacion" value={inicial.min_jugadores_votacion} />
      )}
    </div>
  );
}
