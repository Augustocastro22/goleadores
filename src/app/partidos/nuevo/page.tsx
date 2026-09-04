import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPartido } from "@/lib/actions/partidos";
import type { Profile } from "@/lib/types";
import Card from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";

export default async function NuevoPartidoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (profile?.rol !== "admin") redirect("/partidos");

  const { data: jugadores } = await supabase
    .from("profiles")
    .select("*")
    .order("nombre")
    .returns<Profile[]>();

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
          <Label>
            Fecha
            <Input type="date" name="fecha" required />
          </Label>
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
              Marcá en qué equipo jugó cada uno. Si alguien no jugó ese partido, dejalo sin marcar.
              Un jugador del grupo puede jugar en el Equipo 2 (por ejemplo en una pichanga) y sus
              goles van a contar igual en la tabla histórica.
            </p>
            <div className="flex flex-col gap-2">
              {(jugadores ?? []).map((jugador) => (
                <div
                  key={jugador.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/5 px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={jugador.foto_url} alt={jugador.apodo} size={28} />
                    <span className="truncate text-sm text-zinc-200">
                      {jugador.nombre} {jugador.apellido}{" "}
                      <span className="text-zinc-500">({jugador.apodo})</span>
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <label className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-zinc-400 transition has-[:checked]:border-primary-500/40 has-[:checked]:bg-primary-500/10 has-[:checked]:text-primary-400">
                      <input type="radio" name={`equipo-${jugador.id}`} value="1" className="sr-only" />
                      Eq. 1
                    </label>
                    <label className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-zinc-400 transition has-[:checked]:border-gold-500/40 has-[:checked]:bg-gold-500/10 has-[:checked]:text-gold-400">
                      <input type="radio" name={`equipo-${jugador.id}`} value="2" className="sr-only" />
                      Eq. 2
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="mt-2">
            Crear partido
          </Button>
        </form>
      </Card>
    </div>
  );
}
