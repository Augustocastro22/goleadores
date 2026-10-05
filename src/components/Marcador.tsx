/** Resultado de un partido: "Nosotros 1 – 0 Rival", con los goles grandes. */
export default function Marcador({
  golesNosotros,
  golesRival,
  rival,
  className = "",
}: {
  golesNosotros: number;
  golesRival: number;
  rival: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-3 sm:gap-6 ${className}`}>
      <p className="flex-1 truncate text-right text-sm font-semibold text-zinc-300 sm:text-base">
        Nosotros
      </p>
      <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-white/5 px-5 py-2.5">
        <span className="text-3xl font-extrabold tabular-nums text-white">{golesNosotros}</span>
        <span className="text-lg font-bold text-zinc-600">–</span>
        <span className="text-3xl font-extrabold tabular-nums text-white">{golesRival}</span>
      </div>
      <p className="flex-1 truncate text-left text-sm font-semibold text-zinc-300 sm:text-base">
        {rival}
      </p>
    </div>
  );
}
