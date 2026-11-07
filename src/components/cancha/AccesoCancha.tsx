import Link from "next/link";
import { IconChevronRight } from "@/components/icons";

/** En el partido: entrada a "La cancha", con una mini cancha de muestra. */
export default function AccesoCancha({ href, detalle }: { href: string; detalle: string }) {
  return (
    <Link
      href={href}
      transitionTypes={["adelante"]}
      className="presionable flex items-center gap-4 rounded-2xl border border-border bg-surface/80 p-3 pr-4 transition hover:border-border-strong"
    >
      <span
        aria-hidden
        className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10"
        style={{ background: "repeating-linear-gradient(180deg, #1d7a3e 0 12.5%, #18703a 12.5% 25%)" }}
      >
        <span className="absolute inset-x-1 top-1/2 h-px bg-white/60" />
        <span className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60" />
        {[
          [30, 22, "bg-gold-400"],
          [70, 22, "bg-gold-400"],
          [50, 36, "bg-gold-400"],
          [50, 64, "bg-primary-400"],
          [30, 78, "bg-primary-400"],
          [70, 78, "bg-primary-400"],
        ].map(([x, y, c]) => (
          <span
            key={`${x}-${y}`}
            className={`absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${c}`}
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-white">La cancha</span>
        <span className="block truncate text-sm text-zinc-500">{detalle}</span>
      </span>
      <IconChevronRight className="h-5 w-5 shrink-0 text-zinc-600" />
    </Link>
  );
}
