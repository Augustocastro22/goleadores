"use client";

import GolesInput from "@/components/GolesInput";

/**
 * El resultado del partido para cargar: "Nosotros [ 4 ] – [ 3 ] Rival". Se carga
 * primero y después se reparten los goles entre los jugadores (ver RepartoGoles).
 */
export default function MarcadorEditable({
  nosotros,
  rival,
  golesNosotros,
  golesRival,
  onChangeNosotros,
  onChangeRival,
  className = "",
}: {
  nosotros: string;
  rival: string;
  golesNosotros: number;
  golesRival: number;
  onChangeNosotros: (v: number) => void;
  onChangeRival: (v: number) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-center gap-2 sm:gap-6">
        <p className="line-clamp-2 min-w-0 flex-1 text-right break-words text-xs font-semibold text-zinc-300 sm:text-base">
          {nosotros}
        </p>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <GolesInput value={golesNosotros} onChange={onChangeNosotros} />
          <span className="text-lg font-bold text-zinc-600">–</span>
          <GolesInput value={golesRival} onChange={onChangeRival} />
        </div>
        <p className="line-clamp-2 min-w-0 flex-1 text-left break-words text-xs font-semibold text-zinc-300 sm:text-base">
          {rival}
        </p>
      </div>
      <p className="text-center text-xs text-zinc-500">
        Cargá el resultado y abajo repartí los goles entre los jugadores.
      </p>
    </div>
  );
}
