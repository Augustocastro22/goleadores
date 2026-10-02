"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GRUPO_COOKIE } from "@/lib/grupo-cookie";
import { revisarTrasSalida } from "@/lib/votaciones";
import { PALABRA_CONFIRMACION } from "@/lib/cuenta";

/**
 * Borra la cuenta del usuario logueado (ver 0018_borrado_cuenta.sql):
 *
 * - Se borra todo lo que lo identifica: usuario de auth (email y
 *   contraseña), foto, disponibilidad, suscripciones a notificaciones,
 *   membresías y solicitudes pendientes.
 * - El perfil queda anonimizado como "Jugador eliminado" para que sus goles,
 *   convocatorias y votos sigan contando: si no, cambiarían los resultados de
 *   partidos ya jugados y las estadísticas de los demás.
 * - Los grupos donde era el único miembro se borran enteros.
 * - Si es el único admin de un grupo con más gente, no se borra nada: primero
 *   tiene que nombrar a otro admin (el grupo no puede quedar sin admin).
 */
export async function eliminarCuenta(formData: FormData) {
  if (String(formData.get("confirmacion") ?? "").trim().toUpperCase() !== PALABRA_CONFIRMACION) {
    return { error: `Escribí ${PALABRA_CONFIRMACION} para confirmar.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  // De acá en más con la service role: hay que tocar datos de grupos y de
  // auth que el usuario no puede modificar por RLS. El permiso es que es su
  // propia cuenta (chequeado arriba).
  const admin = createAdminClient();

  const { data: misMembresias } = await admin
    .from("grupo_miembros")
    .select("grupo_id, rol, grupos(nombre)")
    .eq("jugador_id", user.id);
  const membresias = (misMembresias ?? []) as unknown as {
    grupo_id: string;
    rol: string;
    grupos: { nombre: string } | null;
  }[];

  const grupoIds = membresias.map((m) => m.grupo_id);
  const { data: todosLosMiembros } = grupoIds.length
    ? await admin.from("grupo_miembros").select("grupo_id, jugador_id, rol").in("grupo_id", grupoIds)
    : { data: [] };

  const gruposABorrar: string[] = [];
  const gruposQueDejo: string[] = [];
  const bloqueantes: string[] = [];
  for (const m of membresias) {
    const otros = (todosLosMiembros ?? []).filter((x) => x.grupo_id === m.grupo_id && x.jugador_id !== user.id);
    if (otros.length === 0) gruposABorrar.push(m.grupo_id);
    else if (m.rol === "admin" && !otros.some((x) => x.rol === "admin")) bloqueantes.push(m.grupos?.nombre ?? "un grupo");
    else gruposQueDejo.push(m.grupo_id);
  }

  if (bloqueantes.length > 0) {
    return {
      error: `Sos el único admin de ${bloqueantes.join(", ")}. Antes de borrar tu cuenta, hacé admin a otro miembro desde Admin → Miembros (o salí del grupo si sos el único).`,
    };
  }

  // Grupos donde era el único: se borran enteros (cascada a partidos, etc.).
  if (gruposABorrar.length > 0) {
    await admin.storage.from("logos").remove(gruposABorrar.map((id) => `${id}/logo.png`));
    const { error } = await admin.from("grupos").delete().in("id", gruposABorrar);
    if (error) return { error: error.message };
  }

  // Todo lo que lo identifica o lo vincula a un grupo.
  const borrados = await Promise.all([
    admin.from("grupo_miembros").delete().eq("jugador_id", user.id),
    admin.from("grupo_solicitudes").delete().eq("jugador_id", user.id),
    admin.from("bloqueos_disponibilidad").delete().eq("jugador_id", user.id),
    admin.from("push_subscriptions").delete().eq("user_id", user.id),
  ]);
  const errorBorrado = borrados.find((r) => r.error)?.error;
  if (errorBorrado) return { error: errorBorrado.message };

  await admin.storage.from("avatars").remove([`${user.id}/avatar.jpg`]);

  const { error: anonimizarError } = await admin
    .from("profiles")
    .update({
      nombre: "Jugador",
      apellido: "eliminado",
      apodo: "Jugador eliminado",
      foto_url: null,
      eliminado_en: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (anonimizarError) return { error: anonimizarError.message };

  // Por último el usuario de auth: email, contraseña y sesiones.
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) return { error: authError.message };

  // Votaciones o desempates que solo esperaban su voto pueden cerrarse ahora.
  for (const grupoId of gruposQueDejo) await revisarTrasSalida(grupoId);

  await supabase.auth.signOut();
  (await cookies()).delete(GRUPO_COOKIE);
  redirect("/login?aviso=" + encodeURIComponent("Tu cuenta se borró. ¡Gracias por haber jugado!"));
}
