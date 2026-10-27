"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { IconChevronRight, IconClose, IconDownload, IconShare } from "@/components/icons";

type Formato = "historia" | "cuadrado";

const FORMATOS: { id: Formato; label: string }[] = [
  { id: "historia", label: "Historia" },
  { id: "cuadrado", label: "Cuadrado" },
];

export interface Imagen {
  /** /api/compartir?que=... sin el formato (lo agrega la hoja). */
  ruta: string;
  /** Para el menú de compartir del celular. */
  titulo: string;
  /** Nombre del archivo, sin ".png". */
  archivo: string;
  /** Otras maneras de ver lo mismo (podio o lista, apodos o nombres, el fondo...): se eligen en la hoja. */
  opciones?: OpcionImagen[];
}

export interface OpcionImagen {
  /** El parámetro que se agrega a la ruta. */
  param: string;
  /** La primera es la que viene elegida (o la última que eligió en este celular, si `recordar`). */
  items: { id: string; label: string }[];
  /** Acordarse de lo elegido para la próxima vez (el color y el diseño: cada grupo suele querer siempre el mismo). */
  recordar?: boolean;
  /**
   * Dónde se muestra. Por defecto, una fila de botones a la vista. "paleta": el selector de color
   * del celular (en vez de `items`). "chips": los diseños, chicos y en la misma fila que la paleta.
   * "ajuste": plegada en "Ajustes", para lo que se elige una vez y no se toca más (apodos o nombres).
   */
  modo?: "paleta" | "chips" | "ajuste";
  /** El rótulo de la opción cuando está en Ajustes. */
  titulo?: string;
  /** Con "paleta": el color con el que arranca (6 dígitos hex, sin "#"). */
  paletaInicial?: string;
}

const esHex6 = (valor: string) => /^[0-9a-f]{6}$/i.test(valor);

