"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { randomBytes } from "node:crypto";
import { enviarPush } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { getContexto, rolEn } from "@/lib/grupo";
import { urlConGrupo } from "@/lib/grupo-cookie";
import { extraerCodigo, fechaDesafio } from "@/lib/desafios";
import { avisarDesafio } from "@/lib/desafios-avisos";

interface DesafioRow {
  id: string;
  grupo_desafiante_id: string | null;
  grupo_desafiado_id: string | null;
  nombre_desafiante: string;
  nombre_desafiado: string;
  fecha: string;
  hora: string | null;
  lugar: string;
  estado: string;
}

const DESAFIOS_URL = "/partidos/desafios";

/**
 * Admins de un grupo. Para avisarle al otro grupo hace falta la service
 * role: RLS no deja ver los miembros de un grupo del que no sos parte.
 */
async function adminsDe(grupoId: string | null): Promise<string[]> {
  if (!grupoId) return [];
  const { data, error } = await createAdminClient()
    .from("grupo_miembros")
    .select("jugador_id")
    .eq("grupo_id", grupoId)
    .eq("rol", "admin");
  if (error) console.error("No se pudieron leer los admins para avisar:", error);
  return (data ?? []).map((m) => m.jugador_id);
}

/** Partido de cada grupo de un desafío, con sus convocados (service role, por lo mismo). */
async function partidosDelDesafio(desafioId: string) {
  const { data, error } = await createAdminClient()
    .from("partidos")
    .select("id, grupo_id, partido_jugadores(jugador_id)")
    .eq("desafio_id", desafioId);
  if (error) return null;
  return data as { id: string; grupo_id: string; partido_jugadores: { jugador_id: string }[] }[];
}

async function getDesafio(desafioId: string) {
  const { supabase } = await getContexto();
  const { data } = await supabase.from("desafios").select("*").eq("id", desafioId).maybeSingle<DesafioRow>();
  return data;
}

function revalidar() {
  // "layout" incluye /partidos/desafios y la página de cada partido.
  revalidatePath("/partidos", "layout");
  revalidatePath("/estadisticas");
}

/** Nombre y escudo del grupo de un código, para confirmar a quién se desafía antes de mandarlo. */
export async function buscarGrupoParaDesafiar(codigo: string) {
  const { supabase, grupo } = await getContexto();
  if (grupo?.rol !== "admin") return { error: "Solo el admin puede desafiar a otro grupo." };
  const limpio = extraerCodigo(codigo);
  if (!limpio) return { error: "Pegá el código de desafío del otro grupo." };

  const { data } = await supabase
    .rpc("get_grupo_por_codigo_desafio", { p_codigo: limpio })
    .maybeSingle<{ id: string; nombre: string; logo_url: string | null; jugados: number; sin_verificar: number }>();
  if (!data) return { error: "No hay ningún grupo con ese código de desafío." };
  if (data.id === grupo.id) return { error: "Ese es el código de tu propio grupo." };
  return {
    grupo: {
      nombre: data.nombre,
      logoUrl: data.logo_url,
      jugados: Number(data.jugados),
      sinVerificar: Number(data.sin_verificar),
    },
  };
}

export async function crearDesafio(formData: FormData) {
  const { supabase, user, grupo } = await getContexto();
  if (!user || grupo?.rol !== "admin") return { error: "Solo el admin puede desafiar a otro grupo." };

  const codigo = extraerCodigo(String(formData.get("codigo") ?? ""));
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "").trim() || null;
  const lugar = String(formData.get("lugar") ?? "").trim();
  if (!codigo || !fecha || !lugar) return { error: "Completá fecha y lugar." };

  const { data: desafioId, error } = await supabase.rpc("crear_desafio", {
    p_grupo_id: grupo.id,
    p_codigo: codigo,
    p_fecha: fecha,
    p_hora: hora,
    p_lugar: lugar,
  });
  if (error) return { error: error.message };

  after(async () => {
    const desafio = await getDesafio(desafioId as string);
    if (!desafio?.grupo_desafiado_id) return;
    await enviarPush((await adminsDe(desafio.grupo_desafiado_id)).filter((id) => id !== user.id), {
      title: "¡Los desafiaron!",
      body: `${desafio.nombre_desafiante} quiere jugar el ${fechaDesafio(fecha, hora)} en ${lugar}. Aceptá o rechazá el desafío.`,
      url: urlConGrupo(DESAFIOS_URL, desafio.grupo_desafiado_id),
    });
  });

  revalidar();
  redirect(DESAFIOS_URL);
}

