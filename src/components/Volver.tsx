import Link from "next/link";
import { IconChevronRight } from "@/components/icons";

/** "‹ Partidos": vuelve a la lista con la transición hacia atrás. */
export default function Volver({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      transitionTypes={["atras"]}
      className="-ml-1 inline-flex items-center gap-0.5 rounded-lg py-1 pr-2 pl-1 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white"
    >
      <IconChevronRight className="h-4 w-4 rotate-180" />
      {children}
    </Link>
  );
}
