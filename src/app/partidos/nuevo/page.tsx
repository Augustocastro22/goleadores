import { redirect } from "next/navigation";
import { getMiembros, requireGrupo } from "@/lib/grupo";
import { getConfig } from "@/lib/config";
import { hoyArgentina } from "@/lib/confirmacion";
import { golesPorCorregir } from "@/lib/goles-por-corregir";
import AvisoGolesPorCorregir from "@/components/AvisoGolesPorCorregir";
import { getCanchas } from "@/lib/canchas";
import type { Bloqueo } from "@/lib/types";
import Card from "@/components/ui/Card";
import NuevoPartidoForm from "./NuevoPartidoForm";
import PreguntaModoJuego from "@/components/PreguntaModoJuego";
import { sugerirModoJuego } from "@/lib/modo-juego";

export default async function NuevoPartidoPage() {
  const { supabase, grupo } = await requireGrupo();
  if (grupo.rol !== "admin") redirect("/partidos");

  const [jugadores, config, pendientes, canchas, sugerido] = await Promise.all([
    getMiembros(supabase, grupo.id),
    getConfig(supabase, grupo.id),
    golesPorCorregir(supabase, grupo.id),
    getCanchas(supabase, grupo.id),
    sugerirModoJuego(supabase, grupo.id),
  ]);

  // Lo que dijeron que no pueden, para avisar al convocar (los generales y los de este grupo).
  const { data: bloqueos } = await supabase
    .from("bloqueos_disponibilidad")
    .select("*")
    .in(
      "jugador_id",
      jugadores.map((j) => j.id)
    )
    .or(`grupo_id.is.null,grupo_id.eq.${grupo.id}`)
    .returns<Bloqueo[]>();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-white">
        Nuevo partido
      </h1>
      {config.modo_juego === null && <PreguntaModoJuego grupoId={grupo.id} sugerido={sugerido} />}
      {pendientes.length > 0 && <AvisoGolesPorCorregir pendientes={pendientes} />}
      <Card className="p-6">
        <NuevoPartidoForm
          jugadores={jugadores}
          hoy={hoyArgentina()}
          pideConfirmacion={config.pedir_confirmacion}
          canchas={canchas}
          config={config}
          bloqueos={bloqueos ?? []}
        />
      </Card>
    </div>
  );
}
