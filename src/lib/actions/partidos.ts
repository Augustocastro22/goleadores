"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export async function createPartido(formData: FormData) {
  const { supabase, isAdmin, userId } = await requireAdmin();
  if (!isAdmin) return { error: "Solo el admin puede cargar partidos." };

  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "").trim() || null;
  const lugar = String(formData.get("lugar") ?? "").trim();
  const rival = String(formData.get("rival") ?? "").trim();

  const participantes: { jugador_id: string; equipo: 1 | 2 }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("equipo-")) continue;
    const equipo = Number(value);
    if (equipo !== 1 && equipo !== 2) continue;
    participantes.push({ jugador_id: key.slice("equipo-".length), equipo });
  }

  if (!fecha || !lugar || !rival || participantes.length === 0) {
    return { error: "Completá fecha, lugar, rival y al menos un jugador en el Equipo 1." };
  }
  if (!participantes.some((p) => p.equipo === 1)) {
    return { error: "Tiene que haber al menos un jugador en el Equipo 1 (nuestro equipo)." };
  }

  const { data: partido, error } = await supabase
    .from("partidos")
    .insert({ fecha, hora, lugar, rival, created_by: userId })
    .select()
    .single();

  if (error) return { error: error.message };

  const { error: pjError } = await supabase.from("partido_jugadores").insert(
    participantes.map(({ jugador_id, equipo }) => ({
      partido_id: partido.id,
      jugador_id,
      equipo,
      goles: 0,
    }))
  );

  if (pjError) return { error: pjError.message };

  const fechaFormateada = new Date(fecha + "T00:00:00").toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
  });
  const horaFormateada = hora ? ` a las ${hora.slice(0, 5)}` : "";
  const destinatarios = participantes.map((p) => p.jugador_id);
  await enviarPush(destinatarios, {
    title: "Nuevo partido",
    body: `${fechaFormateada}${horaFormateada} vs ${rival} en ${lugar}. ¡Ya estás convocado!`,
    url: `/partidos/${partido.id}`,
  });

  revalidatePath("/partidos");
  redirect(`/partidos/${partido.id}`);
}

export async function deletePartido(formData: FormData) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Solo el admin puede borrar partidos." };

  const partidoId = String(formData.get("partido_id") ?? "");
  if (!partidoId) return { error: "Partido inválido." };

  const { error } = await supabase.from("partidos").delete().eq("id", partidoId);
  if (error) return { error: error.message };

  revalidatePath("/partidos");
  revalidatePath("/estadisticas");
  redirect("/partidos");
}

export interface ConvocadosInput {
  partidoId: string;
  participantes: { jugadorId: string; equipo: 1 | 2 }[];
}