/** La paleta: un círculo con el color actual y un borde de arcoíris; abre el selector de color del celular. */
function PuntoPaleta({ color, onElegir }: { color: string; onElegir: (hex: string) => void }) {
  const [pendiente, setPendiente] = useState<string | null>(null);

  // El selector avisa mientras se arrastra: se espera a que se quede quieto para no pedir una imagen por cada tono.
  useEffect(() => {
    if (!pendiente) return;
    const t = setTimeout(() => {
      onElegir(pendiente);
      setPendiente(null);
    }, 450);
    return () => clearTimeout(t);
  }, [pendiente, onElegir]);

  const mostrado = pendiente ?? color;
  return (
    <label
      title="Elegir el color del equipo"
      className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full p-[3px] transition active:scale-95"
      style={{ background: "conic-gradient(#f87171, #fbbf24, #34d399, #38bdf8, #a78bfa, #f472b6, #f87171)" }}
    >
      <span className="h-full w-full rounded-full border-2 border-surface" style={{ backgroundColor: `#${mostrado}` }} />
      <span className="sr-only">Elegir el color del equipo</span>
      <input
        type="color"
        value={`#${mostrado}`}
        onChange={(e) => setPendiente(e.target.value.slice(1))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}

const claveGuardada = (param: string) => `compartir-${param}`;

/** Lo elegido al abrir la hoja: lo recordado si sigue siendo una opción, y si no, la primera. */
function elegidasIniciales(opciones: OpcionImagen[] = []): Record<string, string> {
  const elegidas: Record<string, string> = {};
  for (const o of opciones) {
    let id = o.items[0]?.id ?? o.paletaInicial ?? "";
    if (o.recordar) {
      try {
        const guardada = localStorage.getItem(claveGuardada(o.param));
        const valida = o.modo === "paleta" ? esHex6(guardada ?? "") : o.items.some((i) => i.id === guardada);
        if (guardada && valida) id = guardada;
      } catch {
        // Sin storage, la primera.
      }
    }
    elegidas[o.param] = id;
  }
  return elegidas;
}

/**
 * La hoja de abajo para compartir una imagen: vista previa, formato
 * (historia o cuadrado) y "Compartir" (el menú del celular: WhatsApp,
 * historias...) o "Descargar". La imagen se pide apenas se abre, así al
 * tocar "Compartir" ya está lista: iOS solo deja abrir el menú si es justo
 * después del toque, sin esperar una descarga en el medio.
 */
export function HojaCompartir({ ruta, titulo, archivo, opciones, onCerrar }: Imagen & { onCerrar: () => void }) {
  const [formato, setFormato] = useState<Formato>("historia");
  const [elegidas, setElegidas] = useState(() => elegidasIniciales(opciones));
  // Qué imagen es (formato y opciones): la que está lista tiene que ser justo la que se pidió.
  const extra = (opciones ?? []).map((o) => `&${o.param}=${encodeURIComponent(elegidas[o.param])}`).join("");
  const clave = `${formato}${extra}`;
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  // Una opción con una sola alternativa no se muestra: no hay nada que elegir.
  const conAlternativas = (opciones ?? []).filter((o) => o.items.length > 1);
  const paleta = (opciones ?? []).find((o) => o.modo === "paleta");
  const chips = conAlternativas.find((o) => o.modo === "chips");
  const enAjustes = conAlternativas.filter((o) => o.modo === "ajuste");
  const visibles = conAlternativas.filter((o) => !o.modo);

  function elegir(o: OpcionImagen, id: string) {
    setElegidas((actuales) => ({ ...actuales, [o.param]: id }));
    if (o.recordar) {
      try {
        localStorage.setItem(claveGuardada(o.param), id);
      } catch {
        // Sin storage no se recuerda, y listo.
      }
    }
  }
  const [imagen, setImagen] = useState<{ clave: string; archivo: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [puedeCompartir, setPuedeCompartir] = useState(false);

  useEffect(() => {
    const control = new AbortController();
    let url: string | null = null;
    async function cargar() {
      setError(null);
      try {
        const res = await fetch(`${ruta}&formato=${formato}${extra}`, { signal: control.signal });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const nombre = [archivo, ...(opciones ?? []).map((o) => elegidas[o.param]), formato].filter(Boolean).join("-");
        const file = new File([blob], `${nombre}.png`, { type: "image/png" });
        url = URL.createObjectURL(blob);
        setImagen({ clave, archivo: file, url });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `clave`, `extra` y `elegidas` cambian juntas con `clave`
  }, [ruta, archivo, clave]);

  // Escape cierra, como cualquier hoja.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const lista = imagen?.clave === clave ? imagen : null;

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
        className="max-h-[96dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
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

        <div className="flex h-[34vh] items-center justify-center">
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

        {/* Lo que se toca seguido, a la vista: el color (paleta) con el diseño, y qué mostrar (botones). */}
        <div className="mt-2 flex flex-col gap-2">
          {(paleta || chips) && (
            <div className="flex items-center gap-2.5">
              {paleta && <PuntoPaleta color={elegidas[paleta.param]} onElegir={(hex) => elegir(paleta, hex)} />}
              {chips && (
                <div className="flex-1">
                  <Selector items={chips.items} actual={elegidas[chips.param]} onChange={(id) => elegir(chips, id)} />
                </div>
              )}
            </div>
          )}
          {visibles.map((o) => (
            <Selector key={o.param} items={o.items} actual={elegidas[o.param]} onChange={(id) => elegir(o, id)} />
          ))}
        </div>

        {/* Lo que casi nunca cambia, plegado: el formato (historia por defecto) y los ajustes. */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {enAjustes.length > 0 ? (
            <button
              type="button"
              onClick={() => setAjustesAbiertos((v) => !v)}
              aria-expanded={ajustesAbiertos}
              className="flex items-center gap-1 text-xs font-semibold text-zinc-400 transition hover:text-white"
            >
              Ajustes
              <IconChevronRight className={`h-3.5 w-3.5 transition ${ajustesAbiertos ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <span />
          )}
          <div className="flex rounded-lg border border-border bg-white/5 p-0.5">
            {FORMATOS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormato(f.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  formato === f.id ? "bg-primary-500/15 text-primary-400" : "text-zinc-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {ajustesAbiertos && (
          <div className="mt-2 flex flex-col gap-2">
            {enAjustes.map((o) => (
              <div key={o.param} className="flex flex-col gap-1">
                <p className="text-xs text-zinc-500">{o.titulo}</p>
                <Selector items={o.items} actual={elegidas[o.param]} onChange={(id) => elegir(o, id)} />
              </div>
            ))}
          </div>
        )}
        <div className="h-3" />

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

/** Dos o tres opciones en una fila, una elegida. */
function Selector<T extends string>({
  items,
  actual,
  onChange,
}: {
  items: { id: T; label: string; color?: string }[];
  actual: string;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex rounded-xl border border-border bg-white/5 p-1">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => onChange(i.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold transition ${
            actual === i.id ? "bg-primary-500/15 text-primary-400" : "text-zinc-400 hover:text-white"
          }`}
        >
          {i.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.color }} />}
          {i.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Lo que abre la hoja: el ícono chico de compartir (al lado de un título) o,
 * con `etiqueta`, un botón con texto, para cuando el ícono solo no se nota.
 */
export function BotonCompartir({
  className = "",
  etiqueta,
  ...imagen
}: Imagen & { className?: string; etiqueta?: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label={`Compartir: ${imagen.titulo}`}
        title="Compartir"
        className={
          etiqueta
            ? `inline-flex items-center gap-2 rounded-xl border border-border-strong bg-white/5 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/10 ${className}`
            : `flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white ${className}`
        }
      >
        <IconShare className="h-[18px] w-[18px]" />
        {etiqueta}
      </button>
      {abierta && <HojaCompartir {...imagen} onCerrar={() => setAbierta(false)} />}
    </>
  );
}

