/**
 * Resultado de un partido como tablero de estadio: los goles grandes en
 * casilleros oscuros (el que ganó, en blanco; el otro, apagado) y los nombres
 * de los equipos a los costados. "Nosotros 1 – 0 Rival" o, entre ellos,
 * "Blancos 1 – 0 Negros".
 */
export default function Marcador({
  golesNosotros,
  golesRival,
  rival,
  nosotros = "Nosotros",
  className = "",
}: {
  golesNosotros: number;
  golesRival: number;
  rival: string;
  /** El nombre del primer equipo: "Nosotros", o el del grupo cuando juegan entre ellos. */
  nosotros?: string;
  className?: string;
}) {
  const empate = golesNosotros === golesRival;
  const casillero = (goles: number, gano: boolean) => (
    <span
      className={`entrada flex min-w-[3.25rem] items-center justify-center rounded-xl border border-white/[0.06] bg-black/50 px-2.5 py-1 font-mono text-5xl leading-none font-extrabold tabular-nums shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)] ${
        gano || empate ? "text-white" : "text-zinc-500"
      }`}
    >
      {goles}
    </span>
  );
  const nombre = (texto: string, gano: boolean, alinear: "left" | "right") => (
    <p
      className={`line-clamp-2 min-w-0 flex-1 text-xs font-bold tracking-wide break-words uppercase sm:text-sm ${
        alinear === "right" ? "text-right" : "text-left"
      } ${gano ? "text-white" : "text-zinc-400"}`}
    >
      {texto}
    </p>
  );
  return (
    <div className={`flex items-center justify-center gap-3 sm:gap-5 ${className}`}>
      {nombre(nosotros, golesNosotros > golesRival, "right")}
      <div className="flex shrink-0 items-center gap-2">
        {casillero(golesNosotros, golesNosotros > golesRival)}
        <span className="flex flex-col gap-1.5" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-primary-400/70" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary-400/70" />
        </span>
        {casillero(golesRival, golesRival > golesNosotros)}
      </div>
      {nombre(rival, golesRival > golesNosotros, "left")}
    </div>
  );
}
