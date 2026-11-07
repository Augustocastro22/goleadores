"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

/**
 * Anima el cambio de pantalla (View Transitions de React, ver
 * node_modules/next/dist/docs/01-app/02-guides/view-transitions.md). Va en
 * el layout con key = ruta: al navegar, la pantalla vieja sale y la nueva
 * entra según el tipo de navegación que mande el link:
 * - "adelante" / "atras": de una lista a un detalle y de vuelta (desliza);
 * - "tab-der" / "tab-izq": entre pestañas de la barra de abajo (corrimiento corto);
 * - sin tipo: aparece subiendo apenas.
 * Un router.refresh() o una acción no cambian la ruta: no animan.
 */
const MOVIMIENTO = {
  adelante: "adelante",
  atras: "atras",
  "tab-der": "tab-der",
  "tab-izq": "tab-izq",
  default: "pantalla",
};

export default function TransicionPantalla({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter={MOVIMIENTO} exit={MOVIMIENTO} update="none" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
