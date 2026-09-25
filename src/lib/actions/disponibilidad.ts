"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DisponibilidadTipo } from "@/lib/types";

export async function crearBloqueo(formData: FormData) {
  const tipo = String(formData.get("tipo") ?? "") as DisponibilidadTipo;
  const fechaDesde = String(formData.get("fecha_desde") ?? "").trim() || null;
  const fechaHasta = String(formData.get("fecha_hasta") ?? "").trim() || null;
  const diaSemanaRaw = String(formData.get("dia_semana") ?? "").trim();
  const diaSemana = diaSemanaRaw ? Number(diaSemanaRaw) : null;
  const horaDesde = String(formData.get("hora_desde") ?? "").trim() || null;
  const horaHasta = String(formData.get("hora_hasta") ?? "").trim() || null;
  const nota = String(formData.get("nota") ?? "").trim() || null;

  if (tipo !== "puntual" && tipo !== "rango" && tipo !== "recurrente") {
    return { error: "Tipo inválido." };
  }
  if (tipo === "puntual" && !fechaDesde) {
    return { error: "Elegí la fecha." };
  }
  if (tipo === "rango" && (!fechaDesde || !fechaHasta)) {
    return { error: "Completá desde y hasta." };
  }
  if (tipo === "rango" && fechaDesde! > fechaHasta!) {
    return { error: "La fecha de hasta tiene que ser posterior a la de desde." };
  }
  if (tipo === "recurrente" && (diaSemana === null || Number.isNaN(diaSemana) || diaSemana < 0 || diaSemana > 6)) {
    return { error: "Elegí un día de la semana." };
  }
  if (horaDesde && horaHasta && horaHasta <= horaDesde) {
    return { error: "El horario de hasta tiene que ser posterior al de desde." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase.from("bloqueos_disponibilidad").insert({
    jugador_id: user.id,
    tipo,
    fecha_desde: tipo === "recurrente" ? null : fechaDesde,
    fecha_hasta: tipo === "rango" ? fechaHasta : null,
    dia_semana: tipo === "recurrente" ? diaSemana : null,
    hora_desde: horaDesde,
    hora_hasta: horaHasta,
    nota,
  });

  if (error) return { error: error.message };

  revalidatePath("/perfil");
  return { success: true };
}

export async function eliminarBloqueo(formData: FormData) {
  const bloqueoId = String(formData.get("bloqueo_id") ?? "");
  if (!bloqueoId) return { error: "Bloqueo inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("bloqueos_disponibilidad")
    .delete()
    .eq("id", bloqueoId)
    .eq("jugador_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/perfil");
  return { success: true };
}
