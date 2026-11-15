"use server";

import { revalidatePath } from "next/cache";
import { getContexto, rolEn } from "@/lib/grupo";
import { urlConGrupo } from "@/lib/grupo-cookie";
import { enviarPush } from "@/lib/push/send";
import { esPartidoInterno, getConfig, nombresDelPartido } from "@/lib/config";
import { validarFormacion } from "@/lib/formacion";

/** El partido, sus convocados (menos los que no juegan) y si quien pide es admin del grupo. */
async function cargar(partidoId: string) {
  const ctx = await getContexto();
  const { data: partido } = await ctx.supabase
    .from("partidos")
    .select("id, grupo_id, rival, nombre_equipo, desafio_id, cancelado_en")
    .eq("id", partidoId)
    .maybeSingle();
  if (!partido || !ctx.user) return null;
  const { data: convocados } = await ctx.supabase
    .from("partido_jugadores")
    .select("jugador_id, equipo, respuesta")
    .eq("partido_id", partidoId)
    .neq("respuesta", "no_juega");
  return {
    ctx,
    partido,
    convocados: convocados ?? [],
    esAdmin: rolEn(ctx, partido.grupo_id) === "admin",
  };
}

/**
 * El admin guarda la formación del partido (de cuánto se juega, la
 * formación, quién va en cada posición, invitados con nombre). Desde ahí
 * todos ven esa en "La cancha". Con `avisar`, les llega una notificación a
 * los convocados.
 */
export async function guardarFormacion({
  partidoId,
  formacion,
  avisar,
}: {
  partidoId: string;
  formacion: unknown;
  avisar: boolean;
}) {
  const datos = await cargar(partidoId);
  if (!datos) return { error: "Partido no encontrado." };
  const { ctx, partido, convocados, esAdmin } = datos;
  if (!esAdmin) return { error: "Solo el admin puede guardar la formación." };
  if (partido.cancelado_en) return { error: "El partido está cancelado." };

  const enEquipo2 = convocados.filter((c) => c.equipo === 2).length;
  const dosEquipos = esPartidoInterno(enEquipo2, partido.desafio_id, partido.nombre_equipo) && enEquipo2 > 0;
  const revisada = validarFormacion(formacion, {
    jugadores: new Set(convocados.map((c) => c.jugador_id)),
    dosEquipos,
  });
  if ("error" in revisada) return revisada;

  const { error } = await ctx.supabase
    .from("partidos")
    .update({ formacion: { ...revisada.formacion, guardada_en: new Date().toISOString() } })
    .eq("id", partidoId);
  if (error) return { error: error.message };

  if (avisar) {
    const config = await getConfig(ctx.supabase, partido.grupo_id);
    const { nosotros } = nombresDelPartido(partido, dosEquipos, config);
    const cruce = dosEquipos ? `${nosotros} vs ${partido.rival}` : `vs ${partido.rival}`;
    await enviarPush(
      convocados.map((c) => c.jugador_id).filter((id) => id !== ctx.user!.id),
      {
        title: "Ya está la formación",
        body: `${cruce}: fútbol ${revisada.formacion.futbol}, ${revisada.formacion.formacion}. Mirá dónde jugás.`,
        url: urlConGrupo(`/partidos/${partidoId}/cancha`, partido.grupo_id),
      }
    );
  }

  revalidatePath(`/partidos/${partidoId}`);
  revalidatePath(`/partidos/${partidoId}/cancha`);
  return { success: true };
}

/** Saca la formación guardada: La cancha vuelve a armarse sola con los convocados. */
export async function borrarFormacion(partidoId: string) {
  const datos = await cargar(partidoId);
  if (!datos) return { error: "Partido no encontrado." };
  if (!datos.esAdmin) return { error: "Solo el admin puede cambiar la formación." };
  const { error } = await datos.ctx.supabase.from("partidos").update({ formacion: null }).eq("id", partidoId);
  if (error) return { error: error.message };
  revalidatePath(`/partidos/${partidoId}`);
  revalidatePath(`/partidos/${partidoId}/cancha`);
  return { success: true };
}
