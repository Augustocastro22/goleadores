import type { SupabaseClient } from "@supabase/supabase-js";
import { diaArgentina } from "@/lib/visitas";

/**
 * Métricas de uso de toda la app para /metricas (solo el dueño). Se lee todo
 * con la service role y se agrupa acá: los volúmenes son chicos.
 * Las semanas van de lunes a domingo, en hora de Argentina.
 */

export const SEMANAS = 12;

/** Quién puede ver /metricas: METRICAS_EMAILS, separados por coma. */
export function puedeVerMetricas(email: string | null | undefined): boolean {
  if (!email) return false;
  const permitidos = (process.env.METRICAS_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return permitidos.includes(email.trim().toLowerCase());
}

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(dia: string, dias: number): string {
  const d = new Date(dia + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Lunes de la semana de una fecha AAAA-MM-DD. */
export function lunesDe(dia: string): string {
  const diaSemana = new Date(dia + "T00:00:00Z").getUTCDay(); // 0 = domingo
  return sumarDias(dia, -((diaSemana + 6) % 7));
}

/** Día (AR) de un timestamp de la base, o de una fecha AAAA-MM-DD tal cual. */
export function diaDe(valor: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : diaArgentina(new Date(valor));
}

/** Lunes de las últimas `cantidad` semanas, de la más vieja a la actual. */
export function ultimasSemanas(hoy: string, cantidad: number): string[] {
  const actual = lunesDe(hoy);
  return Array.from({ length: cantidad }, (_, i) => sumarDias(actual, -7 * (cantidad - 1 - i)));
}

/** Cuenta fechas por semana (lunes → cantidad). Las fechas nulas no cuentan. */
export function contarPorSemana(fechas: (string | null | undefined)[], semanas: string[]): Map<string, number> {
  const conteo = new Map(semanas.map((s) => [s, 0]));
  for (const f of fechas) {
    if (!f) continue;
    const semana = lunesDe(diaDe(f));
    if (conteo.has(semana)) conteo.set(semana, conteo.get(semana)! + 1);
  }
  return conteo;
}

/** Usuarios distintos por semana a partir de las visitas diarias. */
export function activosPorSemana(visitas: { jugador_id: string; dia: string }[], semanas: string[]): Map<string, number> {
  const porSemana = new Map(semanas.map((s) => [s, new Set<string>()]));
  for (const v of visitas) porSemana.get(lunesDe(v.dia))?.add(v.jugador_id);
  return new Map([...porSemana].map(([s, jugadores]) => [s, jugadores.size]));
}

/** Trae todas las filas (la API corta en 1000 por pedido). */
async function todas<T>(
  armar: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: string | null }> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await armar(desde, desde + 999);
    if (error) return { data: filas, error: error.message };
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) return { data: filas, error: null };
  }
}

type Perfil = { id: string; nombre: string; apellido: string; apodo: string; created_at: string; eliminado_en: string | null };
type Partido = {
  id: string;
  grupo_id: string | null;
  created_at: string;
  fecha: string;
  jugado: boolean;
  resultado_cargado_en?: string | null;
};

export function nombreDe(p: Pick<Perfil, "nombre" | "apellido" | "apodo"> | undefined): string {
  if (!p) return "—";
  const completo = `${p.nombre} ${p.apellido}`.trim();
  if (p.apodo && completo) return `${completo} (${p.apodo})`;
  return completo || p.apodo || "Sin nombre";
}

export type Indicador = {
  clave: string;
  label: string;
  porSemana: Map<string, number>;
  nota?: string;
};

export type Metricas = Awaited<ReturnType<typeof getMetricas>>;

