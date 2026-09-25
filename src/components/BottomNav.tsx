"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMatches, IconPoll, IconStats, IconUsers } from "./icons";

const items = [
  { href: "/partidos", label: "Partidos", Icon: IconMatches },
  { href: "/jugadores", label: "Jugadores", Icon: IconUsers },
  { href: "/estadisticas", label: "Stats", Icon: IconStats },
  { href: "/encuestas", label: "Encuestas", Icon: IconPoll },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur-lg md:hidden"
      // Mínimo de 14px abajo aunque el navegador no informe safe area, para
      // no quedar pegado a la barra de inicio del iPhone.
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}
    >
      {/* Margen a los costados para que las esquinas redondeadas de la pantalla no corten las etiquetas. */}
      <div className="mx-auto flex max-w-3xl items-stretch justify-around px-4">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium"
            >
              <Icon className={`h-6 w-6 transition ${active ? "text-primary-400" : "text-zinc-500"}`} />
              <span className={active ? "text-primary-400" : "text-zinc-500"}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
