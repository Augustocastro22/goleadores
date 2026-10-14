"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { IconClose, IconDownload, IconShare } from "@/components/icons";

type Formato = "historia" | "cuadrado";

const FORMATOS: { id: Formato; label: string }[] = [
  { id: "historia", label: "Historia" },
  { id: "cuadrado", label: "Cuadrado" },
];

interface Imagen {
  /** /api/compartir?que=... sin el formato (lo agrega la hoja). */
  ruta: string;
  /** Para el menú de compartir del celular. */
  titulo: string;
  /** Nombre del archivo, sin ".png". */
  archivo: string;
}

/**
 * La hoja de abajo para compartir una imagen: vista previa, formato
 * (historia o cuadrado) y "Compartir" (el menú del celular: WhatsApp,
 * historias...) o "Descargar". La imagen se pide apenas se abre, así al
 * tocar "Compartir" ya está lista: iOS solo deja abrir el menú si es justo
 * después del toque, sin esperar una descarga en el medio.
 */
export function HojaCompartir({ ruta, titulo, archivo, onCerrar }: Imagen & { onCerrar: () => void }) {
  const [formato, setFormato] = useState<Formato>("historia");
  const [imagen, setImagen] = useState<{ formato: Formato; archivo: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [puedeCompartir, setPuedeCompartir] = useState(false);

  useEffect(() => {
    const control = new AbortController();
    let url: string | null = null;
    async function cargar() {
      setError(null);
      try {
        const res = await fetch(`${ruta}&formato=${formato}`, { signal: control.signal });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const file = new File([blob], `${archivo}-${formato}.png`, { type: "image/png" });
        url = URL.createObjectURL(blob);
        setImagen({ formato, archivo: file, url });
        setPuedeCompartir(typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));
      } catch {
        if (!control.signal.aborted) setError("No se pudo armar la imagen. Probá de nuevo.");
      }
    }
    cargar();
    return () => {
      control.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [ruta, archivo, formato]);

  // Escape cierra, como cualquier hoja.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const lista = imagen?.formato === formato ? imagen : null;

  async function compartir() {
    if (!lista) return;
    try {
      await navigator.share({ files: [lista.archivo], title: titulo });
    } catch (e) {
      // Cerrar el menú sin elegir nada no es un error.
      if ((e as Error).name !== "AbortError") setError("No se pudo compartir. Probá con Descargar.");
    }
  }

  function descargar() {
    if (!lista) return;
    const a = document.createElement("a");
    a.href = lista.url;
    a.download = lista.archivo.name;
    a.click();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-border bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">{titulo}</p>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="flex h-[42vh] items-center justify-center">
          {lista ? (
            // eslint-disable-next-line @next/next/no-img-element -- es un blob recién generado, no una imagen del sitio
            <img src={lista.url} alt="Vista previa" className="max-h-full max-w-full rounded-xl border border-border" />
          ) : error ? (
            <p className="text-center text-sm text-danger-400">{error}</p>
          ) : (
            <div
              className={`animate-pulse rounded-xl bg-white/5 ${formato === "historia" ? "aspect-[9/16] h-full" : "aspect-square w-3/4"}`}
            />
          )}
        </div>

        <div className="my-4 flex rounded-xl border border-border bg-white/5 p-1">
          {FORMATOS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormato(f.id)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition ${
                formato === f.id ? "bg-primary-500/15 text-primary-400" : "text-zinc-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {lista && error && <p className="mb-2 text-center text-sm text-danger-400">{error}</p>}
        <div className="flex flex-col gap-2">
          {puedeCompartir && (
            <Button type="button" onClick={compartir} disabled={!lista}>
              <IconShare className="h-4 w-4" /> Compartir
            </Button>
          )}
          <Button type="button" variant={puedeCompartir ? "secondary" : "primary"} onClick={descargar} disabled={!lista}>
            <IconDownload className="h-4 w-4" /> Descargar imagen
          </Button>
        </div>
      </div>
    </div>
  );
}

/** El ícono chico de compartir (al lado de un título) que abre la hoja. */
export function BotonCompartir({ className = "", ...imagen }: Imagen & { className?: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label={`Compartir: ${imagen.titulo}`}
        title="Compartir"
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white ${className}`}
      >
        <IconShare className="h-[18px] w-[18px]" />
      </button>
      {abierta && <HojaCompartir {...imagen} onCerrar={() => setAbierta(false)} />}
    </>
  );
}

