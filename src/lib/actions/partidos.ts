"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { enviarPush } from "@/lib/push/send";
import { getConfig, votacionDelPartido } from "@/lib/config";
import { categoriasTexto } from "@/lib/votacion";
import { getContexto, rolEn } from "@/lib/grupo";
import { urlConGrupo } from "@/lib/grupo-cookie";
import { hoyArgentina, partidoYaPaso } from "@/lib/confirmacion";
import type { Respuesta } from "@/lib/types";
import type { DesafioVista } from "@/lib/desafios";
import { errorGolesPorCorregir, golesPorCorregir } from "@/lib/goles-por-corregir";

/** Si el usuario es admin del grupo al que pertenece el partido. */
async function requireAdminDePartido(partidoId: string) {
  const ctx = await getContexto();
  const { data } = await ctx.supabase
    .from("partidos")
    .select("grupo_id")
    .eq("id", partidoId)
    .maybeSingle();
  const grupoId: string | null = data?.grupo_id ?? null;
  return {
    supabase: ctx.supabase,
    userId: ctx.user?.id ?? null,
    grupoId,
    isAdmin: !!grupoId && rolEn(ctx, grupoId) === "admin",
  };
}

/**
 * Respuesta con la que entra un convocado nuevo. El admin que arma la
 * convocatoria y se convoca a sí mismo ya está diciendo que juega. `pedir`
 * es false si el grupo no pide confirmación o el partido ya pasó.
 */
function respuestaInicial(jugadorId: string, pedir: boolean, quienConvoca: string | null) {
  return pedir && jugadorId !== quienConvoca ? "pendiente" : "juega";
}

/** Aviso de convocatoria: si el grupo pide confirmación, se lo pide. */
function avisoConvocatoria(
  partido: { fecha: string; hora: string | null; rival: string; lugar: string },
  pedirConfirmacion: boolean
) {
  const fecha = new Date(partido.fecha + "T00:00:00").toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
  });
  const hora = partido.hora ? ` a las ${partido.hora.slice(0, 5)}` : "";
  const cierre = pedirConfirmacion ? "Estás convocado: confirmá si jugás." : "¡Ya estás convocado!";
  return {
    title: "Nuevo partido",
    body: `${fecha}${hora} vs ${partido.rival} en ${partido.lugar}. ${cierre}`,
  };
}

/**
 * Alta de un partido (ver NuevoPartidoForm). Con modo "programar" es una
 * convocatoria; con modo "jugado" se carga un partido que ya se jugó, con
 * quiénes jugaron y los goles, y queda jugado de una.
 */
