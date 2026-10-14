"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconRefresh } from "./icons";

/** Cuánto baja la pantalla (ya amortiguado) para que al soltar recargue, y el tope. */
const UMBRAL = 70;
const MAXIMO = 120;
/** Mientras recarga la pantalla queda bajada esto, con la ruedita en el hueco. */
const ALTO_RECARGANDO = 56;
/** Aunque los datos lleguen al toque, la ruedita gira al menos esto: si no, parece que no hizo nada. */
const MINIMO_MS = 600;
const ANIMACION = "transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)";

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

/** Baja (o sube) el contenido de la página, como el rebote nativo. */
function moverContenido(px: number, animado: boolean) {
  const main = document.querySelector("main");
  if (!main) return;
  main.style.transition = animado ? ANIMACION : "none";
  // Sin transform cuando está en su lugar: un transform fijo cambiaría cómo
  // se posicionan los elementos `fixed` de adentro.
  main.style.transform = px ? `translateY(${px}px)` : "";
}

/**
 * "Tirar para actualizar" en la app instalada: arriba de todo, se desliza
 * hacia abajo, la pantalla baja con el dedo y al soltar se vuelve a pedir al
 * servidor (router.refresh, sin recargar la página entera).
 */
export default function PullToRefresh() {
  const router = useRouter();
  const [activo, setActivo] = useState(false);
  const [bajada, setBajada] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [arriba, setArriba] = useState(0);
  const [mostrandoRecarga, setMostrandoRecarga] = useState(false);
  const [recargando, startTransition] = useTransition();
  const inicio = useRef<number | null>(null);
  const bajadaRef = useRef(0);
  const desde = useRef(0);

  useEffect(() => {
    async function ver() {
      setActivo(esAppInstalada());
    }
    ver();
  }, []);

  useEffect(() => {
    if (!activo) return;

    function mover(px: number, animado: boolean) {
      // Al pasar el punto de soltar, un toque de vibración (Android; iOS no deja).
      if (bajadaRef.current < UMBRAL && px >= UMBRAL) navigator.vibrate?.(10);
      bajadaRef.current = px;
      setBajada(px);
      moverContenido(px, animado);
    }
    function onStart(e: TouchEvent) {
      inicio.current =
        window.scrollY <= 0 && e.touches.length === 1 && !esDeOtraCosa(e.target) ? e.touches[0].clientY : null;
      if (inicio.current === null) return;
      // Aparece justo debajo de la barra de arriba.
      setArriba(document.querySelector("header")?.getBoundingClientRect().bottom ?? 0);
      setArrastrando(true);
    }
    function onMove(e: TouchEvent) {
      if (inicio.current === null) return;
      const dy = e.touches[0].clientY - inicio.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (bajadaRef.current) mover(0, false);
        return;
      }
      // Mientras se tira hacia abajo desde arriba, que iOS no haga su rebote.
      e.preventDefault();
      // Cada vez cuesta más, como el elástico nativo.
      mover(Math.min(MAXIMO, dy * 0.55 - (dy * dy) / 4000), false);
    }
    function onEnd() {
      if (inicio.current === null) return;
      inicio.current = null;
      setArrastrando(false);
      if (bajadaRef.current >= UMBRAL) {
        desde.current = Date.now();
        setMostrandoRecarga(true);
        mover(ALTO_RECARGANDO, true);
        startTransition(() => router.refresh());
      } else {
        mover(0, true);
      }
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
      moverContenido(0, false);
    };
  }, [activo, router]);

  // Cuando llegaron los datos (y pasó el mínimo), la pantalla vuelve a su lugar.
  useEffect(() => {
    if (!mostrandoRecarga || recargando) return;
    const espera = setTimeout(
      () => {
        bajadaRef.current = 0;
        setBajada(0);
        moverContenido(0, true);
        setMostrandoRecarga(false);
      },
      Math.max(0, MINIMO_MS - (Date.now() - desde.current))
    );
    return () => clearTimeout(espera);
  }, [mostrandoRecarga, recargando]);

  if (!activo || (bajada === 0 && !mostrandoRecarga)) return null;

  const listo = mostrandoRecarga || bajada >= UMBRAL;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-10 flex justify-center"
      style={{
        top: arriba,
        // En el medio del hueco que deja la pantalla al bajar.
        transform: `translateY(${bajada / 2 - 18}px)`,
        transition: arrastrando ? "none" : ANIMACION,
        opacity: mostrandoRecarga ? 1 : Math.min(1, bajada / (UMBRAL * 0.8)),
      }}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface shadow-lg">
        <IconRefresh
          aria-label={mostrandoRecarga ? "Actualizando" : undefined}
          className={`h-5 w-5 ${listo ? "text-primary-400" : "text-zinc-500"} ${mostrandoRecarga ? "animate-spin" : ""}`}
          style={mostrandoRecarga ? undefined : { transform: `rotate(${bajada * 4}deg)` }}
        />
      </div>
    </div>
  );
}
