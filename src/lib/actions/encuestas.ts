"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encuestaCerrada } from "@/lib/encuestas";
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
  const cierraEn = new Date(cierraEnRaw);
  if (Number.isNaN(cierraEn.getTime()) || cierraEn <= new Date()) {
    return { error: "La fecha de cierre tiene que ser en el futuro." };
  }
  if (opciones.length < MIN_OPCIONES) return { error: `Cargá al menos ${MIN_OPCIONES} opciones.` };
  if (opciones.length > MAX_OPCIONES) return { error: `Máximo ${MAX_OPCIONES} opciones.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: encuesta, error } = await supabase
    .from("encuestas")
    .insert({ pregunta, creado_por: user.id, cierra_en: cierraEn.toISOString() })
    .select()
    .single();
  if (error) return { error: error.message };

  const { error: opcionesError } = await supabase
    .from("encuesta_opciones")
    .insert(opciones.map((texto, i) => ({ encuesta_id: encuesta.id, texto, orden: i })));
  if (opcionesError) return { error: opcionesError.message };

  const { data: jugadores } = await supabase.from("profiles").select("id").neq("id", user.id);
  await enviarPush(
    (jugadores ?? []).map((j) => j.id),
    { title: "Nueva encuesta", body: pregunta, url: "/encuestas" }
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
    .select("cierra_en")
    .eq("id", encuestaId)
    .single();
  if (!encuesta) return { error: "Encuesta no encontrada." };

  const [{ data: resultados }, { count: totalParticipantes }] = await Promise.all([
    supabase.rpc("get_resultados_encuesta", { p_encuesta_id: encuestaId }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
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
