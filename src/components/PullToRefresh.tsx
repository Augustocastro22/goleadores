"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconRefresh } from "./icons";

/** Cuánto hay que tirar (ya amortiguado) para que recargue, y el tope. */
const UMBRAL = 70;
const MAXIMO = 110;

/** Abierta desde el ícono de la pantalla de inicio: ahí el navegador no trae "tirar para actualizar". */
function esAppInstalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Si el gesto empieza sobre algo que se arrastra (los jugadores de la
 * formación, con touch-action) o dentro de algo con scroll propio que no
 * está arriba de todo, es de eso y no para recargar.
 */
function esDeOtraCosa(objetivo: EventTarget | null) {
  for (let el = objetivo instanceof Element ? objetivo : null; el && el !== document.body; el = el.parentElement) {
    const estilo = getComputedStyle(el);
    if (estilo.touchAction !== "auto" && estilo.touchAction !== "manipulation") return true;
    if (/(auto|scroll)/.test(estilo.overflowY) && el.scrollTop > 0) return true;
  }
  return false;
}

/**
 * "Tirar para actualizar" en la app instalada: arriba de todo, se desliza
 * hacia abajo y la pantalla se vuelve a pedir al servidor (router.refresh,
 * sin recargar la página entera).
 */
export default function PullToRefresh() {
  const router = useRouter();
  const [activo, setActivo] = useState(false);
  const [tirado, setTirado] = useState(0);
  const [arriba, setArriba] = useState(0);
  const [recargando, startTransition] = useTransition();
  const inicio = useRef<number | null>(null);
  const tiradoRef = useRef(0);

  useEffect(() => {
    async function ver() {
      setActivo(esAppInstalada());
    }
    ver();
  }, []);

  useEffect(() => {
    if (!activo) return;

    function mover(valor: number) {
      tiradoRef.current = valor;
      setTirado(valor);
    }
    function onStart(e: TouchEvent) {
      inicio.current =
        window.scrollY <= 0 && e.touches.length === 1 && !esDeOtraCosa(e.target) ? e.touches[0].clientY : null;
      // Aparece justo debajo de la barra de arriba.
      if (inicio.current !== null) setArriba(document.querySelector("header")?.getBoundingClientRect().bottom ?? 0);
    }
    function onMove(e: TouchEvent) {
      if (inicio.current === null) return;
      const dy = e.touches[0].clientY - inicio.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (tiradoRef.current) mover(0);
        return;
      }
      // Mientras se tira hacia abajo desde arriba, que iOS no haga su rebote.
      e.preventDefault();
      mover(Math.min(MAXIMO, dy * 0.5));
    }
    function onEnd() {
      if (inicio.current === null) return;
      inicio.current = null;
      if (tiradoRef.current >= UMBRAL) startTransition(() => router.refresh());
      mover(0);
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [activo, router]);

  if (!activo || (tirado === 0 && !recargando)) return null;

  const listo = recargando || tirado >= UMBRAL;
  const bajada = (recargando ? UMBRAL : tirado) * 0.7;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
      style={{
        top: arriba,
        transform: `translateY(${bajada - 28}px)`,
        opacity: recargando ? 1 : Math.min(1, tirado / UMBRAL),
      }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-lg">
        <IconRefresh
          aria-label={recargando ? "Actualizando" : undefined}
          className={`h-5 w-5 ${listo ? "text-primary-400" : "text-zinc-400"} ${recargando ? "animate-spin" : ""}`}
          style={recargando ? undefined : { transform: `rotate(${tirado * 3}deg)` }}
        />
      </div>
    </div>
  );
}
