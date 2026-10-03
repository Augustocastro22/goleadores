"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mismoBloqueo, validarBloqueo, type BloqueoNuevo } from "@/lib/disponibilidad";
import type { Bloqueo } from "@/lib/types";

/** Tope por guardado, para que nadie cargue miles de filas de una. */
const MAX_BLOQUEOS = 100;

function validarTodos(bloqueos: BloqueoNuevo[]): string | null {
  if (!Array.isArray(bloqueos)) return "Datos inválidos.";
  if (bloqueos.length > MAX_BLOQUEOS) return "Son demasiados días de una vez. Probá con menos.";
  for (const b of bloqueos) {
    const error = validarBloqueo(b);
    if (error) return error;
  }
  return null;
}

function aFila(b: BloqueoNuevo, jugadorId: string, grupoId: string | null, nota: string | null) {
  return {
    jugador_id: jugadorId,
    grupo_id: grupoId,
    tipo: b.tipo,
    fecha_desde: b.fecha_desde,
    fecha_hasta: b.fecha_hasta,
    dia_semana: b.dia_semana,
    hora_desde: b.hora_desde,
    hora_hasta: b.hora_hasta,
    // Solo si hay: así guardar sin excepciones no depende de la columna nueva.
    ...(b.excepciones?.length ? { excepciones: b.excepciones } : {}),
    nota,
  };
}

/**
 * Guarda de una vez los bloqueos armados desde el calendario o la agenda
 * (ver src/lib/disponibilidad.ts). Todos comparten grupo y nota. Los que ya
 * existían iguales no se vuelven a guardar. Devuelve las filas creadas para
 * mostrarlas al toque, sin esperar a que se recargue la página.
 */
export async function crearBloqueos({
  bloqueos,
  grupoId,
  nota,
}: {
  bloqueos: BloqueoNuevo[];
  grupoId: string | null;
  nota: string | null;
}): Promise<{ error: string } | { bloqueos: Bloqueo[] }> {
  if (!Array.isArray(bloqueos) || bloqueos.length === 0) return { error: "Elegí al menos un día." };
  const error = validarTodos(bloqueos);
  if (error) return { error };
  const grupo = grupoId || null;
  const notaLimpia = typeof nota === "string" ? nota.trim().slice(0, 100) || null : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: existentes } = await supabase
    .from("bloqueos_disponibilidad")
    .select("*")
    .eq("jugador_id", user.id)
    .returns<Bloqueo[]>();
  const nuevos: BloqueoNuevo[] = [];
  for (const b of bloqueos) {
    const conGrupo = { ...b, grupo_id: grupo };
    const repetido =
      (existentes ?? []).some((e) => mismoBloqueo(e, conGrupo)) ||
      nuevos.some((n) => mismoBloqueo({ ...n, grupo_id: grupo }, conGrupo));
    if (!repetido) nuevos.push(b);
  }
  if (nuevos.length === 0) return { bloqueos: [] };

  // RLS verifica que el grupo (si hay) sea uno del jugador.
  const { data, error: insertError } = await supabase
    .from("bloqueos_disponibilidad")
    .insert(nuevos.map((b) => aFila(b, user.id, grupo, notaLimpia)))
    .select("*")
    .returns<Bloqueo[]>();
  if (insertError) return { error: insertError.message };

  revalidatePath("/perfil");
  return { bloqueos: data ?? [] };
}

/**
 * Cambia un bloqueo por otros (mismo grupo y nota): sirve para editarle el
 * horario (uno nuevo) o para liberar un día de un rango (las partes que
 * quedan, ver partirRango). No hay permiso de update sobre la tabla, así que
 * se crean los nuevos y se borra el viejo.
 */
export async function reemplazarBloqueo({
  id,
  nuevos,
}: {
  id: string;
  nuevos: BloqueoNuevo[];
}): Promise<{ error: string } | { bloqueos: Bloqueo[] }> {
  if (!id) return { error: "Bloqueo inválido." };
  const error = validarTodos(nuevos);
  if (error) return { error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: original } = await supabase
    .from("bloqueos_disponibilidad")
    .select("*")
    .eq("id", id)
    .eq("jugador_id", user.id)
    .maybeSingle<Bloqueo>();
  if (!original) return { error: "Ese bloqueo ya no existe." };

  let creados: Bloqueo[] = [];
  if (nuevos.length > 0) {
    const { data, error: insertError } = await supabase
      .from("bloqueos_disponibilidad")
      .insert(nuevos.map((b) => aFila(b, user.id, original.grupo_id, original.nota)))
      .select("*")
      .returns<Bloqueo[]>();
    if (insertError) return { error: insertError.message };
    creados = data ?? [];
  }

  const { error: deleteError } = await supabase
    .from("bloqueos_disponibilidad")
    .delete()
    .eq("id", id)
    .eq("jugador_id", user.id);
  if (deleteError) return { error: deleteError.message };

  revalidatePath("/perfil");
  return { bloqueos: creados };
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
