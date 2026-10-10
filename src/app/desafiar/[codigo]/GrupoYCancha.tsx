"use client";

import { useState } from "react";
import type { Cancha } from "@/lib/canchas";
import { Label } from "@/components/ui/Input";
import CanchaInput from "@/components/CanchaInput";

/**
 * Desde qué grupo se desafía y el lugar: las canchas que se sugieren son las
 * del grupo elegido. `children` va en el medio (fecha y hora).
 */
export default function GrupoYCancha({
  grupos,
  preseleccionadoId,
  canchas,
  children,
}: {
  grupos: { id: string; nombre: string }[];
  preseleccionadoId?: string;
  canchas: Cancha[];
  children: React.ReactNode;
}) {
  const [grupoId, setGrupoId] = useState(preseleccionadoId ?? grupos[0]?.id ?? "");

  return (
    <>
      {grupos.length === 1 ? (
        <input type="hidden" name="grupo_id" value={grupos[0].id} />
      ) : (
        <Label>
          Desafiar desde
          <select
            name="grupo_id"
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
            className="w-full appearance-none rounded-xl border border-border bg-white/5 px-3.5 py-2.5 text-white outline-none transition focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
          >
            {grupos.map((g) => (
              <option key={g.id} value={g.id} className="bg-surface">
                {g.nombre}
              </option>
            ))}
          </select>
        </Label>
      )}
      {children}
      <Label>
        Lugar
        <CanchaInput key={grupoId} canchas={canchas.filter((c) => c.grupo_id === grupoId)} required />
      </Label>
    </>
  );
}