export async function createPartido(formData: FormData) {
  const { supabase, user, grupo } = await getContexto();
  if (!user || grupo?.rol !== "admin") return { error: "Solo el admin puede cargar partidos." };

  const pendientes = await golesPorCorregir(supabase, grupo.id);
  if (pendientes.length > 0) return { error: errorGolesPorCorregir(pendientes) };

  const jugado = formData.get("modo") === "jugado";
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "").trim() || null;
  const lugar = String(formData.get("lugar") ?? "").trim();
  const rival = String(formData.get("rival") ?? "").trim();

  const participantes: { jugador_id: string; equipo: 1 | 2 }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("equipo-")) continue;
    const equipo = Number(value);
    if (equipo !== 1 && equipo !== 2) continue;
    participantes.push({ jugador_id: key.slice("equipo-".length), equipo });
  }

  if (!fecha || !lugar || !rival || participantes.length === 0) {
    return { error: "Completá fecha, lugar, rival y al menos un jugador en el Equipo 1." };
  }
  if (!participantes.some((p) => p.equipo === 1)) {
    return { error: "Tiene que haber al menos un jugador en el Equipo 1 (nuestro equipo)." };
  }
  const hoy = hoyArgentina();
  if (jugado && fecha > hoy) {
    return { error: "Ese partido todavía no se jugó: cargalo con \"Programar\"." };
  }
  if (!jugado && fecha < hoy) {
    return { error: "Esa fecha ya pasó: para cargar un partido que ya se jugó, elegí \"Ya se jugó\"." };
  }

  // Goles (solo modo jugado): de cada uno de los que jugaron y de los invitados.
  const leerGoles = (campo: string) => Number(formData.get(campo) ?? 0);
  const goles = participantes.map((p) => ({
    jugadorId: p.jugador_id,
    goles: leerGoles(`goles-${p.jugador_id}`),
  }));
  const golesOtros = leerGoles("goles_otros");
  const golesRival = leerGoles("goles_rival");
  const todos = [golesOtros, golesRival, ...goles.map((g) => g.goles)];
  if (jugado && todos.some((n) => !Number.isInteger(n) || n < 0)) {
    return { error: "Revisá los goles: tienen que ser números enteros, 0 o más." };
  }

  const { data: partido, error } = await supabase
    .from("partidos")
    .insert({ grupo_id: grupo.id, fecha, hora, lugar, rival, created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };

  // Un partido que ya pasó no es una convocatoria: entran todos como que
  // jugaron y no se avisa a nadie (los avisa guardarGolesPartido, más abajo).
  const yaPaso = jugado || partidoYaPaso(fecha, hora);
  const { pedir_confirmacion } = await getConfig(supabase, grupo.id);
  const pedir = pedir_confirmacion && !yaPaso;
  const { error: pjError } = await supabase.from("partido_jugadores").insert(
    participantes.map(({ jugador_id, equipo }) => ({
      partido_id: partido.id,
      jugador_id,
      equipo,
      goles: 0,
      respuesta: respuestaInicial(jugador_id, pedir, user.id),
    }))
  );

  if (pjError) return { error: pjError.message };

  // Al que lo cargó no le avisa: ya sabe que se convocó.
  if (!yaPaso) {
    await enviarPush(
      participantes.map((p) => p.jugador_id).filter((id) => id !== user.id),
      {
        ...avisoConvocatoria({ fecha, hora, rival, lugar }, pedir),
        url: urlConGrupo(`/partidos/${partido.id}`, grupo.id),
      }
    );
  }

  if (jugado) {
    // Lo mismo que cargar los goles desde el partido: lo marca jugado, decide
    // la votación y avisa el resultado.
    const resultado = await guardarGolesPartido({ partidoId: partido.id, goles, golesOtros, golesRival });
    if (resultado.error) {
      revalidatePath("/partidos");
      return { error: `Se creó el partido pero no se pudieron guardar los goles: ${resultado.error}` };
    }
  }

  revalidatePath("/partidos");
  redirect(`/partidos/${partido.id}`);
}

export async function deletePartido(formData: FormData) {
  const partidoId = String(formData.get("partido_id") ?? "");
  if (!partidoId) return { error: "Partido inválido." };

  const { supabase, isAdmin } = await requireAdminDePartido(partidoId);
  if (!isAdmin) return { error: "Solo el admin puede borrar partidos." };

  const { data: partido } = await supabase.from("partidos").select("desafio_id").eq("id", partidoId).single();
  if (partido?.desafio_id) {
    return { error: "Es un partido de un desafío: para que no se juegue, cancelá el desafío." };
  }

  const { error } = await supabase.from("partidos").delete().eq("id", partidoId);
  if (error) return { error: error.message };

  revalidatePath("/partidos");
  revalidatePath("/estadisticas");
  redirect("/partidos");
}

export interface ConvocadosInput {
  partidoId: string;
  participantes: { jugadorId: string; equipo: 1 | 2 }[];
}

