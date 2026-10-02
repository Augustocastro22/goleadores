"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { votacionCerrada } from "@/lib/votacion";
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
    .select("fecha, jugado, con_votacion, con_mvp, con_peor")
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
      fechaPartido: partido.fecha,
      totalParticipantes: estado.total_participantes,
      votosMvp: estado.votos_mvp,
      votosPeor: estado.votos_peor,
      conMvp: partido.con_mvp,
      conPeor: partido.con_peor,
    })
  ) {
    return { error: "La votación de este partido ya está cerrada." };
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
    .select("id, partido_id, tipo, candidatos, elegibles, resuelto")
    .eq("id", desempateId)
    .single<Pick<Desempate, "id" | "partido_id" | "tipo" | "candidatos" | "elegibles" | "resuelto">>();
  if (!desempate) return { error: "Empate no encontrado." };
  if (desempate.resuelto) return { error: "Este empate ya se definió." };
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
