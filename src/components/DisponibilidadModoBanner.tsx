"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconAvailability } from "@/components/icons";
import Button from "@/components/ui/Button";
import type { ModoDisponibilidad } from "@/lib/types";
import { guardarModoDisponibilidad } from "@/lib/actions/disponibilidad";

/**
 * Pregunta única para quien ya había cargado su disponibilidad antes de que
 * hubiera modos: lo que marcó era cuándo no puede, así que lo que dejó sin
 * marcar cuenta como que puede. Puede seguir así o ir a cambiarlo.
 */
export default function DisponibilidadModoBanner() {
  const router = useRouter();
  const [oculto, setOculto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (oculto) return null;

  async function elegir(modo: ModoDisponibilidad) {
    setGuardando(true);
    setError(null);
    const result = await guardarModoDisponibilidad(modo);
    setGuardando(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    // Para configurar a mano cuándo puede, va a su disponibilidad.
    if (modo === "puedo") router.push("/perfil");
    else setOculto(true);
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
            Marcaste los bloques en los que <span className="font-semibold text-danger-400">no podés</span> jugar.
            ¿Preferís que el resto cuente como que <span className="font-semibold text-primary-400">podés</span>, o
            configurar a mano cuándo <span className="font-semibold text-primary-400">podés</span>?
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Button type="button" size="sm" onClick={() => elegir("no_puedo")} disabled={guardando}>
          {guardando ? "Guardando..." : "Que el resto cuente como que puedo"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => elegir("puedo")} disabled={guardando}>
          Configurar a mano cuándo puedo
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">Lo que ya marcaste no se pierde, y lo podés cambiar cuando quieras.</p>
      {error && <p className="mt-2 text-xs text-danger-400">{error}</p>}
    </div>
  );
}
