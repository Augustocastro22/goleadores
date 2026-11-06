import Link from "next/link";
import Card from "@/components/ui/Card";
import { avisoGolesPorCorregir } from "@/lib/goles-por-corregir";

/** Para el admin: hay goles de un desafío que ya no cierran con el resultado (ver goles-por-corregir.ts). */
export default function AvisoGolesPorCorregir({ pendientes }: { pendientes: { partidoId: string; rival: string }[] }) {
  return (
    <Card className="mb-4 flex flex-col gap-2 border-gold-500/20 px-4 py-3">
      <p className="text-sm text-zinc-300">{avisoGolesPorCorregir(pendientes)}</p>
      <Link
        href={`/partidos/${pendientes[0].partidoId}`}
        className="self-start text-sm font-semibold text-primary-400 hover:text-primary-300"
      >
        Corregir goles
      </Link>
    </Card>
  );
}