export async function responderDesafio(formData: FormData) {
  const desafioId = String(formData.get("desafio_id") ?? "");
  const acepta = formData.get("acepta") === "true";
  const { supabase, user } = await getContexto();
  if (!user || !desafioId) return { error: "Desafío inválido." };

  const { error } = await supabase.rpc("responder_desafio", { p_desafio_id: desafioId, p_acepta: acepta });
  if (error) return { error: error.message };

  after(async () => {
    const desafio = await getDesafio(desafioId);
    if (!desafio) return;
    const cuando = fechaDesafio(desafio.fecha, desafio.hora);
    if (acepta) {
      // A los admins de los dos grupos (menos al que aceptó), con el link a su partido.
      const partidos = (await partidosDelDesafio(desafioId)) ?? [];
      for (const partido of partidos) {
        const rival =
          partido.grupo_id === desafio.grupo_desafiante_id ? desafio.nombre_desafiado : desafio.nombre_desafiante;
        await enviarPush(
          (await adminsDe(partido.grupo_id)).filter((id) => id !== user.id),
          {
            title: "¡Hay partido!",
            body: `Contra ${rival} el ${cuando} en ${desafio.lugar}. Armá la convocatoria.`,
            url: urlConGrupo(`/partidos/${partido.id}`, partido.grupo_id),
          }
        );
      }
    } else if (desafio.grupo_desafiante_id) {
      await enviarPush((await adminsDe(desafio.grupo_desafiante_id)).filter((id) => id !== user.id), {
        title: "Rechazaron el desafío",
        body: `${desafio.nombre_desafiado} no juega el ${cuando}.`,
        url: urlConGrupo(DESAFIOS_URL, desafio.grupo_desafiante_id),
      });
    }
  });

  revalidar();
  return { success: true };
}

export async function cancelarDesafio(formData: FormData) {
  const desafioId = String(formData.get("desafio_id") ?? "");
  const ctx = await getContexto();
  const { supabase, user } = ctx;
  if (!user || !desafioId) return { error: "Desafío inválido." };

  const desafio = await getDesafio(desafioId);
  if (!desafio) return { error: "Desafío no encontrado." };

  // Desde qué grupo cancela: el de la pantalla donde tocó el botón (puede
  // ser admin de los dos grupos del desafío).
  const grupos = [desafio.grupo_desafiante_id, desafio.grupo_desafiado_id].filter(
    (id): id is string => !!id && rolEn(ctx, id) === "admin"
  );
  const grupoId = grupos.find((id) => id === formData.get("grupo_id")) ?? grupos[0];
  if (!grupoId) return { error: "Solo un admin de los grupos del desafío puede cancelarlo." };

  // El estado que tenía cuando lo vio: "Retirar" con la página vieja no tiene
  // que cancelar un partido que el otro grupo aceptó mientras tanto.
  const estadoVisto = String(formData.get("estado") ?? "");

  // Los convocados se leen antes, porque cancelar borra los partidos.
  // Si no se pueden leer no se cancela: los convocados se quedarían sin aviso.
  const partidos = desafio.estado === "aceptado" ? await partidosDelDesafio(desafioId) : [];
  if (!partidos) return { error: "No se pudo cancelar, probá de nuevo." };

  const { error } = await supabase.rpc("cancelar_desafio", {
    p_desafio_id: desafioId,
    p_grupo_id: grupoId,
    p_estado_esperado: estadoVisto,
  });
  if (error) return { error: error.message };

  const soyDesafiante = grupoId === desafio.grupo_desafiante_id;
  const miNombre = soyDesafiante ? desafio.nombre_desafiante : desafio.nombre_desafiado;
  const otroId = soyDesafiante ? desafio.grupo_desafiado_id : desafio.grupo_desafiante_id;
  const cuando = fechaDesafio(desafio.fecha, desafio.hora);

  after(async () => {
    if (desafio.estado === "pendiente") {
      await enviarPush((await adminsDe(otroId)).filter((id) => id !== user.id), {
        title: "Cancelaron el desafío",
        body: `${miNombre} retiró el desafío del ${cuando}.`,
        url: urlConGrupo(DESAFIOS_URL, otroId ?? ""),
      });
    } else {
      for (const partido of partidos) {
        const esMiGrupo = partido.grupo_id === grupoId;
        const rival =
          partido.grupo_id === desafio.grupo_desafiante_id ? desafio.nombre_desafiado : desafio.nombre_desafiante;
        const destinatarios = [
          ...partido.partido_jugadores.map((pj) => pj.jugador_id),
          // Los admins del otro grupo se enteran aunque todavía no se hayan convocado.
          ...(esMiGrupo ? [] : await adminsDe(partido.grupo_id)),
        ];
        await enviarPush(
          destinatarios.filter((id) => id !== user.id),
          {
            title: "Se canceló el partido",
            body: esMiGrupo
              ? `El partido contra ${rival} del ${cuando} se canceló.`
              : `${miNombre} canceló el partido del ${cuando}.`,
            url: urlConGrupo(DESAFIOS_URL, partido.grupo_id),
          }
        );
      }
    }
  });

  revalidar();
  // Puede venir de la página del partido, que ya no existe.
  redirect(DESAFIOS_URL);
}

