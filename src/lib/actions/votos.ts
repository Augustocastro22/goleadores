"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { votacionCerrada } from "@/lib/votacion";
import { enviarPush } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("fecha, rival, jugado, votacion_cerrada_notificada")
    .eq("id", partidoId)
    .single();
  if (!partido) return { error: "Partido no encontrado." };
  if (!partido.jugado) return { error: "Todavía no se cargaron los resultados de este partido." };

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

  if (!partido.votacion_cerrada_notificada) {
    const { data: estadoNuevo } = await supabase
      .rpc("get_estado_votacion", { p_partido_id: partidoId })
      .single<EstadoVotacion>();

    const cerradaAhora =
      estadoNuevo &&
      votacionCerrada({
        fechaPartido: partido.fecha,
        totalParticipantes: estadoNuevo.total_participantes,
        votosMvp: estadoNuevo.votos_mvp,
        votosPeor: estadoNuevo.votos_peor,
      });

    if (cerradaAhora) {
      const { data: participantes } = await supabase
        .from("partido_jugadores")
        .select("jugador_id")
        .eq("partido_id", partidoId);

      await enviarPush(
        (participantes ?? []).map((p) => p.jugador_id),
        {
          title: "Se cerró la votación",
          body: `Ya se puede ver quién ganó Mejor Jugador y Peor Jugador vs ${partido.rival}.`,
          url: `/partidos/${partidoId}`,
        }
      );

      // Un jugador cualquiera (no admin) puede ser quien complete la votación,
      // y la tabla partidos solo se puede actualizar como admin vía RLS.
      await createAdminClient()
        .from("partidos")
        .update({ votacion_cerrada_notificada: true })
        .eq("id", partidoId);
    }
  }

  revalidatePath(`/partidos/${partidoId}`);
  revalidatePath("/estadisticas");
  return { success: true };
}
