import { redirect } from "next/navigation";
import { getMiembros, requireGrupo } from "@/lib/grupo";
import { createPartido } from "@/lib/actions/partidos";
import Card from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import Avatar from "@/components/ui/Avatar";
import SubmitButton from "@/components/SubmitButton";
import HoraSelect from "@/components/HoraSelect";
import EquipoPicker from "./EquipoPicker";

export default async function NuevoPartidoPage() {
  const { supabase, grupo } = await requireGrupo();
  if (grupo.rol !== "admin") redirect("/partidos");

  const jugadores = await getMiembros(supabase, grupo.id);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-white">Nuevo partido</h1>
      <Card className="p-6">
        <form
          action={async (formData) => {
            "use server";
            await createPartido(formData);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex gap-3">
            <Label className="flex-1">
              Fecha
              <Input type="date" name="fecha" required />
            </Label>
            <Label className="w-28 shrink-0">
              Hora
              <HoraSelect />
            </Label>
          </div>
          <Label>
            Lugar
            <Input type="text" name="lugar" required />
          </Label>
          <Label>
            Rival / nombre del Equipo 2
            <Input type="text" name="rival" required />
          </Label>

          <div>
            <p className="mb-1 text-sm font-medium text-zinc-300">Jugadores por equipo</p>
            <p className="mb-2 text-xs text-zinc-500">
              Marcá en qué equipo jugó cada uno. Si alguien no jugó ese partido, dejalo sin marcar
              (para sacar a alguien, tocá la ✕ o de nuevo su equipo). Un jugador del grupo puede jugar en el Equipo 2 (por ejemplo en una pichanga) y sus
              goles van a contar igual en la tabla histórica.
            </p>
            <div className="flex flex-col gap-2">
              {jugadores.map((jugador) => (
                <div
                  key={jugador.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/5 px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={jugador.foto_url} alt={jugador.apodo} size={28} />
                    <span className="block truncate text-sm text-zinc-200">
                      {jugador.nombre} {jugador.apellido}{" "}
                      <span className="text-zinc-500">({jugador.apodo})</span>
                    </span>
                  </div>
                  <EquipoPicker jugadorId={jugador.id} apodo={jugador.apodo} />
                </div>
              ))}
            </div>
          </div>

          <SubmitButton pendingText="Creando..." className="mt-2">
            Crear partido
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