/** Invalida el código de desafío anterior y genera uno nuevo. */
export async function regenerarCodigoDesafio() {
  const { supabase, grupo } = await getContexto();
  if (grupo?.rol !== "admin") return { error: "Solo el admin puede renovar el código." };

  const { error } = await supabase
    .from("grupos")
    .update({ codigo_desafio: randomBytes(5).toString("hex") })
    .eq("id", grupo.id);
  if (error) return { error: error.message };

  revalidatePath(DESAFIOS_URL);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Etapas 2 y 3: suspender, reprogramar y resultado. Todas reciben el grupo
// desde el que se actúa (el de la pantalla) y avisan en segundo plano.
// ─────────────────────────────────────────────────────────────────────────

/** El desafío y el grupo desde el que actúa el admin (puede ser admin de los dos). */
async function desdeGrupo(formData: FormData) {
  const ctx = await getContexto();
  const desafioId = String(formData.get("desafio_id") ?? "");
  if (!ctx.user || !desafioId) return null;
  const desafio = await getDesafio(desafioId);
  if (!desafio) return null;
  const grupos = [desafio.grupo_desafiante_id, desafio.grupo_desafiado_id].filter(
    (id): id is string => !!id && rolEn(ctx, id) === "admin"
  );
  const grupoId = grupos.find((id) => id === formData.get("grupo_id")) ?? grupos[0];
  if (!grupoId) return null;
  return { supabase: ctx.supabase, userId: ctx.user.id, desafio, grupoId };
}

const SIN_PERMISO = { error: "Solo un admin de los grupos del desafío puede hacer esto." };

export async function suspenderDesafio(formData: FormData) {
  const x = await desdeGrupo(formData);
  if (!x) return SIN_PERMISO;
  const { error } = await x.supabase.rpc("suspender_desafio", {
    p_desafio_id: x.desafio.id,
    p_grupo_id: x.grupoId,
  });
  if (error) return { error: error.message };
  after(() => avisarDesafio(x.desafio.id, "suspendido", { grupoQueActua: x.grupoId, excluir: x.userId }));
  revalidar();
  return { success: true };
}

export async function proponerFechaDesafio(formData: FormData) {
  const x = await desdeGrupo(formData);
  if (!x) return SIN_PERMISO;
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "").trim() || null;
  const lugar = String(formData.get("lugar") ?? "").trim();
  if (!fecha || !lugar) return { error: "Completá fecha y lugar." };

  const { error } = await x.supabase.rpc("proponer_fecha_desafio", {
    p_desafio_id: x.desafio.id,
    p_grupo_id: x.grupoId,
    p_fecha: fecha,
    p_hora: hora,
    p_lugar: lugar,
  });
  if (error) return { error: error.message };
  after(() => avisarDesafio(x.desafio.id, "fecha_propuesta", { grupoQueActua: x.grupoId, excluir: x.userId }));
  revalidar();
  return { success: true };
}

