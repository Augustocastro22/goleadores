import { redirect } from "next/navigation";
import { getContexto } from "@/lib/grupo";
import type { Bloqueo } from "@/lib/types";
import PerfilForm from "./PerfilForm";
import DisponibilidadEditor from "./DisponibilidadEditor";
import PushSubscribe from "@/components/PushSubscribe";
import Link from "next/link";
import EliminarCuenta from "./EliminarCuenta";

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

  // Fecha de hoy en Argentina (YYYY-MM-DD), para que el calendario marque los
  // días pasados igual en el servidor y en el navegador.
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(
    new Date()
  );

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-white">Mi perfil</h1>
      <div className="flex flex-col gap-5">
        <PerfilForm profile={profile} rol={grupo?.rol ?? null} />
        <DisponibilidadEditor
          bloqueosIniciales={bloqueos ?? []}
          grupos={grupos.map((g) => ({ id: g.id, nombre: g.nombre }))}
          hoy={hoy}
        />
        <PushSubscribe />
        <EliminarCuenta />
        <Link href="/privacidad" className="text-center text-xs text-zinc-500 hover:text-zinc-300">
          Política de privacidad
        </Link>
      </div>
    </div>
  );
}
