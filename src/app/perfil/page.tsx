import { redirect } from "next/navigation";
import { getContexto } from "@/lib/grupo";
import { INSTAGRAM_URL, INSTAGRAM_USUARIO } from "@/lib/redes";
import type { Bloqueo } from "@/lib/types";
import PerfilForm from "./PerfilForm";
import DisponibilidadEditor from "./DisponibilidadEditor";
import PushSubscribe from "@/components/PushSubscribe";
import { IconChevronRight, IconFeedback } from "@/components/icons";
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
        <DisponibilidadEditor
          bloqueosIniciales={bloqueos ?? []}
          modoInicial={profile.disponibilidad_modo ?? null}
          grupos={grupos.map((g) => ({ id: g.id, nombre: g.nombre }))}
          hoy={hoy}
          hayGrupo={!!grupo}
        />
        <PerfilForm profile={profile} rol={grupo?.rol ?? null} />
        <PushSubscribe />
        <EliminarCuenta />
        <Link
          href="/contacto?motivo=idea"
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/80 px-5 py-4 transition hover:border-border-strong hover:bg-surface-2/80"
        >
          <span className="flex items-center gap-3">
            <IconFeedback className="h-6 w-6 shrink-0 text-primary-400" />
            <span>
              <span className="block text-sm font-semibold text-white">Sugerencias y reportes</span>
              <span className="text-xs text-zinc-500">¿Una idea o algo que no anda?</span>
            </span>
          </span>
          <IconChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
        </Link>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-sm text-zinc-400 hover:text-white"
        >
          Seguinos en Instagram <span className="font-semibold text-primary-400">@{INSTAGRAM_USUARIO}</span>
        </a>
        <Link href="/privacidad" className="text-center text-xs text-zinc-500 hover:text-zinc-300">
          Política de privacidad
        </Link>
      </div>
    </div>
  );
}
