"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { MAX_NOMBRE_EQUIPO } from "@/lib/config";

/**
 * Los nombres de los dos equipos de un partido entre ellos: vienen escritos
 * (los últimos que usó el grupo) y con "Cambiar nombres" se editan para este
 * partido. Van en los campos "nombre_equipo" y "rival" (el segundo equipo).
 */
export default function NombresEquipos({
  nombres,
  onChange,
  accion,
}: {
  nombres: [string, string];
  onChange: (nombres: [string, string]) => void;
  /** Algo más a la derecha del título (el link para cambiar de modo). */
  accion?: React.ReactNode;
}) {
  const [editando, setEditando] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name="nombre_equipo" value={nombres[0]} />
      <input type="hidden" name="rival" value={nombres[1]} />
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-zinc-300">
          {nombres[0]} vs {nombres[1]}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          {!editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-xs font-semibold text-zinc-400 hover:text-white"
            >
              Cambiar nombres
            </button>
          )}
          {accion}
        </div>
      </div>
      {editando && (
        <div className="flex items-center gap-2">
          <Input
            aria-label="Nombre del primer equipo"
            value={nombres[0]}
            maxLength={MAX_NOMBRE_EQUIPO}
            onChange={(e) => onChange([e.target.value, nombres[1]])}
          />
          <span className="shrink-0 text-xs text-zinc-500">vs</span>
          <Input
            aria-label="Nombre del segundo equipo"
            value={nombres[1]}
            maxLength={MAX_NOMBRE_EQUIPO}
            onChange={(e) => onChange([nombres[0], e.target.value])}
          />
        </div>
      )}
    </div>
  );
}
