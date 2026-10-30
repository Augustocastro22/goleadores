import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push/send";
import { urlConGrupo } from "@/lib/grupo-cookie";
import {
  categoriasTexto,
  formatearCierreVotacion,
  proximoRecordatorioVotacion,
  puedeCerrarVotacionAMano,
} from "@/lib/votacion";

/*
 * Recordatorios de las votaciones abiertas. Los manda el cron una vez por día
 * (a la mañana): como mucho dos por partido, el primero cuando faltan unas 40
 * horas para el cierre y el último cuando faltan 24 o menos.
 *
 * - A los que jugaron y todavía no votaron: que falta su voto y hasta cuándo.
 * - Al admin que cargó el partido (si ya no es admin, a los admins del grupo):
 *   cuántos faltan votar y cuándo cierra, y desde cuándo puede cerrarla a mano.
 *
 * No es un archivo "use server": no chequea permisos (lo llama el cron).
 */

export async function recordarVotaciones(ahora: Date = new Date()) {
  const admin = createAdminClient();

  const { data: partidos } = await admin
    .from("partidos")
    .select("id, grupo_id, rival, created_by, con_mvp, con_peor, votacion_cierra_en, votacion_recordatorios")
    .eq("jugado", true)
    .eq("con_votacion", true)
    .eq("votacion_cerrada_notificada", false)
    .gt("votacion_cierra_en", ahora.toISOString());

  let avisados = 0;
  for (const partido of partidos ?? []) {
    const tipo = proximoRecordatorioVotacion({
      cierraEn: partido.votacion_cierra_en,
      enviados: partido.votacion_recordatorios,
      ahora,
    });
    if (!tipo || !partido.votacion_cierra_en) continue;

    // Se marca antes de avisar, y solo si nadie lo marcó en el medio (el cron
    // corriendo dos veces): el recordatorio sale una sola vez.
    const { data: marcado } = await admin
      .from("partidos")
      .update({ votacion_recordatorios: tipo === "ultimo" ? 2 : 1 })
      .eq("id", partido.id)
      .eq("votacion_recordatorios", partido.votacion_recordatorios)
      .select("id");
    if (!marcado || marcado.length === 0) continue;

    const [{ data: miembrosRaw }, { data: participantesRaw }, { data: votosRaw }] = await Promise.all([
      admin.from("grupo_miembros").select("jugador_id, rol").eq("grupo_id", partido.grupo_id),
      admin.from("partido_jugadores").select("jugador_id").eq("partido_id", partido.id),
      admin.from("votos").select("tipo, jugador_que_vota_id").eq("partido_id", partido.id),
    ]);
    const miembros = miembrosRaw ?? [];
    const enGrupo = new Set(miembros.map((m) => m.jugador_id));
    const participantes = (participantesRaw ?? []).map((p) => p.jugador_id).filter((id) => enGrupo.has(id));
    const votos = votosRaw ?? [];
    const yaVoto = (jugadorId: string, categoria: "MVP" | "PEOR") =>
      votos.some((v) => v.jugador_que_vota_id === jugadorId && v.tipo === categoria);
    // Falta votar quien no votó en alguna de las categorías que tiene el partido.
    const faltan = participantes.filter(
      (id) => (partido.con_mvp && !yaVoto(id, "MVP")) || (partido.con_peor && !yaVoto(id, "PEOR"))
    );
    if (faltan.length === 0) continue;

    const url = urlConGrupo(`/partidos/${partido.id}`, partido.grupo_id);
    const cierre = formatearCierreVotacion(partido.votacion_cierra_en);
    const categorias = categoriasTexto({ conMvp: partido.con_mvp, conPeor: partido.con_peor });

    // A quién se le avisa el panorama: al que cargó el partido; si ya no es admin, a los admins.
    const admins = miembros.filter((m) => m.rol === "admin").map((m) => m.jugador_id);
    const aAvisarAdmin = partido.created_by && admins.includes(partido.created_by) ? [partido.created_by] : admins;

    await enviarPush(faltan, {
      title: tipo === "ultimo" ? "Última chance para votar" : "Falta tu voto",
      body: `Votá ${categorias} del partido vs ${partido.rival}: la votación cierra el ${cierre}.`,
      url,
    });
    avisados += faltan.length;

    if (aAvisarAdmin.length > 0) {
      const cuantos =
        faltan.length === 1
          ? `Falta 1 de ${participantes.length} por votar`
          : `Faltan ${faltan.length} de ${participantes.length} por votar`;
      const cerrarYa = puedeCerrarVotacionAMano(partido.votacion_cierra_en, ahora)
        ? " Podés cerrarla desde el partido."
        : "";
      await enviarPush(aAvisarAdmin, {
        title: tipo === "ultimo" ? "La votación cierra pronto" : "Votación abierta",
        body: `${cuantos} vs ${partido.rival}. Cierra el ${cierre}.${cerrarYa}`,
        url,
      });
    }
  }
  return avisados;
}
