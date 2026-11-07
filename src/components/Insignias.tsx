"use client";

import { useEffect, useState } from "react";
import { IconGoal, IconThumbsDown, IconTrophy, IconUsers } from "@/components/icons";

export type IconoInsignia = "gol" | "presencia" | "trofeo" | "pulgar";

export interface Insignia {
  id: string;
  icono: IconoInsignia;
  titulo: string;
  /** Lo que logró (si la tiene). */
  detalle: string;
  /** Qué hace falta para conseguirla (si todavía no la tiene). */
  requisito: string;
  desbloqueada: boolean;
  /** Cuánto le falta, entre 0 y 1 (si se puede medir). */
  progreso?: number;
  /** "3 de 5", "Récord: 2 en un partido"… */
  textoProgreso?: string;
}

const ICONOS = { gol: IconGoal, presencia: IconUsers, trofeo: IconTrophy, pulgar: IconThumbsDown };

const clave = (jugadorId: string, id: string) => `insignia:${jugadorId}:${id}`;

/**
 * Los logros del perfil como insignias: las conseguidas, medallas doradas; las
 * que faltan, en gris con candado, el requisito y cuánto falta. La primera vez
 * que se ve una conseguida en este dispositivo, le pasa un brillo.
 */
export default function Insignias({ jugadorId, insignias }: { jugadorId: string; insignias: Insignia[] }) {
  const conseguidas = insignias.filter((i) => i.desbloqueada).length;
  // Las que se ven conseguidas por primera vez en este dispositivo (se calcula después de montar: usa localStorage).
  const [nuevas, setNuevas] = useState<Set<string>>(new Set());
  useEffect(() => {
    const recien = new Set<string>();
    for (const i of insignias) {
      if (!i.desbloqueada) continue;
      try {
        if (localStorage.getItem(clave(jugadorId, i.id)) !== "1") {
          recien.add(i.id);
          localStorage.setItem(clave(jugadorId, i.id), "1");
        }
      } catch {
        // Sin almacenamiento, sin brillo.
      }
    }
    if (recien.size > 0) {
      const t = setTimeout(() => setNuevas(recien), 0);
      return () => clearTimeout(t);
    }
  }, [jugadorId, insignias]);

  // Primero las conseguidas, después las que faltan (las más cerca, primero).
  const ordenadas = [...insignias].sort(
    (a, b) => Number(b.desbloqueada) - Number(a.desbloqueada) || (b.progreso ?? 0) - (a.progreso ?? 0)
  );

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Logros</h2>
        <span className="text-sm font-semibold text-zinc-400">
          <span className="text-gold-400">{conseguidas}</span> de {insignias.length}
        </span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="barra-crece h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-400"
          style={{ width: `${(conseguidas / Math.max(1, insignias.length)) * 100}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ordenadas.map((ins, i) => {
          const Icono = ICONOS[ins.icono];
          const nueva = nuevas.has(ins.id);
          return (
            <div
              key={ins.id}
              className={`entrada relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border p-4 text-center ${
                ins.desbloqueada ? "border-gold-500/25 bg-gold-500/[0.06]" : "border-border bg-white/[0.02]"
              }`}
              style={{ "--i": i } as React.CSSProperties}
            >
              {nueva && <span aria-hidden className="insignia-brillo pointer-events-none absolute inset-0" />}
              {/* La medalla. */}
              <span
                className={`relative flex h-14 w-14 items-center justify-center rounded-full ${
                  ins.desbloqueada
                    ? "bg-gradient-to-br from-gold-400 to-gold-500 text-[#412402] shadow-lg shadow-gold-500/25"
                    : "bg-white/[0.06] text-zinc-600"
                } ${nueva ? "carta-pop" : ""}`}
              >
                <Icono className="h-7 w-7" />
                {!ins.desbloqueada && (
                  <span className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-[10px]">
                    🔒
                  </span>
                )}
              </span>
              <p className={`text-sm leading-tight font-bold ${ins.desbloqueada ? "text-white" : "text-zinc-400"}`}>{ins.titulo}</p>
              <p className="text-[11px] leading-snug text-zinc-500">{ins.desbloqueada ? ins.detalle : ins.requisito}</p>
              {!ins.desbloqueada && ins.progreso !== undefined && (
                <div className="mt-auto w-full">
                  <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="barra-crece h-full rounded-full bg-zinc-400"
                      style={{ width: `${Math.min(1, ins.progreso) * 100}%`, "--i": i } as React.CSSProperties}
                    />
                  </div>
                  {ins.textoProgreso && <p className="mt-1 text-[10px] font-semibold text-zinc-500">{ins.textoProgreso}</p>}
                </div>
              )}
              {nueva && (
                <span className="absolute top-2 right-2 rounded-full bg-gold-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-gold-400 uppercase">
                  Nuevo
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
