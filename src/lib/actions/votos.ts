"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { votacionCerrada } from "@/lib/votacion";
import { calcularEmpate } from "@/lib/desempate";
import { enviarPush } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Desempate, EstadoVotacion, TipoVoto } from "@/lib/types";

const CATEGORIA_LABEL: Record<TipoVoto, string> = {
  MVP: "Mejor Jugador",
  PEOR: "Peor Jugador",
};

/**
 * Se llama justo cuando la votación de un partido acaba de cerrarse (todos
 * votaron, o venció el plazo). Para MVP y para Peor por separado, si hay
 * empate por el primer puesto y ese empate se puede definir sin riesgo de
 * volver a empatar (ver src/lib/desempate.ts), abre una revotación
 * exclusiva entre los empatados y avisa a quienes pueden definirlo y a los
 * admins. Si ya existe un desempate para ese partido+tipo, no hace nada
 * (no se reprocesa).
 */
export async function revisarEmpates(partidoId: string) {
  const admin = createAdminClient();

  const { data: partido } = await admin
    .from("partidos")
    .select("rival")
    .eq("id", partidoId)
    .single();
  if (!partido) return;

  const { data: participantesRaw } = await admin
    .from("partido_jugadores")
    .select("jugador_id, profiles(apodo)")
    .eq("partido_id", partidoId);
  const participantes = (participantesRaw ?? []) as unknown as {
    jugador_id: string;
    profiles: { apodo: string } | null;
  }[];
  if (participantes.length === 0) return;

  const apodoPorId = new Map(participantes.map((p) => [p.jugador_id, p.profiles?.apodo ?? ""]));
  const idsParticipantes = participantes.map((p) => p.jugador_id);

  const { data: admins } = await admin.from("profiles").select("id").eq("rol", "admin");
  const idsAdmins = (admins ?? []).map((a) => a.id);

  for (const tipo of ["MVP", "PEOR"] as const) {
    const { data: existente } = await admin
      .from("desempates")
      .select("id")
      .eq("partido_id", partidoId)
      .eq("tipo", tipo)
      .maybeSingle();
    if (existente) continue;

    const { data: votosRaw } = await admin
      .from("votos")
      .select("jugador_que_vota_id, jugador_votado_id")
      .eq("partido_id", partidoId)
      .eq("tipo", tipo);
    const votos = (votosRaw ?? []).map((v) => ({
      votante: v.jugador_que_vota_id,
      votado: v.jugador_votado_id,
    }));

    const empate = calcularEmpate(idsParticipantes, votos);
    if (!empate || !empate.definible) continue;

    const { error: insertError } = await admin.from("desempates").insert({
      partido_id: partidoId,
      tipo,
      candidatos: empate.empatados,
      elegibles: empate.elegibles,
    });
    if (insertError) continue;

    const categoria = CATEGORIA_LABEL[tipo];
    const nombresEmpatados = empate.empatados.map((id) => apodoPorId.get(id) ?? "?").join(" y ");

    await enviarPush(empate.elegibles, {
      title: "Tenés que definir un empate",
      body: `Empate en ${categoria} (${nombresEmpatados}) vs ${partido.rival}. Tu voto define quién gana.`,
      url: `/partidos/${partidoId}`,
    });

    const idsElegibles = new Set(empate.elegibles);
    const idsAdminsAAvisar = idsAdmins.filter((id) => !idsElegibles.has(id));
    if (idsAdminsAAvisar.length > 0) {
      await enviarPush(idsAdminsAAvisar, {
        title: "Empate a definir",
        body: `Empate en ${categoria} (${nombresEmpatados}) vs ${partido.rival}. Puede definirlo: ${empate.elegibles
          .map((id) => apodoPorId.get(id) ?? "?")
          .join(", ")}.`,
        url: `/partidos/${partidoId}`,
      });
    }
  }
}

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

      await revisarEmpates(partidoId);
    }
  }

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

  const admin = createAdminClient();
  const { data: votosDesempate } = await admin
    .from("desempate_votos")
    .select("jugador_votado_id")
    .eq("desempate_id", desempateId);

  if ((votosDesempate?.length ?? 0) >= desempate.elegibles.length) {
    const conteo = new Map<string, number>();
    for (const v of votosDesempate ?? []) {
      conteo.set(v.jugador_votado_id, (conteo.get(v.jugador_votado_id) ?? 0) + 1);
    }
    const maxVotos = Math.max(...conteo.values());
    const ganadores = [...conteo.entries()].filter(([, n]) => n === maxVotos).map(([gid]) => gid);
    // Por construcción (ver revisarEmpates/calcularEmpate) esto siempre da un
    // único ganador. Si por algún motivo no fuera así, se deja sin ganador:
    // el partido queda como el empate original, sin romper nada.
    const ganadorId = ganadores.length === 1 ? ganadores[0] : null;

    await admin
      .from("desempates")
      .update({ resuelto: true, ganador_id: ganadorId })
      .eq("id", desempateId);

    if (ganadorId) {
      const { data: partido } = await admin
        .from("partidos")
        .select("rival")
        .eq("id", desempate.partido_id)
        .single();
      const { data: participantes } = await admin
        .from("partido_jugadores")
        .select("jugador_id")
        .eq("partido_id", desempate.partido_id);

      if (partido && participantes) {
        await enviarPush(
          participantes.map((p) => p.jugador_id),
          {
            title: "Se definió el empate",
            body: `Ya se sabe quién ganó ${CATEGORIA_LABEL[desempate.tipo]} vs ${partido.rival}.`,
            url: `/partidos/${desempate.partido_id}`,
          }
        );
      }
    }
  }

  revalidatePath(`/partidos/${desempate.partido_id}`);
  revalidatePath("/estadisticas");
  return { success: true };
}