export async function actualizarConvocados({ partidoId, participantes }: ConvocadosInput) {
  if (!partidoId) return { error: "Partido inválido." };
  const { supabase, userId, isAdmin, grupoId } = await requireAdminDePartido(partidoId);
  if (!isAdmin || !grupoId) return { error: "Solo el admin puede editar la convocatoria." };
  if (!participantes.some((p) => p.equipo === 1)) {
    return { error: "Tiene que haber al menos un jugador en el Equipo 1 (nuestro equipo)." };
  }

  const { data: partido } = await supabase
    .from("partidos")
    .select("rival, fecha, hora, lugar, jugado, desafio_id")
    .eq("id", partidoId)
    .single();
  if (!partido) return { error: "Partido no encontrado." };
  if (partido.jugado) {
    return { error: "El partido ya se jugó, no se puede editar la convocatoria." };
  }
  // En un desafío el Equipo 2 es el otro grupo.
  if (partido.desafio_id && participantes.some((p) => p.equipo === 2)) {
    return { error: "En un desafío todos los convocados juegan en el mismo equipo." };
  }

  const { data: actualesRaw } = await supabase
    .from("partido_jugadores")
    .select("jugador_id, equipo")
    .eq("partido_id", partidoId);
  const actuales = actualesRaw ?? [];
  const actualesPorId = new Map(actuales.map((a) => [a.jugador_id, a.equipo]));
  const nuevosIds = new Set(participantes.map((p) => p.jugadorId));

  const aBorrar = actuales.filter((a) => !nuevosIds.has(a.jugador_id)).map((a) => a.jugador_id);
  const aAgregar = participantes.filter((p) => !actualesPorId.has(p.jugadorId));
  const aActualizar = participantes.filter(
    (p) => actualesPorId.has(p.jugadorId) && actualesPorId.get(p.jugadorId) !== p.equipo
  );

  if (aBorrar.length > 0) {
    const { error } = await supabase
      .from("partido_jugadores")
      .delete()
      .eq("partido_id", partidoId)
      .in("jugador_id", aBorrar);
    if (error) return { error: error.message };
  }

  const yaPaso = partidoYaPaso(partido.fecha, partido.hora);
  const { pedir_confirmacion } = await getConfig(supabase, grupoId);
  const pedir = pedir_confirmacion && !yaPaso;
  if (aAgregar.length > 0) {
    const { error } = await supabase.from("partido_jugadores").insert(
      aAgregar.map(({ jugadorId, equipo }) => ({
        partido_id: partidoId,
        jugador_id: jugadorId,
        equipo,
        goles: 0,
        respuesta: respuestaInicial(jugadorId, pedir, userId),
      }))
    );
    if (error) return { error: error.message };
  }

  for (const { jugadorId, equipo } of aActualizar) {
    const { error } = await supabase
      .from("partido_jugadores")
      .update({ equipo })
      .eq("partido_id", partidoId)
      .eq("jugador_id", jugadorId);
    if (error) return { error: error.message };
  }

  if (!yaPaso && (aAgregar.length > 0 || aBorrar.length > 0)) {
    const fechaFormateada = new Date(partido.fecha + "T00:00:00").toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
    });
    const horaFormateada = partido.hora ? ` a las ${partido.hora.slice(0, 5)}` : "";

    if (aAgregar.length > 0) {
      await enviarPush(
        aAgregar.map((p) => p.jugadorId).filter((id) => id !== userId),
        {
          ...avisoConvocatoria(partido, pedir),
          url: urlConGrupo(`/partidos/${partidoId}`, grupoId),
        }
      );
    }

    if (aBorrar.length > 0) {
      await enviarPush(aBorrar.filter((id) => id !== userId), {
        title: "Ya no estás convocado",
        body: `Te bajaron del partido vs ${partido.rival} del ${fechaFormateada}${horaFormateada}.`,
        url: urlConGrupo(`/partidos/${partidoId}`, grupoId),
      });
    }
  }

  revalidatePath(`/partidos/${partidoId}`);
  return { success: true };
}

export interface GolesInput {
  partidoId: string;
  goles: { jugadorId: string; goles: number }[];
  golesOtros: number;
  golesRival: number;
}

