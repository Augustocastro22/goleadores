"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconAvailability } from "@/components/icons";
import { buttonClass } from "@/components/ui/Button";

const DISMISSED_KEY = "disponibilidad-banner-dismissed-at";
const NADA_KEY = "disponibilidad-banner-nada";
/** Si lo dejan para más tarde, vuelve a aparecer pasado este tiempo. */
const REAPARECE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cartel para quien todavía no marcó nunca cuándo no puede jugar, así el
 * grupo puede armar horarios con datos. Quien siempre puede lo descarta
 * para siempre con "No tengo nada que marcar".
 */
export default function DisponibilidadBanner() {
  const [oculto, setOculto] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        if (localStorage.getItem(NADA_KEY)) return;
        const desde = Number(localStorage.getItem(DISMISSED_KEY));
        setOculto(desde > 0 && Date.now() - desde < REAPARECE_MS);
      } catch {
        setOculto(false);
      }
    }
    cargar();
  }, []);

  if (oculto) return null;

  function ocultar(clave: string, valor: string) {
    try {
      localStorage.setItem(clave, valor);
    } catch {
      // Sin storage se oculta igual hasta recargar.
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
          <p className="text-sm font-semibold text-white">¿Cuándo podés jugar?</p>
          <p className="mt-0.5 text-zinc-400">
            Marcalo y el grupo elige un horario que le sirva a todos.
          </p>
        </div>
      </div>
      <Link href="/perfil" className={`${buttonClass("primary", "sm")} mt-3 w-full`}>
        Marcar mi disponibilidad
      </Link>
      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <button
          type="button"
          onClick={() => ocultar(DISMISSED_KEY, String(Date.now()))}
          className="py-1 transition hover:text-zinc-300"
        >
          Más tarde
        </button>
        <button
          type="button"
          onClick={() => ocultar(NADA_KEY, "1")}
          className="py-1 transition hover:text-zinc-300"
        >
          No tengo nada que marcar
        </button>
      </div>
    </div>
  );
}
