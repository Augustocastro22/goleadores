"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { IconClose } from "@/components/icons";
import { usePushSubscription } from "@/lib/push/use-push-subscription";

const DISMISSED_KEY = "push-banner-dismissed";

/** Cartel para activar notificaciones desde el inicio, para quien nunca entra a Perfil. */
export default function PushBanner() {
  const { estado, working, error, activar } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    async function cargar() {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    }
    cargar();
  }, []);

  if (estado !== "inactivo" || dismissed) return null;

  function ocultar() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  return (
    <Card className="mb-4 flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Activá las notificaciones</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Enterate al toque cuando se arma un partido o se abre la votación.
        </p>
        {error && <p className="mt-1 text-xs text-danger-400">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" size="sm" onClick={activar} disabled={working}>
          {working ? "Activando..." : "Activar"}
        </Button>
        <button
          type="button"
          onClick={ocultar}
          aria-label="Ocultar"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