export async function guardarGolesPartido({ partidoId, goles, golesOtros, golesRival }: GolesInput) {
  if (!partidoId) return { error: "Partido inválido." };
  const { supabase, isAdmin, grupoId } = await requireAdminDePartido(partidoId);
  if (!isAdmin || !grupoId) return { error: "Solo el admin puede cargar goles." };

  if (
    Number.isNaN(golesOtros) ||
    golesOtros < 0 ||
    Number.isNaN(golesRival) ||
    golesRival < 0 ||
    goles.some((g) => Number.isNaN(g.goles) || g.goles < 0)
  ) {
    return { error: "Datos de goles inválidos." };
  }

  const { data: partido } = await supabase
    .from("partidos")
    .select("rival, fecha, hora, jugado, con_votacion, con_mvp, con_peor, votacion_abierta_notificada, desafio_id")
    .eq("id", partidoId)
    .single();
  if (!partido) return { error: "Partido no encontrado." };
  // En un desafío, cargar el resultado hace que ninguno de los dos grupos lo
  // pueda cancelar: no vale hacerlo antes de que se juegue.
  if (partido.desafio_id && !partidoYaPaso(partido.fecha, partido.hora)) {
    return { error: "Es un desafío: el resultado se carga después de jugar el partido." };
  }
  // En un desafío el marcador es el del desafío (el acordado, o la última
  // versión de este grupo): los goles del rival salen de ahí, y lo que no
  // suman los jugadores va a "otros". Se ignora lo que venga del form.
  if (partido.desafio_id) {
    const { data: desafioRaw } = await supabase.rpc("get_desafios", {
      p_grupo_id: grupoId,
      p_desafio_id: partido.desafio_id,
    });
    const desafio = ((desafioRaw ?? []) as DesafioVista[])[0];
    // Los goles se cargan contra el resultado ya cerrado (confirmado o sin
    // verificar): si se cargaran antes y el resultado cambiara, quedarían
    // goles de más (o de menos) en la tabla de goleadores.
    const cerrado = desafio?.resultado_estado === "verificado" || desafio?.resultado_estado === "sin_verificar";
    if (!desafio || !cerrado || desafio.marcador_mios === null || desafio.marcador_rival === null) {
      return { error: "Los goles de cada uno se cargan cuando el resultado del desafío esté confirmado (arriba)." };
    }
    const deJugadores = goles.reduce((total, g) => total + g.goles, 0);
    if (deJugadores > desafio.marcador_mios) {
      return {
        error: `Cargaste ${deJugadores} goles de jugadores, pero en el resultado del desafío hicieron ${desafio.marcador_mios}.`,
      };
    }
    golesOtros = desafio.marcador_mios - deJugadores;
    golesRival = desafio.marcador_rival;
  }

  // La primera vez que se cargan los goles se decide qué vota el partido
  // (Mejor y/o Peor), según las reglas del grupo en /admin (qué categorías
  // vota y con qué mínimo de jugadores). Después ya no se reevalúa (ver
  // 0015_admin_config.sql y 0018_votacion_separada.sql): cambiar las reglas
  // no toca partidos ya jugados.
  let votacion = {
    con_votacion: partido.con_votacion,
    con_mvp: partido.con_mvp,
    con_peor: partido.con_peor,
  };
  if (!partido.jugado) {
    // Si el grupo pide confirmación: los que no respondieron los define el
    // admin antes de cargar el resultado, y los que no juegan salen del
    // partido (ver 0020_confirmacion.sql). Así, a partir de acá
    // partido_jugadores son solo los que jugaron.
    const { count: pendientes } = await supabase
      .from("partido_jugadores")
      .select("id", { count: "exact", head: true })
      .eq("partido_id", partidoId)
      .eq("respuesta", "pendiente");
    if (pendientes) {
      return { error: "Antes de cargar el resultado, definí si jugaron los que no respondieron." };
    }
    const { error: bajaError } = await supabase
      .from("partido_jugadores")
      .delete()
      .eq("partido_id", partidoId)
      .eq("respuesta", "no_juega");
    if (bajaError) return { error: bajaError.message };

    const [{ count }, config] = await Promise.all([
      supabase
        .from("partido_jugadores")
        .select("id", { count: "exact", head: true })
        .eq("partido_id", partidoId),
      getConfig(supabase, grupoId),
    ]);
    votacion = votacionDelPartido(count ?? 0, config);
  }

  for (const { jugadorId, goles: cantidad } of goles) {
    const { error } = await supabase
      .from("partido_jugadores")
      .update({ goles: cantidad })
      .eq("partido_id", partidoId)
      .eq("jugador_id", jugadorId);
    if (error) return { error: error.message };
  }

  const { error: partidoError } = await supabase
    .from("partidos")
    .update({
      goles_otros: golesOtros,
      goles_rival: golesRival,
      jugado: true,
      ...votacion,
      // Sin votación no hay nada que avisar (ni apertura ni cierre).
      ...(votacion.con_votacion ? {} : { votacion_abierta_notificada: true, votacion_cerrada_notificada: true }),
    })
    .eq("id", partidoId);
  if (partidoError) return { error: partidoError.message };

  const avisarVotacion = votacion.con_votacion && !partido.votacion_abierta_notificada;
  // Sin votación, la primera vez que se cargan los goles se avisa el resultado
  // (también si el partido se cargó después de jugarse).
  const avisarResultado = !votacion.con_votacion && !partido.jugado;
  if (avisarVotacion || avisarResultado) {
    const { data: participantesRaw } = await supabase
      .from("partido_jugadores")
      .select("jugador_id, equipo, goles")
      .eq("partido_id", partidoId);
    const participantes = participantesRaw ?? [];
    const golesDe = (equipo: number) =>
      participantes.filter((p) => p.equipo === equipo).reduce((total, p) => total + p.goles, 0);
    const resultado = `Nosotros ${golesDe(1) + golesOtros} – ${golesDe(2) + golesRival} ${partido.rival}`;

    await enviarPush(
      participantes.map((p) => p.jugador_id),
      avisarVotacion
        ? {
            title: "¡Se abrió la votación!",
            body: `${resultado}. Votá ${categoriasTexto({ conMvp: votacion.con_mvp, conPeor: votacion.con_peor })} del partido.`,
            url: urlConGrupo(`/partidos/${partidoId}`, grupoId),
          }
        : {
            title: "Se cargó el resultado",
            body: `${resultado}. Mirá los goles del partido.`,
            url: urlConGrupo(`/partidos/${partidoId}`, grupoId),
          }
    );
  }

  if (avisarVotacion) {
    await supabase
      .from("partidos")
      .update({ votacion_abierta_notificada: true })
      .eq("id", partidoId);
  }

  revalidatePath(`/partidos/${partidoId}`);
  revalidatePath("/estadisticas");
  return { success: true };
}

