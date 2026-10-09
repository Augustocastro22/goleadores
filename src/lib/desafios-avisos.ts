import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push/send";
import { urlConGrupo } from "@/lib/grupo-cookie";
import { fechaDesafio } from "@/lib/desafios";

/**
 * Avisos push de las etapas 2 y 3 de los desafíos (suspender, fechas,
 * resultado). Lee con la service role porque el aviso le llega también al
 * otro grupo, que RLS no deja ver; así lo puede usar el cron, que no tiene
 * sesión. Nunca corta el flujo que lo llama: si algo falla no avisa y listo.
 */

export type EventoDesafio =
  | "suspendido"
  | "fecha_propuesta"
  | "fecha_aceptada"
  | "fecha_rechazada"
  | "fecha_auto"
  | "resultado_propuesto"
  | "resultado_verificado"
  | "resultado_auto"
  | "resultado_sin_verificar";

interface DesafioRow {
  id: string;
  grupo_desafiante_id: string | null;
  grupo_desafiado_id: string | null;
  nombre_desafiante: string;
  nombre_desafiado: string;
  fecha: string;
  hora: string | null;
  lugar: string;
  propuesta_fecha: string | null;
  propuesta_hora: string | null;
  propuesta_lugar: string | null;
  goles_desafiante: number | null;
  goles_desafiado: number | null;
}

interface Lado {
  grupoId: string;
  nombre: string;
  rival: string;
  partidoId: string | null;
  convocados: string[];
  admins: string[];
  pideConfirmacion: boolean;
}

async function cargarLados(desafioId: string) {
  const admin = createAdminClient();
  const { data: d } = await admin.from("desafios").select("*").eq("id", desafioId).maybeSingle<DesafioRow>();
  if (!d) return null;

  const grupoIds = [d.grupo_desafiante_id, d.grupo_desafiado_id].filter((id): id is string => !!id);
  const [{ data: partidos }, { data: admins }, { data: config }, { data: pendiente }] = await Promise.all([
    admin.from("partidos").select("id, grupo_id, partido_jugadores(jugador_id)").eq("desafio_id", desafioId),
    admin.from("grupo_miembros").select("grupo_id, jugador_id").in("grupo_id", grupoIds).eq("rol", "admin"),
    admin
      .from("config")
      .select("grupo_id, valor")
      .in("grupo_id", grupoIds)
      .eq("clave", "pedir_confirmacion"),
    admin
      .from("desafio_resultados")
      .select("goles_desafiante, goles_desafiado, propuesto_por_grupo_id")
      .eq("desafio_id", desafioId)
      .eq("estado", "pendiente")
      .maybeSingle(),
  ]);

  const lados: Lado[] = grupoIds.map((grupoId) => {
    const esDesafiante = grupoId === d.grupo_desafiante_id;
    const partido = (partidos ?? []).find((p) => p.grupo_id === grupoId) as
      | { id: string; partido_jugadores: { jugador_id: string }[] }
      | undefined;
    return {
      grupoId,
      nombre: esDesafiante ? d.nombre_desafiante : d.nombre_desafiado,
      rival: esDesafiante ? d.nombre_desafiado : d.nombre_desafiante,
      partidoId: partido?.id ?? null,
      convocados: partido?.partido_jugadores.map((pj) => pj.jugador_id) ?? [],
      admins: (admins ?? []).filter((a) => a.grupo_id === grupoId).map((a) => a.jugador_id),
      pideConfirmacion: (config ?? []).some((c) => c.grupo_id === grupoId && c.valor === true),
    };
  });
  return { d, lados, pendiente };
}

/**
 * Avisa un evento de un desafío. `grupoQueActua` es el grupo del admin que
 * hizo el cambio (null si fue el cron); `excluir`, quién no recibe el aviso
 * (el que hizo el cambio). `fechaRechazada` es la fecha que se rechazó (ya
 * no está en la base cuando se avisa).
 */
export async function avisarDesafio(
  desafioId: string,
  evento: EventoDesafio,
  opts: { grupoQueActua?: string | null; excluir?: string | null; fechaRechazada?: string } = {}
) {
  try {
    const cargado = await cargarLados(desafioId);
    if (!cargado) return;
    const { d, lados, pendiente } = cargado;
    const actua = lados.find((l) => l.grupoId === opts.grupoQueActua) ?? null;
    const marcador = (gd: number | null, gdo: number | null) =>
      `${d.nombre_desafiante} ${gd ?? "?"} – ${gdo ?? "?"} ${d.nombre_desafiado}`;

    for (const lado of lados) {
      const esElQueActua = actua?.grupoId === lado.grupoId;
      const url = lado.partidoId
        ? urlConGrupo(`/partidos/${lado.partidoId}`, lado.grupoId)
        : urlConGrupo("/partidos/desafios", lado.grupoId);
      let destinatarios: string[] = [];
      let title = "";
      let body = "";

      switch (evento) {
        case "suspendido":
          destinatarios = [...lado.convocados, ...(esElQueActua ? [] : lado.admins)];
          title = "Se suspendió el partido";
          body = esElQueActua
            ? `El partido contra ${lado.rival} del ${fechaDesafio(d.fecha, d.hora)} se suspendió.`
            : `${lado.rival} suspendió el partido del ${fechaDesafio(d.fecha, d.hora)}.`;
          break;
        case "fecha_propuesta":
          if (esElQueActua || !d.propuesta_fecha) continue;
          destinatarios = lado.admins;
          title = "Proponen otra fecha";
          body = `${lado.rival} propone jugar el ${fechaDesafio(d.propuesta_fecha, d.propuesta_hora)} en ${d.propuesta_lugar}. Aceptala o rechazala.`;
          break;
        case "fecha_rechazada":
          if (esElQueActua) continue;
          destinatarios = lado.admins;
          title = "Rechazaron la fecha";
          body = `${lado.rival} no puede el ${opts.fechaRechazada ?? "día propuesto"}. Podés proponer otra.`;
          break;
        case "fecha_aceptada":
        case "fecha_auto":
          destinatarios = [...lado.convocados, ...lado.admins];
          title = evento === "fecha_auto" ? "Nueva fecha confirmada" : "Cambió la fecha del partido";
          body =
            `El partido contra ${lado.rival} ahora es el ${fechaDesafio(d.fecha, d.hora)} en ${d.lugar}.` +
            (lado.pideConfirmacion ? " Confirmá si jugás." : "");
          break;
        case "resultado_propuesto":
          if (esElQueActua || !pendiente) continue;
          destinatarios = lado.admins;
          title = "Cargaron el resultado";
          body = `${lado.rival} cargó ${marcador(pendiente.goles_desafiante, pendiente.goles_desafiado)}. Confirmalo o corregilo.`;
          break;
        case "resultado_verificado":
        case "resultado_auto":
          destinatarios = [...lado.convocados, ...lado.admins];
          title = "Resultado confirmado";
          body =
            marcador(d.goles_desafiante, d.goles_desafiado) +
            (evento === "resultado_auto" ? " (se confirmó solo: nadie lo respondió en 3 días)." : ".");
          break;
        case "resultado_sin_verificar":
          destinatarios = lado.admins;
          title = "Resultado sin verificar";
          body = `No hubo acuerdo con ${lado.rival}: el partido queda sin verificar y cada grupo con su resultado.`;
          break;
      }

      await enviarPush(
        destinatarios.filter((id) => id !== opts.excluir),
        { title, body, url }
      );
    }
  } catch (err) {
    console.error("No se pudo avisar el desafío:", err);
  }
}
