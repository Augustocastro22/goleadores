import Link from "next/link";
import { redirect } from "next/navigation";
import { getMiembros, requireGrupo } from "@/lib/grupo";
import { getConfig } from "@/lib/config";
import { hoyArgentina } from "@/lib/confirmacion";
import { errorGolesPorCorregir, golesPorCorregir } from "@/lib/goles-por-corregir";
import { getCanchas } from "@/lib/canchas";
import Card from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import NuevoPartidoForm from "./NuevoPartidoForm";

export default async function NuevoPartidoPage() {
  const { supabase, grupo } = await requireGrupo();
  if (grupo.rol !== "admin") redirect("/partidos");

  const [jugadores, config, pendientes, canchas] = await Promise.all([
    getMiembros(supabase, grupo.id),
    getConfig(supabase, grupo.id),
    golesPorCorregir(supabase, grupo.id),
    getCanchas(supabase, grupo.id),
  ]);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-white">
        Nuevo partido
      </h1>
      <Card className="p-6">
        {pendientes.length > 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-danger-400">{errorGolesPorCorregir(pendientes)}</p>
            <Link href={`/partidos/${pendientes[0].partidoId}`} className={buttonClass("primary")}>
              Corregir goles
            </Link>
          </div>
        ) : (
          <NuevoPartidoForm
            jugadores={jugadores}
            hoy={hoyArgentina()}
            pideConfirmacion={config.pedir_confirmacion}
            canchas={canchas}
            config={config}
          />
        )}
      </Card>
    </div>
  );
}
