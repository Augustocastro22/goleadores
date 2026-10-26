"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import PushInstrucciones from "@/components/PushInstrucciones";
import { IconBell } from "@/components/icons";
import { usePushSubscription, type PushEstado } from "@/lib/push/use-push-subscription";

const DISMISSED_KEY = "push-banner-dismissed-at";
/** Si lo dejan para más tarde, vuelve a aparecer pasado este tiempo. */
const REAPARECE_MS = 3 * 24 * 60 * 60 * 1000;

/** Los casos en que se puede hacer algo para recibirlas (los demás, en Perfil). */
const ESTADOS_VISIBLES: PushEstado[] = ["inactivo", "requiere-instalar", "navegador-app"];

/** Cartel para activar notificaciones desde el inicio, para quien nunca entra a Perfil. */
export default function PushBanner() {
  const { estado, plataforma, working, error, activar } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const desde = Number(localStorage.getItem(DISMISSED_KEY));
        setDismissed(desde > 0 && Date.now() - desde < REAPARECE_MS);
      } catch {
        setDismissed(false);
      }
    }
    cargar();
  }, []);

  if (!ESTADOS_VISIBLES.includes(estado) || dismissed) return null;

  function masTarde() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Sin storage se oculta igual hasta recargar.
    }
    setDismissed(true);
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-primary-500/40 bg-gradient-to-br from-primary-500/15 to-primary-500/5 p-4 shadow-lg shadow-primary-500/10">
      <div className="flex items-start gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-primary-400">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary-500/20" />
          <IconBell className="relative h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-white">No te pierdas el partido</p>
          <p className="mt-0.5 text-sm text-zinc-300">
            Sin notificaciones no te enterás cuando te convocan, y podés quedar afuera.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <span className="text-lg">⚽</span>
        <div className="min-w-0 text-xs">
          <p className="font-semibold text-white">Te convocaron al partido del jueves</p>
          <p className="text-zinc-500">Confirmá tu lugar antes de que lo ocupen</p>
        </div>
      </div>

      {estado === "inactivo" ? (
        <Button type="button" onClick={activar} disabled={working} className="mt-3 w-full">
          {working ? "Activando..." : "Activar notificaciones"}
        </Button>
      ) : (
        <PushInstrucciones estado={estado} plataforma={plataforma} className="mt-3 text-xs text-zinc-300" />
      )}
      {error && <p className="mt-2 text-xs text-danger-400">{error}</p>}

      <button
        type="button"
        onClick={masTarde}
        className="mt-2 w-full py-1 text-center text-xs text-zinc-500 transition hover:text-zinc-300"
      >
        Más tarde
      </button>
    </div>
  );
}
