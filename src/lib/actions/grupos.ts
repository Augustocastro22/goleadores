"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push/send";
import { GRUPO_COOKIE, GRUPO_COOKIE_OPTIONS, urlConGrupo } from "@/lib/grupo-cookie";
import { filasConfig, parseConfig } from "@/lib/config";

async function activarGrupo(grupoId: string) {
  (await cookies()).set(GRUPO_COOKIE, grupoId, GRUPO_COOKIE_OPTIONS);
}

export async function crearGrupo(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { error: "Poné un nombre para el grupo." };
  if (nombre.length > 60) return { error: "El nombre puede tener hasta 60 caracteres." };

  const config = parseConfig(formData);
  if ("error" in config) return config;
  const requiereAprobacion = formData.get("requiere_aprobacion") === "on";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: grupoId, error } = await supabase.rpc("crear_grupo", { p_nombre: nombre });
  if (error || !grupoId) return { error: error?.message ?? "No se pudo crear el grupo." };

  // Ya es admin del grupo recién creado, así que RLS lo deja cargar las reglas.
  // Si algo de esto falla el grupo igual queda creado (con los defaults), y
  // las reglas se pueden ajustar desde Admin.
  await Promise.all([
    supabase.from("config").upsert(filasConfig(grupoId, config, user.id)),
    requiereAprobacion
      ? supabase.from("grupos").update({ requiere_aprobacion: true }).eq("id", grupoId)
      : null,
  ]);

  await activarGrupo(grupoId);
  redirect("/admin?tab=grupo");
}

/** Acepta el código solo o el link completo de invitación. */
export async function unirseGrupo(formData: FormData) {
  const raw = String(formData.get("codigo") ?? "").trim();
  const codigo = raw.split("/").filter(Boolean).pop() ?? "";
  if (!codigo) return { error: "Pegá el link o el código de invitación." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data, error } = await supabase.rpc("unirse_grupo", { p_codigo: codigo });
  if (error) return { error: error.message };
  const resultado = data as { grupo_id: string; estado: "miembro" | "pendiente" } | null;
  if (!resultado) return { error: "Ese código de invitación no existe o ya no es válido." };

  if (resultado.estado === "pendiente") {
    await avisarAdminsDeSolicitud(resultado.grupo_id, user.id);
    revalidatePath("/grupos");
    redirect("/grupos");
  }

  await activarGrupo(resultado.grupo_id);
  redirect("/partidos");
}

/**
 * Push a los admins del grupo cuando alguien pide entrar. Con la service
 * role porque quien pide todavía no es miembro y no puede ver a los admins.
 */
async function avisarAdminsDeSolicitud(grupoId: string, jugadorId: string) {
  const admin = createAdminClient();
  const [{ data: admins }, { data: grupo }, { data: perfil }] = await Promise.all([
    admin.from("grupo_miembros").select("jugador_id").eq("grupo_id", grupoId).eq("rol", "admin"),
    admin.from("grupos").select("nombre").eq("id", grupoId).single(),
    admin.from("profiles").select("nombre, apellido, apodo").eq("id", jugadorId).single(),
  ]);
  if (!grupo || !perfil) return;

  await enviarPush(
    (admins ?? []).map((a) => a.jugador_id),
    {
      title: `Pedido para entrar a ${grupo.nombre}`,
      body: `${perfil.nombre} ${perfil.apellido} (${perfil.apodo}) quiere sumarse al grupo.`,
      url: urlConGrupo("/admin?tab=usuarios", grupoId),
    }
  );
}

/** Cancela una solicitud propia que todavía no se aceptó. */
export async function cancelarSolicitud(formData: FormData) {
  const grupoId = String(formData.get("grupo_id") ?? "");
  if (!grupoId) return { error: "Grupo inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("grupo_solicitudes")
    .delete()
    .eq("grupo_id", grupoId)
    .eq("jugador_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/grupos");
  return { success: true };
}

export async function cambiarGrupo(formData: FormData) {
  const grupoId = String(formData.get("grupo_id") ?? "");
  if (!grupoId) return;
  await activarGrupo(grupoId);
  redirect("/partidos");
}

export async function salirDelGrupo(formData: FormData) {
  const grupoId = String(formData.get("grupo_id") ?? "");
  if (!grupoId) return { error: "Grupo inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: miembros } = await supabase
    .from("grupo_miembros")
    .select("jugador_id, rol")
    .eq("grupo_id", grupoId);
  const yo = (miembros ?? []).find((m) => m.jugador_id === user.id);
  if (!yo) return { error: "No sos miembro de ese grupo." };

  const otrosAdmins = (miembros ?? []).filter((m) => m.rol === "admin" && m.jugador_id !== user.id);
  if (yo.rol === "admin" && otrosAdmins.length === 0 && (miembros ?? []).length > 1) {
    return { error: "Sos el único admin: antes de irte, hacé admin a otro miembro." };
  }

  const { error } = await supabase
    .from("grupo_miembros")
    .delete()
    .eq("grupo_id", grupoId)
    .eq("jugador_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}