/** El convocado dice si juega. Si dice que no (o se arrepiente), se avisa a los admins. */
export async function responderConvocatoria(partidoId: string, juega: boolean) {
  const { supabase, user } = await getContexto();
  if (!user || !partidoId) return { error: "Partido inválido." };

  const { data: anterior } = await supabase
    .from("partido_jugadores")
    .select("respuesta, partidos(grupo_id, rival, fecha)")
    .eq("partido_id", partidoId)
    .eq("jugador_id", user.id)
    .maybeSingle<{ respuesta: Respuesta; partidos: { grupo_id: string; rival: string; fecha: string } }>();
  if (!anterior) return { error: "No estás convocado a este partido." };

  const { data: ok, error } = await supabase.rpc("responder_convocatoria", {
    p_partido_id: partidoId,
    p_juega: juega,
  });
  if (error) return { error: error.message };
  if (!ok) return { error: "El partido ya se jugó, no se puede cambiar." };

  const { grupo_id, rival, fecha } = anterior.partidos;
  const avisar = juega ? anterior.respuesta === "no_juega" : anterior.respuesta !== "no_juega";
  if (avisar) {
    const [{ data: admins }, { data: perfil }] = await Promise.all([
      supabase.from("grupo_miembros").select("jugador_id").eq("grupo_id", grupo_id).eq("rol", "admin"),
      supabase.from("profiles").select("apodo").eq("id", user.id).single(),
    ]);
    const fechaFormateada = new Date(fecha + "T00:00:00").toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
    });
    const apodo = perfil?.apodo ?? "Un convocado";
    await enviarPush(
      (admins ?? []).map((a) => a.jugador_id).filter((id) => id !== user.id),
      {
        title: juega ? `${apodo} al final juega` : `${apodo} no juega`,
        body: `Partido vs ${rival} del ${fechaFormateada}.`,
        url: urlConGrupo(`/partidos/${partidoId}`, grupo_id),
      }
    );
  }

  revalidatePath(`/partidos/${partidoId}`);
  return { success: true };
}

/**
 * El admin define la respuesta de un convocado: para los que no respondieron
 * o para corregir imprevistos (dijo que sí y faltó, dijo que no y fue).
 */
export async function fijarRespuesta(partidoId: string, jugadorId: string, respuesta: Respuesta) {
  if (!partidoId || !jugadorId || !["pendiente", "juega", "no_juega"].includes(respuesta)) {
    return { error: "Datos inválidos." };
  }
  const { supabase, isAdmin } = await requireAdminDePartido(partidoId);
  if (!isAdmin) return { error: "Solo el admin puede cambiar la respuesta de otro." };

  const { data: partido } = await supabase.from("partidos").select("jugado").eq("id", partidoId).single();
  if (!partido) return { error: "Partido no encontrado." };
  if (partido.jugado) return { error: "El partido ya se jugó, no se puede cambiar." };

  const { error } = await supabase
    .from("partido_jugadores")
    .update({ respuesta })
    .eq("partido_id", partidoId)
    .eq("jugador_id", jugadorId);
  if (error) return { error: error.message };

  revalidatePath(`/partidos/${partidoId}`);
  return { success: true };
}
