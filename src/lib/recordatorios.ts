import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push/send";
import { urlConGrupo } from "@/lib/grupo-cookie";
import { hoyArgentina, partidoYaPaso } from "@/lib/confirmacion";

/*
 * Recordatorio a los convocados que todavía no dijeron si juegan. Lo manda el
 * cron una vez por día (a la mañana): a los de un partido de mañana y a los
 * de uno de hoy que todavía no empezó. Y a los admins, el día del partido,
 * cuántos faltan.
 *
 * No es un archivo "use server": no chequea permisos (lo llama el cron).
 */

/** A quien convocaron (o le recordaron) hace menos que esto no se le vuelve a avisar todavía. */
export const HORAS_SIN_RECORDAR = 12;

function diaSiguiente(fecha: string) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Si a este convocado le toca un recordatorio: lo convocaron hace más de
 * HORAS_SIN_RECORDAR (si no, el aviso de la convocatoria está fresco) y no se
 * le recordó en ese mismo lapso.
 */
export function tocaRecordar(
  convocado: { convocado_en: string; recordado_en: string | null },
  ahora: Date = new Date()
): boolean {
  const limite = ahora.getTime() - HORAS_SIN_RECORDAR * 60 * 60 * 1000;
  return (
    new Date(convocado.convocado_en).getTime() <= limite &&
    (convocado.recordado_en === null || new Date(convocado.recordado_en).getTime() <= limite)
  );
}

export async function recordarConfirmaciones(ahora: Date = new Date()) {
  const admin = createAdminClient();
  const hoy = hoyArgentina(ahora);
  const manana = diaSiguiente(hoy);

  const { data: partidos } = await admin
    .from("partidos")
    .select("id, grupo_id, fecha, hora, rival, lugar")
    .eq("jugado", false)
    .in("fecha", [hoy, manana]);

  let recordados = 0;
  for (const partido of partidos ?? []) {
    if (partidoYaPaso(partido.fecha, partido.hora, ahora)) continue;

    const [{ data: pendientesRaw }, { data: miembrosRaw }] = await Promise.all([
      admin
        .from("partido_jugadores")
        .select("id, jugador_id, convocado_en, recordado_en")
        .eq("partido_id", partido.id)
        .eq("respuesta", "pendiente"),
      admin.from("grupo_miembros").select("jugador_id, rol").eq("grupo_id", partido.grupo_id),
    ]);
    const miembros = miembrosRaw ?? [];
    const enGrupo = new Set(miembros.map((m) => m.jugador_id));
    const pendientes = (pendientesRaw ?? []).filter((p) => enGrupo.has(p.jugador_id));
    if (pendientes.length === 0) continue;

    const esHoy = partido.fecha === hoy;
    const cuando = `${esHoy ? "Hoy" : "Mañana"}${partido.hora ? ` a las ${partido.hora.slice(0, 5)}` : ""}`;
    const url = urlConGrupo(`/partidos/${partido.id}`, partido.grupo_id);

    const aRecordar = pendientes.filter((p) => tocaRecordar(p, ahora));
    if (aRecordar.length > 0) {
      await enviarPush(
        aRecordar.map((p) => p.jugador_id),
        {
          title: esHoy ? "¿Jugás hoy?" : "¿Jugás mañana?",
          body: `${cuando} vs ${partido.rival} en ${partido.lugar}. Todavía no confirmaste si vas.`,
          url,
        }
      );
      await admin
        .from("partido_jugadores")
        .update({ recordado_en: ahora.toISOString() })
        .in(
          "id",
          aRecordar.map((p) => p.id)
        );
      recordados += aRecordar.length;
    }

    // El día del partido, los admins se enteran de cuántos faltan (los tienen que definir ellos).
    if (esHoy) {
      const admins = miembros.filter((m) => m.rol === "admin").map((m) => m.jugador_id);
      const faltan =
        pendientes.length === 1 ? "1 convocado todavía no confirmó" : `${pendientes.length} convocados todavía no confirmaron`;
      await enviarPush(admins, { title: "Faltan confirmaciones", body: `${faltan} para hoy vs ${partido.rival}.`, url });
    }
  }
  return recordados;
}
