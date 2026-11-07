"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconAvailability, IconMatches, IconPoll, IconStats, IconUsers } from "./icons";
import { tap } from "@/lib/haptics";

const items = [
  { href: "/partidos", label: "Partidos", Icon: IconMatches },
  { href: "/jugadores", label: "Jugadores", Icon: IconUsers },
  { href: "/estadisticas", label: "Stats", Icon: IconStats },
  { href: "/disponibilidad", label: "Agenda", Icon: IconAvailability },
  { href: "/encuestas", label: "Encuestas", Icon: IconPoll },
];

/** Campos que abren el teclado (o la ruedita de opciones en iPhone). */
function abreTeclado(el: EventTarget | null) {
  return (
    el instanceof HTMLElement &&
    (el.isContentEditable ||
      el.matches("textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=hidden])"))
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  // En iPhone (app agregada a inicio), una barra fija abajo puede quedar
  // corrida hacia arriba después de abrir y cerrar el teclado. Se esconde
  // mientras hay un campo con foco y, al cerrarse el teclado, se fuerza a
  // que el navegador reacomode la pantalla.
  const [conTeclado, setConTeclado] = useState(false);

  useEffect(() => {
    const alEnfocar = (e: FocusEvent) => {
      if (abreTeclado(e.target)) setConTeclado(true);
    };
    const alDesenfocar = () => {
      // Al pasar de un campo a otro, el foco nuevo llega un instante después.
      setTimeout(() => {
        if (abreTeclado(document.activeElement)) return;
        setConTeclado(false);
        window.scrollTo(window.scrollX, window.scrollY);
      }, 100);
    };
    document.addEventListener("focusin", alEnfocar);
    document.addEventListener("focusout", alDesenfocar);
    return () => {
      document.removeEventListener("focusin", alEnfocar);
      document.removeEventListener("focusout", alDesenfocar);
    };
  }, []);

  const activo = items.findIndex(({ href }) => pathname === href || pathname.startsWith(href + "/"));

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur-lg md:hidden ${
        conTeclado ? "hidden" : ""
      }`}
      // Mínimo de 14px abajo aunque el navegador no informe safe area, para
      // no quedar pegado a la barra de inicio del iPhone. Con nombre de
      // transición, queda quieta mientras se anima el cambio de pantalla.
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)", viewTransitionName: "barra-inferior" }}
    >
      {/* Margen a los costados para que las esquinas redondeadas de la pantalla no corten las etiquetas. */}
      <div className="relative mx-auto flex max-w-3xl items-stretch justify-around px-4">
        {/* La pastilla de la pestaña activa: se desliza de una a otra. */}
        {activo >= 0 && (
          <span aria-hidden className="pointer-events-none absolute inset-y-1.5 right-4 left-4">
            <span
              className="absolute inset-y-0 rounded-2xl bg-primary-500/10 transition-[left] duration-300 ease-[var(--ease-pop)]"
              style={{ width: `${100 / items.length}%`, left: `${(activo * 100) / items.length}%` }}
            />
          </span>
        )}
        {items.map(({ href, label, Icon }, i) => {
          const active = i === activo;
          return (
            <Link
              key={href}
              href={href}
              // La pantalla nueva entra desde el lado de la pestaña.
              transitionTypes={activo >= 0 && i !== activo ? [i > activo ? "tab-der" : "tab-izq"] : undefined}
              onClick={() => i !== activo && tap()}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium"
            >
              <Icon
                className={`h-6 w-6 transition duration-300 ease-[var(--ease-pop)] ${
                  active ? "-translate-y-0.5 scale-110 text-primary-400" : "text-zinc-500"
                }`}
              />
              <span className={`transition-colors ${active ? "text-primary-400" : "text-zinc-500"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
