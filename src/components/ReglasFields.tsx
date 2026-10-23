"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import { MAX_MIN_JUGADORES, type AppConfig } from "@/lib/config";
import ModoJuegoFields from "@/components/ModoJuegoFields";

/**
 * Campos de las reglas de un grupo: cómo juegan, votación y confirmación de los convocados
 * (los lee parseConfig). Se usan
 * al crear el grupo y en Admin → Reglas.
 */
export default function ReglasFields({
  inicial,
  sinModoJuego = false,
}: {
  inicial: AppConfig;
  /** Cuando "¿Cómo juegan?" se muestra aparte (al crear el grupo). */
  sinModoJuego?: boolean;
}) {
  const [votaMvp, setVotaMvp] = useState(inicial.vota_mvp);
  const [votaPeor, setVotaPeor] = useState(inicial.vota_peor);
  const [pedirConfirmacion, setPedirConfirmacion] = useState(inicial.pedir_confirmacion);

  return (
    <div className="flex flex-col gap-3">
      {!sinModoJuego && (
        <div className="mb-1 border-b border-border pb-4">
          <ModoJuegoFields inicial={inicial} />
        </div>
      )}
      <CategoriaCheckbox
        name="vota_mvp"
        checked={votaMvp}
        onChange={setVotaMvp}
        titulo="Votar Mejor Jugador"
        detalle="Después de cada partido los que jugaron votan al mejor, y se arma el ranking de MVP."
      />
      <CategoriaCheckbox
        name="vota_peor"
        checked={votaPeor}
        onChange={setVotaPeor}
        titulo="Votar Peor Jugador"
        detalle="Después de cada partido los que jugaron votan al peor, y se arma el ranking de Peor Jugador."
      />
      {!votaMvp && !votaPeor && (
        <p className="text-xs text-zinc-500">Sin votaciones, el grupo solo lleva goles y partidos.</p>
      )}

      {votaMvp || votaPeor ? (
        <label className="flex flex-col gap-1.5 text-sm font-medium text-white">
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

      <div className="mt-1 border-t border-border pt-4">
        <CategoriaCheckbox
          name="pedir_confirmacion"
          checked={pedirConfirmacion}
          onChange={setPedirConfirmacion}
          titulo="Pedir confirmación a los convocados"
          detalle="Cada convocado tiene que decir si juega. Los que dicen que no quedan afuera; los que no respondan los definís vos al cargar el resultado."
        />
      </div>
    </div>
  );
}

function CategoriaCheckbox({
  name,
  checked,
  onChange,
  titulo,
  detalle,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <Switch name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} titulo={titulo} detalle={detalle} />
  );
}
