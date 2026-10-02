import { createAdminClient } from "@/lib/supabase/admin";
import { categoriasTexto, votacionCerrada } from "@/lib/votacion";
import { calcularEmpate } from "@/lib/desempate";
import { enviarPush } from "@/lib/push/send";
import { urlConGrupo } from "@/lib/grupo-cookie";
import type { TipoVoto } from "@/lib/types";

/*
 * Cierre de votaciones y desempates, del lado del servidor y con la service
 * role (avisos y cambios que no dependen de quién dispara la acción).
 *
 * No es un archivo "use server" a propósito: lo que se exporta de un
 * archivo así queda como una acción que se puede llamar desde el navegador,
 * y estas funciones no chequean permisos (las llaman acciones que sí lo
 * hacen, o el cron).
 *
 * Quien ya no es miembro del grupo no cuenta para cerrar nada (ver
 * 0017_ex_miembros.sql): sus votos ya emitidos valen para el resultado, pero
 * no se lo espera para cerrar la votación ni para definir un desempate.
 */

export const CATEGORIA_LABEL: Record<TipoVoto, string> = {
  MVP: "Mejor Jugador",
  PEOR: "Peor Jugador",
};

type Admin = ReturnType<typeof createAdminClient>;

async function miembrosDelGrupo(admin: Admin, grupoId: string): Promise<Set<string>> {
  const { data } = await admin.from("grupo_miembros").select("jugador_id").eq("grupo_id", grupoId);
  return new Set((data ?? []).map((m) => m.jugador_id));
}

/**
 * Se llama justo cuando la votación de un partido acaba de cerrarse. Para
 * MVP y para Peor por separado, si hay empate por el primer puesto y ese
 * empate se puede definir sin riesgo de volver a empatar (ver
 * src/lib/desempate.ts), abre una revotación exclusiva entre los empatados y
 * avisa a quienes pueden definirlo y a los admins. Si ya existe un
 * desempate para ese partido+tipo, no hace nada (no se reprocesa).
 */
export async function revisarEmpates(partidoId: string) {
  const admin = createAdminClient();

  const { data: partido } = await admin
    .from("partidos")
    .select("rival, grupo_id, con_mvp, con_peor")
    .eq("id", partidoId)
    .single();
  if (!partido) return;
  const tipos = (["MVP", "PEOR"] as const).filter((t) => (t === "MVP" ? partido.con_mvp : partido.con_peor));
  const url = urlConGrupo(`/partidos/${partidoId}`, partido.grupo_id);

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
  // Solo pueden definir un desempate los que siguen en el grupo.
  const miembros = await miembrosDelGrupo(admin, partido.grupo_id);
  const idsParticipantes = participantes.map((p) => p.jugador_id).filter((id) => miembros.has(id));

  const { data: admins } = await admin
    .from("grupo_miembros")
    .select("jugador_id")
    .eq("grupo_id", partido.grupo_id)
    .eq("rol", "admin");
  const idsAdmins = (admins ?? []).map((a) => a.jugador_id);

  for (const tipo of tipos) {
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
      url,
    });

    const idsElegibles = new Set(empate.elegibles);
    const idsAdminsAAvisar = idsAdmins.filter((id) => !idsElegibles.has(id));
    if (idsAdminsAAvisar.length > 0) {
      await enviarPush(idsAdminsAAvisar, {
        title: "Empate a definir",
        body: `Empate en ${categoria} (${nombresEmpatados}) vs ${partido.rival}. Puede definirlo: ${empate.elegibles
          .map((id) => apodoPorId.get(id) ?? "?")
          .join(", ")}.`,
        url,
      });
    }
  }
}

/**
 * Si la votación del partido terminó de completarse (votaron todos los que
 * jugaron y siguen en el grupo) y todavía no se avisó, avisa a los que
 * jugaron, la marca como cerrada y abre los desempates que correspondan.
 * Se llama después de cada voto y cuando alguien se va del grupo.
 */
