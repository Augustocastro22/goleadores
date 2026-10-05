"use client";

import { useRef } from "react";

/**
 * Botón de submit que antes pide confirmación en un cuadro propio (<dialog>).
 * No usa window.confirm(): algunos navegadores (el panel de la app de
 * escritorio, los navegadores dentro de WhatsApp/Instagram) no lo muestran y
 * lo dan por cancelado, y el botón parece no hacer nada.
 *
 * El <dialog> queda dentro del <form>, así que su botón de confirmar envía
 * ese mismo form.
 */
export default function ConfirmSubmitButton({
  confirmMessage,
  confirmLabel = "Confirmar",
  className,
  title,
  children,
}: {
  confirmMessage: string;
  /** Texto del botón que confirma (ej: "Salir", "Eliminar"). */
  confirmLabel?: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cerrar = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        title={title}
        className={className}
        onClick={() => dialogRef.current?.showModal()}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        // Tocar el fondo oscuro (fuera del cuadro) cancela.
        onClick={(e) => e.target === dialogRef.current && cerrar()}
        className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-left text-zinc-100 shadow-2xl shadow-black/60 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-5 p-5">
          <p className="text-sm leading-relaxed whitespace-normal text-zinc-200">{confirmMessage}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cerrar}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              onClick={cerrar}
              className="rounded-xl border border-danger-500/30 bg-danger-500/15 px-4 py-2 text-sm font-semibold text-danger-400 transition hover:bg-danger-500/25"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
