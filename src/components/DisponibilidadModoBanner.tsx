"use client";

import Link from "next/link";
import { useState } from "react";
import { IconAvailability } from "@/components/icons";
import Button, { buttonClass } from "@/components/ui/Button";
import { guardarModoDisponibilidad } from "@/lib/actions/disponibilidad";

/**
 * Pregunta única para quien ya había cargado su disponibilidad antes de que
 * hubiera modos: lo que marcó era cuándo no puede, así que lo que dejó sin
 * marcar cuenta como que puede. Puede seguir así o ir a cambiarlo.
 */
export default function DisponibilidadModoBanner() {
  const [oculto, setOculto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (oculto) return null;

  async function seguirAsi() {
    setGuardando(true);
    setError(null);
    const result = await guardarModoDisponibilidad("no_puedo");
    setGuardando(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setOculto(true);
  }

  return (
    <div className="mb-4 rounded-2xl border border-primary-500/30 bg-primary-500/5 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-400">
          <IconAvailability className="h-6 w-6" />
        </span>
        <div className="min-w-0 text-xs">
          <p className="text-sm font-semibold text-white">Tu disponibilidad</p>
          <p className="mt-0.5 text-zinc-400">
            Lo que marcaste era cuándo <span className="font-semibold text-danger-400">no podés</span> jugar, y lo
            que no marcaste cuenta como que <span className="font-semibold text-primary-400">podés</span>. ¿Seguimos
            así?
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button type="button" size="sm" onClick={seguirAsi} disabled={guardando} className="flex-1">
          {guardando ? "Guardando..." : "Sí, seguir así"}
        </Button>
        <Link href="/perfil" className={`${buttonClass("secondary", "sm")} flex-1`}>
          Cambiar la configuración
        </Link>
      </div>
      {error && <p className="mt-2 text-xs text-danger-400">{error}</p>}
    </div>
  );
}
