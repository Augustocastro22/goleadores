import { redirect } from "next/navigation";
import { getMiembros, requireGrupo } from "@/lib/grupo";
import { getConfig } from "@/lib/config";
import { hoyArgentina } from "@/lib/confirmacion";
import Card from "@/components/ui/Card";
import NuevoPartidoForm from "./NuevoPartidoForm";

export default async function NuevoPartidoPage() {
  const { supabase, grupo } = await requireGrupo();
  if (grupo.rol !== "admin") redirect("/partidos");

  const [jugadores, config] = await Promise.all([
    getMiembros(supabase, grupo.id),
    getConfig(supabase, grupo.id),
  ]);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-white">
        Nuevo partido
      </h1>
      <Card className="p-6">
        <NuevoPartidoForm
          jugadores={jugadores}
          hoy={hoyArgentina()}
          pideConfirmacion={config.pedir_confirmacion}
        />
      </Card>
    </div>
  );
}
