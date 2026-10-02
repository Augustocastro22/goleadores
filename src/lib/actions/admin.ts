"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { enviarPush } from "@/lib/push/send";
import { getContexto, rolEn } from "@/lib/grupo";
import { urlConGrupo } from "@/lib/grupo-cookie";
import { filasConfig, parseConfig } from "@/lib/config";

/** Todo lo de /admin opera sobre el grupo activo, y solo si es admin ahí. */
async function requireAdmin() {
  const ctx = await getContexto();
  const grupo = ctx.user && ctx.grupo?.rol === "admin" ? ctx.grupo : null;
  return { ctx, supabase: ctx.supabase, grupo, userId: ctx.user?.id ?? null };
}

export async function guardarConfig(formData: FormData) {
  const { supabase, grupo, userId } = await requireAdmin();
  if (!grupo || !userId) return { error: "Solo el admin puede cambiar la configuración." };

  const config = parseConfig(formData);
  if ("error" in config) return config;

  const { error } = await supabase.from("config").upsert(filasConfig(grupo.id, config, userId));
  if (error) return { error: error.message };

  // Prender/apagar la votación cambia qué se muestra en estadísticas y plantel.
  revalidatePath("/", "layout");
  return { success: true };
}

export async function editarPartido(formData: FormData) {
  const { ctx, supabase } = await requireAdmin();

  const partidoId = String(formData.get("partido_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "").trim() || null;
  const lugar = String(formData.get("lugar") ?? "").trim();
  const rival = String(formData.get("rival") ?? "").trim();
  const avisar = formData.get("avisar") === "on";
  if (!partidoId || !fecha || !lugar || !rival) {
    return { error: "Completá fecha, lugar y rival." };
  }

  const { data: anterior } = await supabase
    .from("partidos")
    .select("grupo_id, fecha, hora, jugado")
    .eq("id", partidoId)
    .single();
  if (!anterior) return { error: "Partido no encontrado." };
  if (rolEn(ctx, anterior.grupo_id) !== "admin") {
    return { error: "Solo el admin puede editar partidos." };
  }

  const { error } = await supabase
    .from("partidos")
    .update({ fecha, hora, lugar, rival })
    .eq("id", partidoId);
  if (error) return { error: error.message };

  // Solo se avisa el cambio de horario de un partido que todavía no se jugó;
  // cambiar lugar o rival no manda nada.
  const cambioHorario = anterior.fecha !== fecha || (anterior.hora?.slice(0, 5) ?? null) !== hora;
  if (avisar && cambioHorario && !anterior.jugado) {
    const { data: convocados } = await supabase
      .from("partido_jugadores")
      .select("jugador_id")
      .eq("partido_id", partidoId);
    const fechaFormateada = new Date(fecha + "T00:00:00").toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const horaFormateada = hora ? ` a las ${hora}` : "";
    await enviarPush(
      (convocados ?? []).map((c) => c.jugador_id),
      {
        title: "Cambió el horario del partido",
        body: `El partido vs ${rival} ahora es el ${fechaFormateada}${horaFormateada} en ${lugar}.`,
        url: urlConGrupo(`/partidos/${partidoId}`, anterior.grupo_id),
      }
    );
  }

  revalidatePath("/admin");
  revalidatePath("/partidos");
  revalidatePath(`/partidos/${partidoId}`);
  return { success: true };
}

export async function cambiarRol(formData: FormData) {
  const { supabase, grupo, userId } = await requireAdmin();
  if (!grupo) return { error: "Solo el admin puede cambiar roles." };

  const jugadorId = String(formData.get("jugador_id") ?? "");
  const rol = String(formData.get("rol") ?? "");
  if (!jugadorId || (rol !== "admin" && rol !== "jugador")) return { error: "Datos inválidos." };
  // Evita quedarse sin acceso a /admin por error.
  if (jugadorId === userId && rol !== "admin") {
    return { error: "No podés sacarte el rol de admin a vos mismo." };
  }

  const { error } = await supabase
    .from("grupo_miembros")
    .update({ rol })
    .eq("grupo_id", grupo.id)
    .eq("jugador_id", jugadorId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/jugadores");
  return { success: true };
}

export async function sacarDelGrupo(formData: FormData) {
  const { supabase, grupo, userId } = await requireAdmin();
  if (!grupo) return { error: "Solo el admin puede sacar gente del grupo." };

  const jugadorId = String(formData.get("jugador_id") ?? "");
  if (!jugadorId) return { error: "Datos inválidos." };
  if (jugadorId === userId) return { error: "Para irte del grupo usá la pantalla de grupos." };

  // Sus partidos jugados quedan en el historial; solo deja de ser miembro.
  const { error } = await supabase
    .from("grupo_miembros")
    .delete()
    .eq("grupo_id", grupo.id)
    .eq("jugador_id", jugadorId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/jugadores");
  return { success: true };
}

/** Nombre del grupo y si el link de invitación pide aprobación del admin. */
export async function guardarGrupo(formData: FormData) {
  const { supabase, grupo } = await requireAdmin();
  if (!grupo) return { error: "Solo el admin puede cambiar los datos del grupo." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const requiereAprobacion = formData.get("requiere_aprobacion") === "on";
  if (!nombre) return { error: "Poné un nombre para el grupo." };
  if (nombre.length > 60) return { error: "El nombre puede tener hasta 60 caracteres." };

  const { error } = await supabase
    .from("grupos")
    .update({ nombre, requiere_aprobacion: requiereAprobacion })
    .eq("id", grupo.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

/** Invalida el link de invitación anterior (por si se filtró) y genera uno nuevo. */
export async function regenerarInvitacion() {
  const { supabase, grupo } = await requireAdmin();
  if (!grupo) return { error: "Solo el admin puede renovar la invitación." };

  const { error } = await supabase
    .from("grupos")
    .update({ codigo_invitacion: randomBytes(5).toString("hex") })
    .eq("id", grupo.id);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function aceptarSolicitud(formData: FormData) {
  const { supabase, grupo } = await requireAdmin();
  if (!grupo) return { error: "Solo el admin puede aceptar solicitudes." };

  const jugadorId = String(formData.get("jugador_id") ?? "");
  if (!jugadorId) return { error: "Datos inválidos." };

  const { data: aceptada, error } = await supabase.rpc("aceptar_solicitud", {
    p_grupo_id: grupo.id,
    p_jugador_id: jugadorId,
  });
  if (error) return { error: error.message };
  if (!aceptada) return { error: "Esa solicitud ya no existe (quizás la canceló)." };

  await enviarPush([jugadorId], {
    title: `Ya sos parte de ${grupo.nombre}`,
    body: "Te aceptaron en el grupo. Entrá para ver los partidos.",
    url: urlConGrupo("/partidos", grupo.id),
  });

  revalidatePath("/admin");
  revalidatePath("/jugadores");
  return { success: true };
}

export async function rechazarSolicitud(formData: FormData) {
  const { supabase, grupo } = await requireAdmin();
  if (!grupo) return { error: "Solo el admin puede rechazar solicitudes." };

  const jugadorId = String(formData.get("jugador_id") ?? "");
  if (!jugadorId) return { error: "Datos inválidos." };

  // Sin aviso al que pidió: simplemente deja de figurar como pendiente.
  const { error } = await supabase
    .from("grupo_solicitudes")
    .delete()
    .eq("grupo_id", grupo.id)
    .eq("jugador_id", jugadorId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB (llega ya redimensionado a 256px)

/** Sube (o reemplaza) el escudo del grupo activo. */
export async function subirLogoGrupo(formData: FormData) {
  const { supabase, grupo } = await requireAdmin();
  if (!grupo) return { error: "Solo el admin puede cambiar el escudo." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Elegí una imagen." };
  if (file.size > MAX_LOGO_BYTES) return { error: "La imagen no puede superar los 2 MB." };

  // Siempre el mismo path: el nuevo pisa al anterior en vez de acumular.
  const path = `${grupo.id}/logo.png`;
  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, await file.arrayBuffer(), { contentType: "image/png", upsert: true });
  if (uploadError) return { error: uploadError.message };

  const { data } = supabase.storage.from("logos").getPublicUrl(path);
  const logo_url = `${data.publicUrl}?v=${Date.now()}`;

  const { error } = await supabase.from("grupos").update({ logo_url }).eq("id", grupo.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true, logo_url };
}

export async function quitarLogoGrupo() {
  const { supabase, grupo } = await requireAdmin();
  if (!grupo) return { error: "Solo el admin puede cambiar el escudo." };

  await supabase.storage.from("logos").remove([`${grupo.id}/logo.png`]);
  const { error } = await supabase.from("grupos").update({ logo_url: null }).eq("id", grupo.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}
