"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    .insert({ fecha, lugar, rival, created_by: userId })
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

  revalidatePath("/partidos");
  redirect(`/partidos/${partido.id}`);
}

export async function setGolesRival(formData: FormData) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Solo el admin puede cargar el resultado." };

  const partidoId = String(formData.get("partido_id") ?? "");
  const golesRival = Number(formData.get("goles_rival") ?? 0);

  if (!partidoId || Number.isNaN(golesRival) || golesRival < 0) {
    return { error: "Goles del rival inválidos." };
  }

  const { error } = await supabase
    .from("partidos")
    .update({ goles_rival: golesRival })
    .eq("id", partidoId);

  if (error) return { error: error.message };

  revalidatePath(`/partidos/${partidoId}`);
  return { success: true };
}

export async function setGolesOtros(formData: FormData) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Solo el admin puede cargar los goles de otros." };

  const partidoId = String(formData.get("partido_id") ?? "");
  const golesOtros = Number(formData.get("goles_otros") ?? 0);

  if (!partidoId || Number.isNaN(golesOtros) || golesOtros < 0) {
    return { error: "Goles de otros inválidos." };
  }

  const { error } = await supabase
    .from("partidos")
    .update({ goles_otros: golesOtros })
    .eq("id", partidoId);

  if (error) return { error: error.message };

  revalidatePath(`/partidos/${partidoId}`);
  return { success: true };
}

export async function setGoles(formData: FormData) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Solo el admin puede cargar goles." };

  const partidoId = String(formData.get("partido_id") ?? "");
  const jugadorId = String(formData.get("jugador_id") ?? "");
  const goles = Number(formData.get("goles") ?? 0);

  if (!partidoId || !jugadorId || Number.isNaN(goles) || goles < 0) {
    return { error: "Datos de goles inválidos." };
  }

  const { error } = await supabase
    .from("partido_jugadores")
    .update({ goles })
    .eq("partido_id", partidoId)
    .eq("jugador_id", jugadorId);

  if (error) return { error: error.message };

  revalidatePath(`/partidos/${partidoId}`);
  revalidatePath("/estadisticas");
  return { success: true };
}
