"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { votacionCerrada } from "@/lib/votacion";
import { cierreDesempate } from "@/lib/desempate";
import { cerrarVotacionSiCorresponde, resolverDesempateSiCorresponde } from "@/lib/votaciones";
import type { Desempate, EstadoVotacion } from "@/lib/types";

export async function votar(formData: FormData) {
  const partidoId = String(formData.get("partido_id") ?? "");
  const jugadorVotadoId = String(formData.get("jugador_votado_id") ?? "");
  const tipo = String(formData.get("tipo") ?? "");

  if (!partidoId || !jugadorVotadoId || (tipo !== "MVP" && tipo !== "PEOR")) {
    return { error: "Voto inválido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: partido } = await supabase
    .from("partidos")
    .select("jugado, con_votacion, con_mvp, con_peor, votacion_cierra_en")
    .eq("id", partidoId)
    .single();
  if (!partido) return { error: "Partido no encontrado." };
  if (!partido.jugado) return { error: "Todavía no se cargaron los resultados de este partido." };
  if (!partido.con_votacion) {
    return { error: "Este partido no tiene votación: jugaron menos jugadores que el mínimo." };
  }
  if ((tipo === "MVP" && !partido.con_mvp) || (tipo === "PEOR" && !partido.con_peor)) {
    return { error: "En este partido no se vota esa categoría." };
  }

  const { data: estado } = await supabase
    .rpc("get_estado_votacion", { p_partido_id: partidoId })
    .single<EstadoVotacion>();

  if (
    estado &&
    votacionCerrada({
      cierraEn: partido.votacion_cierra_en,
      totalParticipantes: estado.total_participantes,
      votosMvp: estado.votos_mvp,
      votosPeor: estado.votos_peor,
      conMvp: partido.con_mvp,
      conPeor: partido.con_peor,
    })
  ) {
    return { error: "La votación de este partido ya está cerrada." };
  }

  // El mismo jugador no puede ser Mejor y Peor en el mismo voto.
  const { data: votoOtraCategoria } = await supabase
    .from("votos")
    .select("id")
    .eq("partido_id", partidoId)
    .eq("jugador_que_vota_id", user.id)
    .eq("jugador_votado_id", jugadorVotadoId)
    .neq("tipo", tipo)
    .maybeSingle();
  if (votoOtraCategoria) {
    return { error: "No podés votar al mismo jugador como Mejor y Peor." };
  }

  const { error } = await supabase.from("votos").insert({
    partido_id: partidoId,
    jugador_votado_id: jugadorVotadoId,
    jugador_que_vota_id: user.id,
    tipo,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya votaste en esta categoría para este partido." };
    }
    return { error: error.message };
  }

  // Si con este voto se completó, avisa, la marca cerrada y abre desempates.
  await cerrarVotacionSiCorresponde(partidoId);

  revalidatePath(`/partidos/${partidoId}`);
  revalidatePath("/estadisticas");
  return { success: true };
}

/**
 * Un admin del grupo cierra la votación a mano, pasadas 24 horas desde que se
 * cargó el resultado (ver cerrar_votacion en 0039_votacion_48h_cierre_manual.sql,
 * que es quien chequea el permiso y el plazo). Después sigue el cierre de
 * siempre: avisa a los que jugaron, la marca cerrada y abre los desempates.
 */
export async function cerrarVotacion(formData: FormData) {
  const partidoId = String(formData.get("partido_id") ?? "");
  if (!partidoId) return { error: "Partido inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase.rpc("cerrar_votacion", { p_partido_id: partidoId });
  if (error) return { error: error.message };

  await cerrarVotacionSiCorresponde(partidoId);

  revalidatePath(`/partidos/${partidoId}`);
  revalidatePath("/estadisticas");
  return { success: true };
}

/**
 * El form de votación del partido: Mejor y/o Peor en un solo envío. Devuelve
 * el error para mostrarlo (antes se descartaba y nadie sabía si había votado).
 */
export async function votarPartido(formData: FormData) {
  const partidoId = String(formData.get("partido_id") ?? "");
  const mvpId = String(formData.get("mvp_jugador_id") ?? "");
  const peorId = String(formData.get("peor_jugador_id") ?? "");
  if (!mvpId && !peorId) return { error: "Elegí a quién votar." };
  if (mvpId && mvpId === peorId) return { error: "No podés votar al mismo jugador como Mejor y Peor." };

  for (const [tipo, jugadorId] of [
    ["MVP", mvpId],
    ["PEOR", peorId],
  ] as const) {
    if (!jugadorId) continue;
    const voto = new FormData();
    voto.set("partido_id", partidoId);
    voto.set("tipo", tipo);
    voto.set("jugador_votado_id", jugadorId);
    const resultado = await votar(voto);
    if (resultado.error) {
      return {
        error:
          tipo === "PEOR" && mvpId
            ? `Se guardó tu voto de Mejor Jugador, pero no el de Peor: ${resultado.error}`
            : resultado.error,
      };
    }
  }
  return { success: true };
}

/** Vota en la revotación de desempate (solo para quien es elegible). */
export async function votarDesempate(formData: FormData) {
  const desempateId = String(formData.get("desempate_id") ?? "");
  const jugadorVotadoId = String(formData.get("jugador_votado_id") ?? "");
  if (!desempateId || !jugadorVotadoId) return { error: "Voto inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: desempate } = await supabase
    .from("desempates")
    .select("id, partido_id, tipo, candidatos, elegibles, resuelto, created_at")
    .eq("id", desempateId)
    .single<Pick<Desempate, "id" | "partido_id" | "tipo" | "candidatos" | "elegibles" | "resuelto" | "created_at">>();
  if (!desempate) return { error: "Empate no encontrado." };
  if (desempate.resuelto) return { error: "Este empate ya se definió." };
  if (new Date() >= cierreDesempate(desempate.created_at)) {
    await resolverDesempateSiCorresponde(desempateId);
    revalidatePath(`/partidos/${desempate.partido_id}`);
    return { error: "Ya venció el plazo para definir este empate." };
  }
  if (!desempate.elegibles.includes(user.id)) {
    return { error: "No podés definir este empate." };
  }
  if (!desempate.candidatos.includes(jugadorVotadoId)) {
    return { error: "Candidato inválido." };
  }

  const { error } = await supabase.from("desempate_votos").insert({
    desempate_id: desempateId,
    jugador_votado_id: jugadorVotadoId,
    jugador_que_vota_id: user.id,
  });

  if (error) {
    if (error.code === "23505") return { error: "Ya definiste este empate." };
    return { error: error.message };
  }

  await resolverDesempateSiCorresponde(desempateId);

  revalidatePath(`/partidos/${desempate.partido_id}`);
  revalidatePath("/estadisticas");
  return { success: true };
}
