"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMatches, IconProfile, IconStats } from "./icons";

const items = [
  { href: "/partidos", label: "Partidos", Icon: IconMatches },
  { href: "/estadisticas", label: "Stats", Icon: IconStats },
  { href: "/perfil", label: "Perfil", Icon: IconProfile },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-3xl items-stretch justify-around">
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
