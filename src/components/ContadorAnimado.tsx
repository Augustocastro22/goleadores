"use client";

import { useEffect, useState } from "react";

/**
 * Un número que sube de 0 a su valor al aparecer (estadísticas, resumen).
 * Con prefers-reduced-motion, directo al valor.
 */
export default function ContadorAnimado({ valor, duracion = 900 }: { valor: number; duracion?: number }) {
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => {
    const sinAnimar = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const inicio = performance.now();
    const paso = (t: number) => {
      const p = sinAnimar ? 1 : Math.min(1, (t - inicio) / duracion);
      // Arranca rápido y frena al llegar.
      setMostrado(Math.round(valor * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracion]);
  return <>{mostrado}</>;
}