export async function actualizarConvocados({ partidoId, participantes }: ConvocadosInput) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Solo el admin puede editar la convocatoria." };
  if (!partidoId) return { error: "Partido inválido." };
  if (!participantes.some((p) => p.equipo === 1)) {
    return { error: "Tiene que haber al menos un jugador en el Equipo 1 (nuestro equipo)." };
  }

  const { data: partido } = await supabase
    .from("partidos")
    .select("rival, fecha, hora, lugar, jugado")
    .eq("id", partidoId)
    .single();
  if (!partido) return { error: "Partido no encontrado." };
  if (partido.jugado) {
    return { error: "El partido ya se jugó, no se puede editar la convocatoria." };
  }

  const { data: actualesRaw } = await supabase
    .from("partido_jugadores")
    .select("jugador_id, equipo")
    .eq("partido_id", partidoId);
  const actuales = actualesRaw ?? [];
  const actualesPorId = new Map(actuales.map((a) => [a.jugador_id, a.equipo]));
  const nuevosIds = new Set(participantes.map((p) => p.jugadorId));

  const aBorrar = actuales.filter((a) => !nuevosIds.has(a.jugador_id)).map((a) => a.jugador_id);
  const aAgregar = participantes.filter((p) => !actualesPorId.has(p.jugadorId));
  const aActualizar = participantes.filter(
    (p) => actualesPorId.has(p.jugadorId) && actualesPorId.get(p.jugadorId) !== p.equipo
  );

  if (aBorrar.length > 0) {
    const { error } = await supabase
      .from("partido_jugadores")
      .delete()
      .eq("partido_id", partidoId)
      .in("jugador_id", aBorrar);
    if (error) return { error: error.message };
  }

  if (aAgregar.length > 0) {
    const { error } = await supabase.from("partido_jugadores").insert(
      aAgregar.map(({ jugadorId, equipo }) => ({
        partido_id: partidoId,
        jugador_id: jugadorId,
        equipo,
        goles: 0,
      }))
    );
    if (error) return { error: error.message };
  }

  for (const { jugadorId, equipo } of aActualizar) {
    const { error } = await supabase
      .from("partido_jugadores")
      .update({ equipo })
      .eq("partido_id", partidoId)
      .eq("jugador_id", jugadorId);
    if (error) return { error: error.message };
  }

  if (aAgregar.length > 0 || aBorrar.length > 0) {
    const fechaFormateada = new Date(partido.fecha + "T00:00:00").toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
    });
    const horaFormateada = partido.hora ? ` a las ${partido.hora.slice(0, 5)}` : "";

    if (aAgregar.length > 0) {
      await enviarPush(
        aAgregar.map((p) => p.jugadorId),
        {
          title: "Nuevo partido",
          body: `${fechaFormateada}${horaFormateada} vs ${partido.rival} en ${partido.lugar}. ¡Ya estás convocado!`,
          url: `/partidos/${partidoId}`,
        }
      );
    }

    if (aBorrar.length > 0) {
      await enviarPush(aBorrar, {
        title: "Ya no estás convocado",
        body: `Te bajaron del partido vs ${partido.rival} del ${fechaFormateada}${horaFormateada}.`,
        url: `/partidos/${partidoId}`,
      });
    }
  }

  revalidatePath(`/partidos/${partidoId}`);
  return { success: true };
}

export interface GolesInput {
  partidoId: string;
  goles: { jugadorId: string; goles: number }[];
  golesOtros: number;
  golesRival: number;
}

export async function guardarGolesPartido({ partidoId, goles, golesOtros, golesRival }: GolesInput) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Solo el admin puede cargar goles." };

  if (
    !partidoId ||
    Number.isNaN(golesOtros) ||
    golesOtros < 0 ||
    Number.isNaN(golesRival) ||
    golesRival < 0 ||
    goles.some((g) => Number.isNaN(g.goles) || g.goles < 0)
  ) {
    return { error: "Datos de goles inválidos." };
  }

  const { data: partido } = await supabase
    .from("partidos")
    .select("rival, votacion_abierta_notificada")
    .eq("id", partidoId)
    .single();
  if (!partido) return { error: "Partido no encontrado." };

  for (const { jugadorId, goles: cantidad } of goles) {
    const { error } = await supabase
      .from("partido_jugadores")
      .update({ goles: cantidad })
      .eq("partido_id", partidoId)
      .eq("jugador_id", jugadorId);
    if (error) return { error: error.message };
  }

  const { error: partidoError } = await supabase
    .from("partidos")
    .update({ goles_otros: golesOtros, goles_rival: golesRival, jugado: true })
    .eq("id", partidoId);
  if (partidoError) return { error: partidoError.message };

  if (!partido.votacion_abierta_notificada) {
    const { data: participantes } = await supabase
      .from("partido_jugadores")
      .select("jugador_id")
      .eq("partido_id", partidoId);

    await enviarPush(
      (participantes ?? []).map((p) => p.jugador_id),
      {
        title: "¡Se abrió la votación!",
        body: `Votá Mejor Jugador y Peor Jugador del partido vs ${partido.rival}.`,
        url: `/partidos/${partidoId}`,
      }
    );

    await supabase
      .from("partidos")
      .update({ votacion_abierta_notificada: true })
      .eq("id", partidoId);
  }

  revalidatePath(`/partidos/${partidoId}`);
  revalidatePath("/estadisticas");
  return { success: true };
}
