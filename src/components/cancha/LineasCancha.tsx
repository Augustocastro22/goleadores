/**
 * Las líneas de cal de una cancha vertical (viewBox 100×140, se estira a la
 * proporción 5:7): borde, mitad, círculo central, áreas grande y chica,
 * medialunas, puntos de penal y los arcos.
 */
export default function LineasCancha() {
  const cal = "rgba(255,255,255,0.7)";
  const g = { fill: "none", stroke: cal, strokeWidth: 0.55 } as const;
  return (
    <svg viewBox="0 0 100 140" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <rect x="4" y="4" width="92" height="132" rx="1" {...g} />
      <line x1="4" y1="70" x2="96" y2="70" {...g} />
      <circle cx="50" cy="70" r="11" {...g} />
      <circle cx="50" cy="70" r="0.8" fill={cal} />
      {[false, true].map((abajo) => {
        const y = (v: number) => (abajo ? 140 - v : v);
        return (
          <g key={String(abajo)}>
            <rect x="24" y={abajo ? y(24) : 4} width="52" height="20" {...g} />
            <rect x="37" y={abajo ? y(11) : 4} width="26" height="7" {...g} />
            <circle cx="50" cy={y(17)} r="0.8" fill={cal} />
            <path d={abajo ? `M 41 ${y(24)} A 9 9 0 0 1 59 ${y(24)}` : `M 41 24 A 9 9 0 0 0 59 24`} {...g} />
            <rect x="44" y={abajo ? 136 : 2.2} width="12" height="1.8" fill={cal} opacity="0.6" />
          </g>
        );
      })}
    </svg>
  );
}
