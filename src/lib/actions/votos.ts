"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { votacionCerrada } from "@/lib/votacion";
import type { EstadoVotacion } from "@/lib/types";

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
    .select("fecha")
    .eq("id", partidoId)
    .single();
  if (!partido) return { error: "Partido no encontrado." };

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

  revalidatePath(`/partidos/${partidoId}`);
  revalidatePath("/estadisticas");
  return { success: true };
}
