"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/partidos", label: "Partidos" },
  { href: "/jugadores", label: "Jugadores" },
  { href: "/formacion", label: "Formación" },
  { href: "/estadisticas", label: "Estadísticas" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="hidden items-center gap-1 md:flex">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-white/10 text-white"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
