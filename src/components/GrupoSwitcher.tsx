"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cambiarGrupo } from "@/lib/actions/grupos";
import GrupoLogo from "./ui/GrupoLogo";
import { IconChevronRight, IconPlus } from "./icons";

export interface GrupoOpcion {
  id: string;
  nombre: string;
  logo_url: string | null;
}

/**
 * Nombre del grupo activo en la barra de arriba. Al tocarlo abre un menú
 * para cambiar a otro grupo sin pasar por /grupos.
 */
export default function GrupoSwitcher({
  grupos,
  activoId,
}: {
  grupos: GrupoOpcion[];
  activoId: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const activo = grupos.find((g) => g.id === activoId) ?? null;

  // Cerrar al tocar afuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const alTocarAfuera = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    const conEscape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", alTocarAfuera);
    document.addEventListener("keydown", conEscape);
    return () => {
      document.removeEventListener("pointerdown", alTocarAfuera);
      document.removeEventListener("keydown", conEscape);
    };
  }, [abierto]);

  // Al navegar o al terminar de cambiar de grupo se cierra (ajuste de estado
  // durante el render, como recomienda React, en vez de un efecto).
  const claveNavegacion = `${pathname}|${activoId}`;
  const [claveAnterior, setClaveAnterior] = useState(claveNavegacion);
  if (claveNavegacion !== claveAnterior) {
    setClaveAnterior(claveNavegacion);
    setAbierto(false);
    setCambiando(null);
  }

  return (
    // flex en el contenedor para que el botón pueda achicarse y truncar el
    // nombre (si no, se desborda por debajo de los links de la barra).
    <div ref={ref} className="relative flex min-w-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        title="Cambiar de grupo"
        className="flex max-w-full min-w-0 items-center gap-1.5 rounded-lg py-1 pr-1.5 text-base font-extrabold tracking-tight text-white transition hover:bg-white/5"
      >
        {activo ? (
          <GrupoLogo src={activo.logo_url} nombre={activo.nombre} size={28} />
        ) : (
          <span className="text-lg">⚽</span>
        )}
        <span className="truncate">{activo?.nombre ?? "Goleadores"}</span>
        <IconChevronRight
          className={`h-4 w-4 shrink-0 text-zinc-500 transition ${abierto ? "-rotate-90" : "rotate-90"}`}
        />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute top-full left-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50"
        >
          {grupos.length > 0 && (
            <div className="py-1">
              <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                Tus grupos
              </p>
              {grupos.map((g) => {
                const esActivo = g.id === activoId;
                return (
                  <form
                    key={g.id}
                    action={cambiarGrupo}
                    onSubmit={(e) => {
                      if (esActivo) {
                        e.preventDefault();
                        setAbierto(false);
                      } else {
                        setCambiando(g.id);
                      }
                    }}
                  >
                    <input type="hidden" name="grupo_id" value={g.id} />
                    <input type="hidden" name="volver_a" value={pathname} />
                    <button
                      type="submit"
                      role="menuitem"
                      disabled={cambiando !== null}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/5 disabled:opacity-60 ${
                        esActivo ? "bg-primary-500/5" : ""
                      }`}
                    >
                      <GrupoLogo src={g.logo_url} nombre={g.nombre} size={32} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                        {cambiando === g.id ? "Entrando..." : g.nombre}
                      </span>
                      {esActivo && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary-400" aria-label="Grupo actual" />
                      )}
                    </button>
                  </form>
                );
              })}
            </div>
          )}
          <Link
            href="/grupos"
            role="menuitem"
            className="flex items-center gap-3 border-t border-border px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-zinc-400">
              <IconPlus className="h-4 w-4" />
            </span>
            Crear o sumarme a un grupo
          </Link>
        </div>
      )}
    </div>
  );
}
