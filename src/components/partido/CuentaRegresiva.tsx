"use client";

import { useEffect, useState } from "react";

/** El momento del partido (hora de Argentina). Sin hora, cuenta hasta el final del día. */
function inicio(fecha: string, hora: string | null): number {
  return new Date(`${fecha}T${(hora ?? "23:59").slice(0, 5)}:00-03:00`).getTime();
}

/** "en 2 días", "en 5 h 20 min", "en 12 min"… */
function textoFalta(ms: number): { grande: string; chico: string } {
  const min = Math.floor(ms / 60000);
  const dias = Math.floor(min / 1440);
  const horas = Math.floor((min % 1440) / 60);
  const minutos = min % 60;
  if (dias >= 2) return { grande: `${dias}`, chico: "días" };
  if (dias === 1) return { grande: `${24 + horas}`, chico: "horas" };
  if (horas >= 1) return { grande: `${horas}:${String(minutos).padStart(2, "0")}`, chico: "horas" };
  return { grande: `${Math.max(1, minutos)}`, chico: minutos === 1 ? "minuto" : "minutos" };
}

/**
 * Cuánto falta para el partido, en grande y actualizándose solo. En la última
 * hora pasa a minutos; ya empezado, "¡Se está jugando!".
 */
export default function CuentaRegresiva({ fecha, hora }: { fecha: string; hora: string | null }) {
  const objetivo = inicio(fecha, hora);
  // null en el servidor: el reloj del servidor no es el del celular (y así no hay diferencia al hidratar).
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setAhora(Date.now());
    tick();
    const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, []);

  if (ahora === null) return <span className="inline-block h-10 w-16 rounded-lg bg-white/5" aria-hidden />;
  const falta = objetivo - ahora;
  if (falta <= 0) {
    return (
      <span className="flex items-center gap-2 text-lg font-extrabold text-primary-400">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-400" />
        </span>
        ¡Se está jugando!
      </span>
    );
  }
  const { grande, chico } = textoFalta(falta);
  return (
    <span className="flex items-baseline gap-1.5" aria-label={`Faltan ${grande} ${chico}`}>
      <span key={grande} className="salta font-mono text-4xl font-extrabold tabular-nums text-white">
        {grande}
      </span>
      <span className="text-sm font-medium text-zinc-400">{chico}</span>
    </span>
  );
}