export async function responderFechaDesafio(formData: FormData) {
  const x = await desdeGrupo(formData);
  if (!x) return SIN_PERMISO;
  const acepta = formData.get("acepta") === "true";
  // Para el aviso del rechazo: después de rechazar la propuesta ya no está.
  const { data: antes } = await x.supabase
    .from("desafios")
    .select("propuesta_fecha, propuesta_hora")
    .eq("id", x.desafio.id)
    .single();

  const { error } = await x.supabase.rpc("responder_fecha_desafio", {
    p_desafio_id: x.desafio.id,
    p_grupo_id: x.grupoId,
    p_acepta: acepta,
  });
  if (error) return { error: error.message };
  const fechaRechazada = antes?.propuesta_fecha ? fechaDesafio(antes.propuesta_fecha, antes.propuesta_hora) : undefined;
  after(() =>
    avisarDesafio(x.desafio.id, acepta ? "fecha_aceptada" : "fecha_rechazada", {
      grupoQueActua: x.grupoId,
      excluir: x.userId,
      fechaRechazada,
    })
  );
  revalidar();
  return { success: true };
}

/** Propone el marcador (también sirve de contrapropuesta). Los goles vienen desde el lado de quien carga. */
export async function proponerResultadoDesafio(formData: FormData) {
  const x = await desdeGrupo(formData);
  if (!x) return SIN_PERMISO;
  const mios = Number(formData.get("goles_mios"));
  const rival = Number(formData.get("goles_rival"));
  if (![mios, rival].every((n) => Number.isInteger(n) && n >= 0 && n <= 99)) {
    return { error: "Revisá los goles: números enteros de 0 a 99." };
  }
  const soyDesafiante = x.grupoId === x.desafio.grupo_desafiante_id;

  const { data: resultado, error } = await x.supabase.rpc("proponer_resultado_desafio", {
    p_desafio_id: x.desafio.id,
    p_grupo_id: x.grupoId,
    p_goles_desafiante: soyDesafiante ? mios : rival,
    p_goles_desafiado: soyDesafiante ? rival : mios,
  });
  if (error) return { error: error.message };
  after(() =>
    avisarDesafio(x.desafio.id, resultado === "verificado" ? "resultado_verificado" : "resultado_propuesto", {
      grupoQueActua: x.grupoId,
      excluir: x.userId,
    })
  );
  revalidar();
  return { success: true };
}

export async function aceptarResultadoDesafio(formData: FormData) {
  const x = await desdeGrupo(formData);
  if (!x) return SIN_PERMISO;
  const { error } = await x.supabase.rpc("aceptar_resultado_desafio", {
    p_desafio_id: x.desafio.id,
    p_grupo_id: x.grupoId,
  });
  if (error) return { error: error.message };
  after(() => avisarDesafio(x.desafio.id, "resultado_verificado", { grupoQueActua: x.grupoId, excluir: x.userId }));
  revalidar();
  return { success: true };
}

export async function cortarResultadoDesafio(formData: FormData) {
  const x = await desdeGrupo(formData);
  if (!x) return SIN_PERMISO;
  const { error } = await x.supabase.rpc("cortar_resultado_desafio", {
    p_desafio_id: x.desafio.id,
    p_grupo_id: x.grupoId,
  });
  if (error) return { error: error.message };
  after(() => avisarDesafio(x.desafio.id, "resultado_sin_verificar", { grupoQueActua: x.grupoId, excluir: x.userId }));
  revalidar();
  return { success: true };
}
