"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContexto } from "@/lib/grupo";
import { urlConGrupo } from "@/lib/grupo-cookie";
import { encuestaCerrada } from "@/lib/encuestas";
import { instanteArgentina } from "@/lib/confirmacion";
import { enviarPush } from "@/lib/push/send";
import type { ResultadoEncuesta } from "@/lib/types";

const MAX_OPCIONES = 8;
const MIN_OPCIONES = 2;

export async function crearEncuesta(formData: FormData) {
  const pregunta = String(formData.get("pregunta") ?? "").trim();
  const cierraEnRaw = String(formData.get("cierra_en") ?? "").trim();
  const opciones = [...new Set(formData.getAll("opcion").map((o) => String(o).trim()).filter(Boolean))];

  if (!pregunta) return { error: "Escribí la pregunta." };
  if (!cierraEnRaw) return { error: "Elegí cuándo cierra." };
  const cierraEn = instanteArgentina(cierraEnRaw);
  if (!cierraEn || cierraEn <= new Date()) {
    return { error: "La fecha de cierre tiene que ser en el futuro." };
  }
  if (opciones.length < MIN_OPCIONES) return { error: `Cargá al menos ${MIN_OPCIONES} opciones.` };
  if (opciones.length > MAX_OPCIONES) return { error: `Máximo ${MAX_OPCIONES} opciones.` };

  const ctx = await getContexto();
  const { supabase, user } = ctx;
  if (!user) return { error: "No autenticado." };
  // El grupo que estaba mirando (no el de la cookie, que pudo cambiar en otra pestaña).
  const grupoId = String(formData.get("grupo_id") ?? "");
  const grupo = grupoId ? ctx.grupos.find((g) => g.id === grupoId) : ctx.grupo;
  if (!grupo) return { error: "Primero sumate a un grupo." };

  const { data: encuesta, error } = await supabase
    .from("encuestas")
    .insert({ grupo_id: grupo.id, pregunta, creado_por: user.id, cierra_en: cierraEn.toISOString() })
    .select()
    .single();
  if (error) return { error: error.message };

  const { error: opcionesError } = await supabase
    .from("encuesta_opciones")
    .insert(opciones.map((texto, i) => ({ encuesta_id: encuesta.id, texto, orden: i })));
  if (opcionesError) return { error: opcionesError.message };

  const { data: miembros } = await supabase
    .from("grupo_miembros")
    .select("jugador_id")
    .eq("grupo_id", grupo.id)
    .neq("jugador_id", user.id);
  await enviarPush(
    (miembros ?? []).map((m) => m.jugador_id),
    { title: `Nueva encuesta en ${grupo.nombre}`, body: pregunta, url: urlConGrupo("/encuestas", grupo.id) }
  );

  revalidatePath("/encuestas");
  return { success: true };
}

export async function votarEncuesta(formData: FormData) {
  const encuestaId = String(formData.get("encuesta_id") ?? "");
  const opcionId = String(formData.get("opcion_id") ?? "");
  if (!encuestaId || !opcionId) return { error: "Voto inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: encuesta } = await supabase
    .from("encuestas")
    .select("grupo_id, cierra_en")
    .eq("id", encuestaId)
    .single();
  if (!encuesta) return { error: "Encuesta no encontrada." };

  const [{ data: resultados }, { count: totalParticipantes }] = await Promise.all([
    supabase.rpc("get_resultados_encuesta", { p_encuesta_id: encuestaId }),
    supabase
      .from("grupo_miembros")
      .select("jugador_id", { count: "exact", head: true })
      .eq("grupo_id", encuesta.grupo_id),
  ]);
  const totalVotos = ((resultados ?? []) as ResultadoEncuesta[]).reduce((sum, r) => sum + r.votos, 0);

  if (
    encuestaCerrada({
      cierraEn: encuesta.cierra_en,
      totalParticipantes: totalParticipantes ?? 0,
      totalVotos,
    })
  ) {
    return { error: "La encuesta ya cerró." };
  }

  const { error } = await supabase.from("encuesta_votos").insert({
    encuesta_id: encuestaId,
    opcion_id: opcionId,
    jugador_id: user.id,
  });

  if (error) {
    if (error.code === "23505") return { error: "Ya votaste en esta encuesta." };
    return { error: error.message };
  }

  revalidatePath("/encuestas");
  return { success: true };
}

export async function eliminarEncuesta(formData: FormData) {
  const encuestaId = String(formData.get("encuesta_id") ?? "");
  if (!encuestaId) return { error: "Encuesta inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase.from("encuestas").delete().eq("id", encuestaId);
  if (error) return { error: error.message };

  revalidatePath("/encuestas");
  return { success: true };
}
