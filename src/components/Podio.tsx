import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import ContadorAnimado from "@/components/ContadorAnimado";

export interface PuestoPodio {
  jugadorId: string;
  apodo: string;
  fotoUrl: string | null;
  valor: number;
  puesto: number;
}

/** Oro, plata y bronce. */
const MEDALLA = [
  { aro: "#fbbf24", escalon: "from-gold-500/35 to-gold-500/5", texto: "text-gold-400" },
  { aro: "#d4d4d8", escalon: "from-zinc-300/25 to-zinc-300/5", texto: "text-zinc-300" },
  { aro: "#fb923c", escalon: "from-orange-400/30 to-orange-400/5", texto: "text-orange-400" },
];
const ALTO = ["h-28", "h-20", "h-14"];

/**
 * Los tres primeros en un podio: el 1° al medio y más alto, el 2° a la
 * izquierda, el 3° a la derecha. Los escalones suben al entrar y los números
 * cuentan hasta su valor. Tocar a uno abre su perfil.
 */
export default function Podio({ puestos, unidad }: { puestos: PuestoPodio[]; unidad: string }) {
  const orden = [1, 0, 2].filter((i) => i < puestos.length);
  return (
    <div className="flex items-end justify-center gap-2 px-2 pt-6">
      {orden.map((i, k) => {
        const p = puestos[i];
        const medalla = MEDALLA[Math.min(p.puesto, 3) - 1];
        const primero = i === 0;
        return (
          <Link
            key={p.jugadorId}
            href={`/jugadores/${p.jugadorId}`}
            transitionTypes={["adelante"]}
            className="presionable flex w-1/3 max-w-[128px] flex-col items-center"
          >
            <div className="entrada relative flex flex-col items-center" style={{ "--i": k + 3 } as React.CSSProperties}>
              {primero && (
                <span aria-hidden className="corona absolute -top-6 text-2xl">
                  👑
                </span>
              )}
              <span className="rounded-full p-[3px]" style={{ background: medalla.aro }}>
                <Avatar src={p.fotoUrl} alt={p.apodo} size={primero ? 72 : 56} className="ring-0" />
              </span>
              <span className="mt-1.5 max-w-full truncate text-sm font-bold text-white">{p.apodo}</span>
              <span className={`font-mono text-xl leading-tight font-extrabold tabular-nums ${medalla.texto}`}>
                <ContadorAnimado valor={p.valor} />
              </span>
              <span className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">{unidad}</span>
            </div>
            <div
              className={`podio-escalon mt-2 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-white/10 bg-gradient-to-b pt-2 ${medalla.escalon} ${ALTO[i]}`}
              style={{ "--i": k } as React.CSSProperties}
            >
              <span className={`font-mono text-2xl font-extrabold ${medalla.texto}`}>{p.puesto}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