export async function getMetricas(admin: SupabaseClient) {
  const hoy = diaArgentina();
  const semanas = ultimasSemanas(hoy, SEMANAS);
  const desdeDia = semanas[0];
  // Margen de un día para el corte por zona horaria; contarPorSemana filtra.
  const desdeTs = sumarDias(desdeDia, -1) + "T00:00:00Z";
  const desde14 = sumarDias(hoy, -13);

  const desdeFecha = <T>(tabla: string, columnas: string, columna = "created_at") =>
    todas<T>((a, b) => admin.from(tabla).select(columnas).gte(columna, desdeTs).range(a, b) as never);

  const [
    perfiles,
    grupos,
    miembros,
    partidosRes,
    visitas,
    votos,
    votosDesempate,
    desafios,
    mensajes,
    encuestas,
    votosEncuesta,
    bloqueos,
    push,
    usuariosAuth,
  ] = await Promise.all([
    todas<Perfil>((a, b) => admin.from("profiles").select("id, nombre, apellido, apodo, created_at, eliminado_en").range(a, b)),
    todas<{ id: string; nombre: string; created_at: string }>((a, b) => admin.from("grupos").select("id, nombre, created_at").range(a, b)),
    todas<{ grupo_id: string; jugador_id: string; created_at: string }>((a, b) =>
      admin.from("grupo_miembros").select("grupo_id, jugador_id, created_at").range(a, b)
    ),
    todas<Partido>((a, b) =>
      admin.from("partidos").select("id, grupo_id, created_at, fecha, jugado, resultado_cargado_en").range(a, b)
    ),
    todas<{ jugador_id: string; dia: string }>((a, b) =>
      admin.from("visitas_diarias").select("jugador_id, dia").gte("dia", desdeDia).range(a, b)
    ),
    desdeFecha<{ partido_id: string; created_at: string }>("votos", "partido_id, created_at"),
    desdeFecha<{ created_at: string }>("desempate_votos", "created_at"),
    desdeFecha<{ created_at: string }>("desafios", "created_at"),
    desdeFecha<{ created_at: string; motivo: string; mensaje: string; nombre: string }>(
      "mensajes_contacto",
      "created_at, motivo, mensaje, nombre"
    ),
    desdeFecha<{ created_at: string }>("encuestas", "created_at"),
    desdeFecha<{ created_at: string }>("encuesta_votos", "created_at"),
    desdeFecha<{ created_at: string }>("bloqueos_disponibilidad", "created_at"),
    desdeFecha<{ created_at: string }>("push_subscriptions", "created_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  // Sin la migración 0043 todavía no existe resultado_cargado_en: se reintenta sin esa columna.
  let partidos = partidosRes.data;
  const faltaMigracion = Boolean(visitas.error || partidosRes.error);
  if (partidosRes.error) {
    partidos = (
      await todas<Partido>((a, b) => admin.from("partidos").select("id, grupo_id, created_at, fecha, jugado").range(a, b))
    ).data;
  }

  const errores = [perfiles, grupos, miembros, votos, votosDesempate, desafios, mensajes, encuestas, votosEncuesta, bloqueos, push]
    .map((r) => r.error)
    .filter(Boolean) as string[];

  const perfilPorId = new Map(perfiles.data.map((p) => [p.id, p]));
  const grupoPorId = new Map(grupos.data.map((g) => [g.id, g]));
  const partidoPorId = new Map(partidos.map((p) => [p.id, p]));
  const emailPorId = new Map((usuariosAuth.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const gruposDe = new Map<string, string[]>();
  for (const m of miembros.data) {
    const nombre = grupoPorId.get(m.grupo_id)?.nombre;
    if (nombre) gruposDe.set(m.jugador_id, [...(gruposDe.get(m.jugador_id) ?? []), nombre]);
  }

  // Resultados: la fecha de carga desde la 0043; antes, la fecha del partido (aproximado).
  const fechaResultado = (p: Partido) => (p.jugado ? (p.resultado_cargado_en ?? p.fecha) : null);
  const mensajesUsuarios = mensajes.data.filter((m) => m.motivo === "idea" || m.motivo === "falla" || m.motivo === "otro");

  const indicadores: Indicador[] = [
    { clave: "nuevos", label: "Usuarios nuevos", porSemana: contarPorSemana(perfiles.data.map((p) => p.created_at), semanas) },
    {
      clave: "activos",
      label: "Entraron a la app",
      porSemana: activosPorSemana(visitas.data, semanas),
      nota: "Usuarios distintos que abrieron la app (se registra desde la migración 0043).",
    },
    { clave: "partidos", label: "Partidos creados", porSemana: contarPorSemana(partidos.map((p) => p.created_at), semanas) },
    {
      clave: "resultados",
      label: "Resultados cargados",
      porSemana: contarPorSemana(partidos.map(fechaResultado), semanas),
      nota: "Antes de la migración 0043 se cuenta por la fecha del partido.",
    },
    { clave: "votos", label: "Votos MVP / Peor", porSemana: contarPorSemana([...votos.data, ...votosDesempate.data].map((v) => v.created_at), semanas) },
    { clave: "grupos", label: "Grupos nuevos", porSemana: contarPorSemana(grupos.data.map((g) => g.created_at), semanas) },
    { clave: "miembros", label: "Se sumaron a un grupo", porSemana: contarPorSemana(miembros.data.map((m) => m.created_at), semanas) },
    { clave: "desafios", label: "Desafíos", porSemana: contarPorSemana(desafios.data.map((d) => d.created_at), semanas) },
    { clave: "mensajes", label: "Sugerencias y fallas", porSemana: contarPorSemana(mensajesUsuarios.map((m) => m.created_at), semanas) },
    {
      clave: "encuestas",
      label: "Encuestas y votos",
      porSemana: contarPorSemana([...encuestas.data, ...votosEncuesta.data].map((e) => e.created_at), semanas),
    },
    { clave: "disponibilidad", label: "Disponibilidad cargada", porSemana: contarPorSemana(bloqueos.data.map((b) => b.created_at), semanas) },
    { clave: "push", label: "Notificaciones activadas", porSemana: contarPorSemana(push.data.map((p) => p.created_at), semanas) },
  ];

  const estaSemana = semanas[semanas.length - 1];

  // Activos por día, últimos 14 días.
  const porDia = new Map<string, Set<string>>();
  for (let i = 0; i < 14; i++) porDia.set(sumarDias(desde14, i), new Set());
  for (const v of visitas.data) porDia.get(v.dia)?.add(v.jugador_id);
  const activosPorDia = [...porDia].map(([dia, jugadores]) => ({ dia, cantidad: jugadores.size }));

  // Quiénes entraron esta semana.
  const visitasSemana = new Map<string, string[]>();
  for (const v of visitas.data) {
    if (v.dia >= estaSemana) visitasSemana.set(v.jugador_id, [...(visitasSemana.get(v.jugador_id) ?? []), v.dia]);
  }
  const entraron = [...visitasSemana]
    .map(([id, dias]) => ({
      id,
      nombre: nombreDe(perfilPorId.get(id)),
      grupos: gruposDe.get(id) ?? [],
      dias: dias.length,
      ultimo: dias.sort().at(-1)!,
    }))
    .sort((a, b) => b.dias - a.dias || b.ultimo.localeCompare(a.ultimo) || a.nombre.localeCompare(b.nombre));

  // Registrados en los últimos 14 días.
  const nuevos = perfiles.data
    .filter((p) => diaDe(p.created_at) >= desde14)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((p) => ({
      id: p.id,
      nombre: p.eliminado_en ? "Cuenta borrada" : nombreDe(p),
      email: emailPorId.get(p.id) ?? "",
      creado: p.created_at,
      grupos: gruposDe.get(p.id) ?? [],
      entroDespues: visitas.data.some((v) => v.jugador_id === p.id && v.dia > diaDe(p.created_at)),
    }));

  // Grupos con movimiento esta semana.
  type Mov = { id: string; nombre: string; activos: number; partidos: number; resultados: number; votos: number; nuevosMiembros: number };
  const movimiento = new Map<string, Mov>();
  const mov = (grupoId: string | null | undefined) => {
    if (!grupoId || !grupoPorId.has(grupoId)) return null;
    if (!movimiento.has(grupoId)) {
      movimiento.set(grupoId, { id: grupoId, nombre: grupoPorId.get(grupoId)!.nombre, activos: 0, partidos: 0, resultados: 0, votos: 0, nuevosMiembros: 0 });
    }
    return movimiento.get(grupoId)!;
  };
  const enSemana = (f: string | null | undefined) => Boolean(f) && lunesDe(diaDe(f!)) === estaSemana;
  for (const p of partidos) {
    const g = enSemana(p.created_at) || enSemana(fechaResultado(p)) ? mov(p.grupo_id) : null;
    if (!g) continue;
    if (enSemana(p.created_at)) g.partidos++;
    if (enSemana(fechaResultado(p))) g.resultados++;
  }
  for (const v of votos.data) {
    if (enSemana(v.created_at)) {
      const g = mov(partidoPorId.get(v.partido_id)?.grupo_id);
      if (g) g.votos++;
    }
  }
  for (const m of miembros.data) {
    if (visitasSemana.has(m.jugador_id)) {
      const g = mov(m.grupo_id);
      if (g) g.activos++;
    }
    if (enSemana(m.created_at)) {
      const g = mov(m.grupo_id);
      if (g) g.nuevosMiembros++;
    }
  }
  const gruposActivos = [...movimiento.values()]
    .filter((g) => g.activos + g.partidos + g.resultados + g.votos + g.nuevosMiembros > 0)
    .sort((a, b) => b.activos - a.activos || b.partidos + b.votos - (a.partidos + a.votos));

  const ultimosMensajes = [...mensajesUsuarios].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return {
    hoy,
    semanas,
    indicadores,
    activosPorDia,
    entraron,
    nuevos,
    gruposActivos,
    ultimosMensajes,
    totales: {
      usuarios: perfiles.data.filter((p) => !p.eliminado_en).length,
      grupos: grupos.data.length,
      partidosJugados: partidos.filter((p) => p.jugado).length,
    },
    faltaMigracion,
    errores,
  };
}
