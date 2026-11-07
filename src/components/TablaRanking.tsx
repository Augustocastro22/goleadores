"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import ContadorAnimado from "@/components/ContadorAnimado";
import Podio from "@/components/Podio";
import { IconChevronRight } from "@/components/icons";

export interface FilaTabla {
  jugadorId: string;
  nombre: string;
  apellido: string;
  apodo: string;
  fotoUrl: string | null;
  valor: number;
  puesto: number;
  partidosJugados: number;
  sigueEnGrupo: boolean;
}

type Vista = "podio" | "lista";

const RANK_BADGE = ["bg-gold-500/20 text-gold-400", "bg-white/10 text-zinc-300", "bg-orange-500/15 text-orange-400"];
const CLAVE = "estadisticas-vista";

/**
 * Una tabla de Estadísticas (goleadores, MVP, peor): en podio (los tres
 * primeros arriba y el resto abajo) o en lista (todos en renglones), con un
 * selector arriba que se recuerda en este dispositivo. Tocar a cualquiera
 * abre su perfil.
 */
export default function TablaRanking({
  filas,
  unidad,
  etiquetaValor,
}: {
  filas: FilaTabla[];
  /** "goles", "veces": debajo del número en el podio. */
  unidad: string;
  /** "Goles", "Veces": al lado del número en la lista. */
  etiquetaValor: string;
}) {
  const [vista, setVista] = useState<Vista>("podio");
  // Lo elegido la última vez (después de montar: localStorage no existe en el servidor).
  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE) === "lista") {
        const t = setTimeout(() => setVista("lista"), 0);
        return () => clearTimeout(t);
      }
    } catch {
      // Sin almacenamiento, en podio.
    }
  }, []);

  function elegir(v: Vista) {
    setVista(v);
    try {
      localStorage.setItem(CLAVE, v);
    } catch {
      // No se recuerda, y listo.
    }
  }

  const maximo = filas[0]?.valor || 1;
  const enPodio = vista === "podio";
  const resto = enPodio ? filas.slice(3) : filas;

  return (
    <div>
      <div className="flex justify-end px-3 pt-3">
        <div className="flex rounded-lg border border-border bg-white/5 p-0.5" role="group" aria-label="Cómo ver la tabla">
          {(
            [
              ["podio", "Podio"],
              ["lista", "Lista"],
            ] as const
          ).map(([v, texto]) => (
            <button
              key={v}
              type="button"
              onClick={() => elegir(v)}
              aria-pressed={vista === v}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                vista === v ? "bg-primary-500/15 text-primary-400" : "text-zinc-400 hover:text-white"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {enPodio && (
        <Podio
          unidad={unidad}
          puestos={filas.slice(0, 3).map((f) => ({
            jugadorId: f.jugadorId,
            apodo: f.apodo,
            fotoUrl: f.fotoUrl,
            valor: f.valor,
            puesto: f.puesto,
          }))}
        />
      )}

      {resto.length > 0 && (
        <div key={vista} className={`divide-y divide-border ${enPodio ? "border-t border-border" : "mt-2 border-t border-border"}`}>
          {resto.map((f, i) => (
            <Link
              key={f.jugadorId}
              href={`/jugadores/${f.jugadorId}`}
              transitionTypes={["adelante"]}
              className="entrada relative isolate flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
              style={{ "--i": i } as React.CSSProperties}
            >
              {/* Una barra del tamaño de lo que hizo, detrás del renglón. */}
              <span
                aria-hidden
                className="barra-crece absolute inset-y-1 left-0 -z-10 rounded-r-lg bg-primary-500/[0.13]"
                style={{ width: `${(f.valor / maximo) * 100}%`, "--i": i } as React.CSSProperties}
              />
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  RANK_BADGE[f.puesto - 1] ?? "text-zinc-600"
                }`}
              >
                {f.puesto}
              </span>
              <Avatar src={f.fotoUrl} alt={f.apodo} size={36} className={f.sigueEnGrupo ? "" : "opacity-50 grayscale"} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  {f.nombre} {f.apellido}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {f.apodo} · {f.partidosJugados} {f.partidosJugados === 1 ? "partido" : "partidos"}
                  {!f.sigueEnGrupo && " · ya no está en el grupo"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="font-mono text-lg font-bold tabular-nums text-white">
                  <ContadorAnimado valor={f.valor} />
                </span>
                <span className="hidden text-xs text-zinc-600 sm:inline">{etiquetaValor}</span>
                <IconChevronRight className="h-4 w-4 text-zinc-600" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