export async function cerrarVotacionSiCorresponde(partidoId: string) {
  const admin = createAdminClient();
  const { data: partido } = await admin
    .from("partidos")
    .select("grupo_id, fecha, rival, jugado, con_votacion, con_mvp, con_peor, votacion_cerrada_notificada")
    .eq("id", partidoId)
    .single();
  if (!partido || !partido.jugado || !partido.con_votacion || partido.votacion_cerrada_notificada) return;

  const [miembros, { data: participantes }, { data: votos }] = await Promise.all([
    miembrosDelGrupo(admin, partido.grupo_id),
    admin.from("partido_jugadores").select("jugador_id").eq("partido_id", partidoId),
    admin.from("votos").select("tipo, jugador_que_vota_id").eq("partido_id", partidoId),
  ]);
  const votosDeMiembros = (votos ?? []).filter((v) => miembros.has(v.jugador_que_vota_id));

  const cerrada = votacionCerrada({
    fechaPartido: partido.fecha,
    totalParticipantes: (participantes ?? []).filter((p) => miembros.has(p.jugador_id)).length,
    votosMvp: votosDeMiembros.filter((v) => v.tipo === "MVP").length,
    votosPeor: votosDeMiembros.filter((v) => v.tipo === "PEOR").length,
    conMvp: partido.con_mvp,
    conPeor: partido.con_peor,
  });
  if (!cerrada) return;

  await enviarPush(
    (participantes ?? []).map((p) => p.jugador_id).filter((id) => miembros.has(id)),
    {
      title: "Se cerró la votación",
      body: `Ya se puede ver quién ganó ${categoriasTexto({ conMvp: partido.con_mvp, conPeor: partido.con_peor })} vs ${partido.rival}.`,
      url: urlConGrupo(`/partidos/${partidoId}`, partido.grupo_id),
    }
  );
  await admin.from("partidos").update({ votacion_cerrada_notificada: true }).eq("id", partidoId);
  await revisarEmpates(partidoId);
}

/**
 * Resuelve un desempate si ya votaron todos los elegibles que siguen en el
 * grupo. Si no queda ninguno que pueda votar, o la revotación vuelve a
 * empatar, se cierra sin ganador: cuenta el empate original (todos los
 * empatados), igual que cuando no se abre desempate.
 */
export async function resolverDesempateSiCorresponde(desempateId: string) {
  const admin = createAdminClient();
  const { data: desempate } = await admin
    .from("desempates")
    .select("id, partido_id, tipo, elegibles, resuelto, partidos(rival, grupo_id)")
    .eq("id", desempateId)
    .single();
  if (!desempate || desempate.resuelto) return;
  const partido = desempate.partidos as unknown as { rival: string; grupo_id: string } | null;
  if (!partido) return;

  const [miembros, { data: votosDesempate }] = await Promise.all([
    miembrosDelGrupo(admin, partido.grupo_id),
    admin.from("desempate_votos").select("jugador_votado_id").eq("desempate_id", desempateId),
  ]);
  const elegiblesActivos = (desempate.elegibles as string[]).filter((id) => miembros.has(id));
  const votos = votosDesempate ?? [];
  // Faltan votos de elegibles que siguen en el grupo: todavía no se resuelve.
  if (elegiblesActivos.length > 0 && votos.length < elegiblesActivos.length) return;

  const conteo = new Map<string, number>();
  for (const v of votos) conteo.set(v.jugador_votado_id, (conteo.get(v.jugador_votado_id) ?? 0) + 1);
  const maxVotos = conteo.size > 0 ? Math.max(...conteo.values()) : 0;
  const ganadores = [...conteo.entries()].filter(([, n]) => n === maxVotos).map(([id]) => id);
  const ganadorId = ganadores.length === 1 ? ganadores[0] : null;

  await admin.from("desempates").update({ resuelto: true, ganador_id: ganadorId }).eq("id", desempateId);

  if (ganadorId) {
    const { data: participantes } = await admin
      .from("partido_jugadores")
      .select("jugador_id")
      .eq("partido_id", desempate.partido_id);
    await enviarPush(
      (participantes ?? []).map((p) => p.jugador_id).filter((id) => miembros.has(id)),
      {
        title: "Se definió el empate",
        body: `Ya se sabe quién ganó ${CATEGORIA_LABEL[desempate.tipo as TipoVoto]} vs ${partido.rival}.`,
        url: urlConGrupo(`/partidos/${desempate.partido_id}`, partido.grupo_id),
      }
    );
  }
}

/**
 * Después de que alguien se va de un grupo (o lo sacan): las votaciones y
 * desempates que estaban esperando su voto pueden haber quedado completos.
 */
export async function revisarTrasSalida(grupoId: string) {
  const admin = createAdminClient();
  const { data: abiertos } = await admin
    .from("partidos")
    .select("id")
    .eq("grupo_id", grupoId)
    .eq("jugado", true)
    .eq("con_votacion", true)
    .eq("votacion_cerrada_notificada", false);
  for (const p of abiertos ?? []) await cerrarVotacionSiCorresponde(p.id);

  const { data: partidosDelGrupo } = await admin.from("partidos").select("id").eq("grupo_id", grupoId);
  const ids = (partidosDelGrupo ?? []).map((p) => p.id);
  if (ids.length === 0) return;
  const { data: pendientes } = await admin
    .from("desempates")
    .select("id")
    .eq("resuelto", false)
    .in("partido_id", ids);
  for (const d of pendientes ?? []) await resolverDesempateSiCorresponde(d.id);
}
