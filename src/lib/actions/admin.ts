"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enviarPush } from "@/lib/push/send";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, isAdmin: false, userId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  return { supabase, isAdmin: profile?.rol === "admin", userId: user.id };
}

export async function guardarConfig(formData: FormData) {
  const { supabase, isAdmin, userId } = await requireAdmin();
  if (!isAdmin) return { error: "Solo el admin puede cambiar la configuración." };

  const minJugadores = Number(formData.get("min_jugadores_votacion"));
  if (!Number.isInteger(minJugadores) || minJugadores < 0 || minJugadores > 50) {
    return { error: "El mínimo de jugadores tiene que ser un número entre 0 y 50." };
  }

  const { error } = await supabase.from("config").upsert({
    clave: "min_jugadores_votacion",
    valor: minJugadores,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function editarPartido(formData: FormData) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Solo el admin puede editar partidos." };

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
    .select("fecha, hora, jugado")
    .eq("id", partidoId)
    .single();
  if (!anterior) return { error: "Partido no encontrado." };

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
        url: `/partidos/${partidoId}`,
      }
    );
  }

  revalidatePath("/admin");
  revalidatePath("/partidos");
  revalidatePath(`/partidos/${partidoId}`);
  return { success: true };
}

export async function cambiarRol(formData: FormData) {
  const { supabase, isAdmin, userId } = await requireAdmin();
  if (!isAdmin) return { error: "Solo el admin puede cambiar roles." };

  const jugadorId = String(formData.get("jugador_id") ?? "");
  const rol = String(formData.get("rol") ?? "");
  if (!jugadorId || (rol !== "admin" && rol !== "jugador")) return { error: "Datos inválidos." };
  // Evita quedarse sin acceso a /admin por error.
  if (jugadorId === userId && rol !== "admin") {
    return { error: "No podés sacarte el rol de admin a vos mismo." };
  }

  const { error } = await supabase.from("profiles").update({ rol }).eq("id", jugadorId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/jugadores");
  return { success: true };
}
