"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PushInstrucciones from "@/components/PushInstrucciones";
import { IconClose } from "@/components/icons";
import { usePushSubscription, type PushEstado } from "@/lib/push/use-push-subscription";

const DISMISSED_KEY = "push-banner-dismissed";

/** Los casos en que se puede hacer algo para recibirlas (los demás, en Perfil). */
const ESTADOS_VISIBLES: PushEstado[] = ["inactivo", "requiere-instalar", "navegador-app"];

/** Cartel para activar notificaciones desde el inicio, para quien nunca entra a Perfil. */
export default function PushBanner() {
  const { estado, plataforma, working, error, activar } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
      } catch {
        setDismissed(false);
      }
    }
    cargar();
  }, []);

  if (!ESTADOS_VISIBLES.includes(estado) || dismissed) return null;

  function ocultar() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Sin storage se oculta igual hasta recargar.
    }
    setDismissed(true);
  }

  return (
    <Card className="mb-4 flex items-start gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Activá las notificaciones</p>
        {estado === "inactivo" ? (
          <p className="mt-0.5 text-xs text-zinc-500">
            Enterate al toque cuando te convocan o se abre la votación.
          </p>
        ) : (
          <PushInstrucciones estado={estado} plataforma={plataforma} className="mt-1 text-xs text-zinc-500" />
        )}
        {estado === "inactivo" && (
          <Button type="button" size="sm" onClick={activar} disabled={working} className="mt-3">
            {working ? "Activando..." : "Activar"}
          </Button>
        )}
        {error && <p className="mt-1 text-xs text-danger-400">{error}</p>}
      </div>
      <button
        type="button"
        onClick={ocultar}
        aria-label="Ocultar"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
      >
        <IconClose className="h-4 w-4" />
      </button>
    </Card>
  );
}
