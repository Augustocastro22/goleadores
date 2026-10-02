import { redirect } from "next/navigation";
import { getContexto } from "@/lib/grupo";
import type { Bloqueo } from "@/lib/types";
import PerfilForm from "./PerfilForm";
import DisponibilidadEditor from "./DisponibilidadEditor";
import PushSubscribe from "@/components/PushSubscribe";

export default async function PerfilPage() {
  const { supabase, user, grupo, grupos } = await getContexto();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: bloqueos } = await supabase
    .from("bloqueos_disponibilidad")
    .select("*")
    .eq("jugador_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Bloqueo[]>();

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-white">Mi perfil</h1>
      <div className="flex flex-col gap-5">
        <PerfilForm profile={profile} rol={grupo?.rol ?? null} />
        <DisponibilidadEditor
          bloqueosIniciales={bloqueos ?? []}
          grupos={grupos.map((g) => ({ id: g.id, nombre: g.nombre }))}
        />
        <PushSubscribe />
      </div>
    </div>
  );
}
