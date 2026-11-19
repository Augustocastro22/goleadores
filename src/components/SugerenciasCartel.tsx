"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { enviarMensajeContacto } from "@/lib/actions/contacto";
import Button, { buttonClass } from "@/components/ui/Button";
import { IconClose, IconFeedback } from "@/components/icons";

type Resultado = { error?: string; success?: boolean } | null;

/**
 * Clave por usuario: en un celular compartido, cada uno lo ve una vez. La usa
 * también el formulario de /contacto, así quien ya mandó una sugerencia por
 * ahí no lo vuelve a ver.
 */
export function claveSugerenciasCartel(userId: string) {
  return `sugerencias-cartel-cerrado:${userId}`;
}

/** Marca el cartel como visto para siempre (lo cerró o ya mandó algo). */
export function marcarSugerenciasCartelVisto(userId: string) {
  try {
    localStorage.setItem(claveSugerenciasCartel(userId), String(Date.now()));
  } catch {
    // Sin storage se oculta igual hasta recargar.
  }
}

/**
 * Invitación a mandar una idea, flotando abajo de Partidos. Sale una sola
 * vez: al cerrarlo o al mandar la sugerencia no vuelve a aparecer.
 */
export default function SugerenciasCartel({
  userId,
  nombre,
  email,
}: {
  userId: string;
  nombre: string;
  email: string;
}) {
  const [oculto, setOculto] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [estado, formAction, pending] = useActionState<Resultado, FormData>(
    (_prev, formData) => enviarMensajeContacto(formData),
    null
  );

  useEffect(() => {
    async function cargar() {
      try {
        setOculto(Boolean(localStorage.getItem(claveSugerenciasCartel(userId))));
      } catch {
        setOculto(false);
      }
    }
    cargar();
  }, [userId]);

  useEffect(() => {
    if (estado?.success) marcarSugerenciasCartelVisto(userId);
  }, [estado, userId]);

  if (oculto) return null;

  function cerrar() {
    marcarSugerenciasCartelVisto(userId);
    setOculto(true);
  }

  return (
    <div
      role="dialog"
      aria-label="Sugerencias"
      // En la esquina de abajo a la derecha: arriba de la barra en el celular; en la compu, pegado al borde.
      className={`fixed right-4 bottom-[calc(max(env(safe-area-inset-bottom),14px)_+_4.75rem)] z-30 md:right-6 md:bottom-6 ${
        abierto ? "w-[min(20rem,calc(100vw-2rem))]" : "w-60"
      }`}
    >
      <div className="entrada rounded-2xl border border-primary-500/50 bg-surface/95 p-3 shadow-xl shadow-primary-500/15 ring-1 ring-black/40 backdrop-blur-lg">
        <div className="flex items-start gap-2.5">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-primary-400">
            {/* Un pulso suave para que se note sin ocupar lugar. */}
            {!estado?.success && <span className="absolute inset-0 animate-ping rounded-full bg-primary-500/20" />}
            <IconFeedback className="relative h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-tight font-bold text-white">
              {estado?.success ? "¡Gracias por la idea!" : "¿Qué le mejorarías?"}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-zinc-400">
              {estado?.success ? "La leemos y te escribimos si hace falta." : "Contanos una idea o algo que no te ande."}
            </p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="-mt-1 -mr-1 shrink-0 rounded-lg p-1 text-zinc-500 transition hover:bg-white/5 hover:text-white"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {estado?.success ? null : abierto ? (
          <form
            className="mt-2.5 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              formData.set("motivo", "idea");
              formData.set("nombre", nombre);
              formData.set("email", email);
              startTransition(() => formAction(formData));
            }}
          >
            <textarea
              name="mensaje"
              required
              maxLength={2000}
              rows={3}
              autoFocus
              placeholder="Contanos qué te gustaría que hiciera la app."
              // Sin text-sm: con menos de 16px el iPhone hace zoom al escribir.
              className="w-full rounded-xl border border-border bg-white/5 px-3 py-2 text-white outline-none transition placeholder:text-zinc-500 focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
            />
            {/* Campo trampa para bots, como en /contacto. */}
            <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            {estado?.error && <p className="text-xs text-danger-400">{estado.error}</p>}
            <div className="flex items-center justify-between gap-2">
              <Link href="/contacto?motivo=falla" className="text-xs text-zinc-500 underline hover:text-white">
                ¿Algo no funciona?
              </Link>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-2.5">
            {nombre && email ? (
              <Button type="button" size="sm" onClick={() => setAbierto(true)} className="w-full">
                Mandar una idea
              </Button>
            ) : (
              // Sin nombre o email no se puede mandar desde acá: el formulario completo los pide.
              <Link href="/contacto?motivo=idea" className={buttonClass("primary", "sm", "w-full")}>
                Mandar una idea
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
