import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cómo juega el grupo:
 * - "equipo": son un equipo que juega contra otros (torneos, ligas). Al armar
 *   un partido solo se elige quién juega y contra quién.
 * - "entre_nosotros": se dividen en dos equipos (el fulbito de los martes).
 *   El partido se arma con dos equipos del grupo, sin rival de afuera.
 * Cada partido puede ser la excepción (ver esPartidoInterno). null = el grupo
 * todavía no eligió (se le pregunta al admin una vez, ver PreguntaModoJuego).
 */
export type ModoJuego = "equipo" | "entre_nosotros";

/**
 * Reglas que el admin de cada grupo elige al crearlo y edita desde /admin
 * (tabla `config`, ver supabase/migrations/0015_admin_config.sql y
 * 0016_multi_grupo.sql). Si una clave no está en la tabla se usa el valor
 * por defecto de acá.
 */
export interface AppConfig {
  /** Si el grupo vota Mejor Jugador después de cada partido. */
  vota_mvp: boolean;
  /** Si el grupo vota Peor Jugador después de cada partido. */
  vota_peor: boolean;
  /** Mínimo de jugadores en un partido para que haya votación de Mejor/Peor. 0 = sin mínimo. */
  min_jugadores_votacion: number;
  /** Si los convocados tienen que confirmar que juegan (ver 0020_confirmacion.sql). */
  pedir_confirmacion: boolean;
  /** Cómo juega el grupo (null = todavía no lo eligió). */
  modo_juego: ModoJuego | null;
  /** Los nombres de los dos equipos cuando juegan entre ellos ("Blancos" y "Negros"). */
  nombre_equipo_1: string;
  nombre_equipo_2: string;
}

export const CONFIG_DEFAULTS: AppConfig = {
  vota_mvp: true,
  vota_peor: true,
  min_jugadores_votacion: 0,
  pedir_confirmacion: false,
  modo_juego: null,
  nombre_equipo_1: "Equipo A",
  nombre_equipo_2: "Equipo B",
};

/**
 * Con qué arranca el form de un grupo nuevo: Peor Jugador apagado y confirmación
 * de los convocados prendida (se cambian desde Admin). No se cambia en
 * CONFIG_DEFAULTS porque eso modificaría los grupos que ya existen y nunca
 * guardaron esas reglas.
 */
export const REGLAS_GRUPO_NUEVO: AppConfig = { ...CONFIG_DEFAULTS, vota_peor: false, pedir_confirmacion: true };

export const MAX_MIN_JUGADORES = 50;

export async function getConfig(supabase: SupabaseClient, grupoId: string): Promise<AppConfig> {
  const { data } = await supabase.from("config").select("clave, valor").eq("grupo_id", grupoId);
  const config = { ...CONFIG_DEFAULTS };
  const filas = data ?? [];
  // Antes de separar Mejor y Peor (0018_votacion_separada.sql) había una sola
  // clave para las dos. Vale mientras el grupo no guarde las reglas nuevas.
  const legacy = filas.find((r) => r.clave === "votacion_activa");
  if (legacy && typeof legacy.valor === "boolean") {
    config.vota_mvp = legacy.valor;
    config.vota_peor = legacy.valor;
  }
  for (const row of filas) {
    if (row.clave === "min_jugadores_votacion" && typeof row.valor === "number") {
      config.min_jugadores_votacion = row.valor;
    }
    if (row.clave === "vota_mvp" && typeof row.valor === "boolean") {
      config.vota_mvp = row.valor;
    }
    if (row.clave === "vota_peor" && typeof row.valor === "boolean") {
      config.vota_peor = row.valor;
    }
    if (row.clave === "pedir_confirmacion" && typeof row.valor === "boolean") {
      config.pedir_confirmacion = row.valor;
    }
    if (row.clave === "modo_juego" && (row.valor === "equipo" || row.valor === "entre_nosotros")) {
      config.modo_juego = row.valor;
    }
    if (row.clave === "nombre_equipo_1" && typeof row.valor === "string" && row.valor.trim()) {
      config.nombre_equipo_1 = row.valor;
    }
    if (row.clave === "nombre_equipo_2" && typeof row.valor === "string" && row.valor.trim()) {
      config.nombre_equipo_2 = row.valor;
    }
  }
  return config;
}

/**
 * Si un partido lo juegan entre ellos (dos equipos del grupo) o contra otro
 * equipo: lo dice si alguien del grupo jugó en el segundo equipo. Así se lee
 * igual en los partidos viejos, de antes de elegir cómo juega el grupo.
 */
export function esPartidoInterno(jugadoresEquipo2: number, desafioId: string | null = null): boolean {
  return !desafioId && jugadoresEquipo2 > 0;
}

/** Los nombres a mostrar de los dos lados de un partido. */
export function nombresDelPartido(
  partido: { rival: string; nombre_equipo?: string | null },
  interno: boolean,
  config: Pick<AppConfig, "nombre_equipo_1">
): { nosotros: string; rival: string } {
  // El nombre de ese día; los partidos de antes de guardarlo usan el del grupo.
  const nosotros = interno ? partido.nombre_equipo?.trim() || config.nombre_equipo_1 : "Nosotros";
  return { nosotros, rival: partido.rival };
}

export const MAX_NOMBRE_EQUIPO = 30;

/** Los nombres de los dos equipos de un partido entre ellos: limpios, con largo máximo y distintos. */
export function validarNombresEquipos(nombre1: string, nombre2: string): string | null {
  if (!nombre1.trim() || !nombre2.trim()) return "Poné el nombre de los dos equipos.";
  if (nombre1.trim().length > MAX_NOMBRE_EQUIPO || nombre2.trim().length > MAX_NOMBRE_EQUIPO) {
    return `Los nombres de los equipos pueden tener hasta ${MAX_NOMBRE_EQUIPO} letras.`;
  }
  if (nombre1.trim().toLowerCase() === nombre2.trim().toLowerCase()) {
    return "Los dos equipos tienen que tener nombres distintos.";
  }
  return null;
}

/** Lee "cómo juegan" y los nombres de los equipos de un form (ver ModoJuegoFields). */
export function parseModoJuego(
  formData: FormData
): Pick<AppConfig, "modo_juego" | "nombre_equipo_1" | "nombre_equipo_2"> | { error: string } {
  const modo = formData.get("modo_juego");
  if (modo !== "equipo" && modo !== "entre_nosotros") return { error: "Elegí cómo juega el grupo." };
  const nombre1 = String(formData.get("nombre_equipo_1") ?? "").trim() || CONFIG_DEFAULTS.nombre_equipo_1;
  const nombre2 = String(formData.get("nombre_equipo_2") ?? "").trim() || CONFIG_DEFAULTS.nombre_equipo_2;
  if (nombre1.length > MAX_NOMBRE_EQUIPO || nombre2.length > MAX_NOMBRE_EQUIPO) {
    return { error: `Los nombres de los equipos pueden tener hasta ${MAX_NOMBRE_EQUIPO} letras.` };
  }
  if (nombre1.toLowerCase() === nombre2.toLowerCase()) {
    return { error: "Los dos equipos tienen que tener nombres distintos." };
  }
  return { modo_juego: modo, nombre_equipo_1: nombre1, nombre_equipo_2: nombre2 };
}

/** Si el grupo vota alguna de las dos categorías. */
export function grupoVota(config: Pick<AppConfig, "vota_mvp" | "vota_peor">): boolean {
  return config.vota_mvp || config.vota_peor;
}

/**
 * Lee las reglas de un form (los campos de ReglasFields). Devuelve un error
 * si el mínimo no es válido.
 */
export function parseConfig(formData: FormData): AppConfig | { error: string } {
  const votaMvp = formData.get("vota_mvp") === "on";
  const votaPeor = formData.get("vota_peor") === "on";
  const pedirConfirmacion = formData.get("pedir_confirmacion") === "on";
  // Con la votación apagada el campo del mínimo no se muestra: se mantiene el
  // valor que venía (hidden) para que al volver a prenderla siga igual.
  const minJugadores = Number(formData.get("min_jugadores_votacion") ?? 0);
  if (!Number.isInteger(minJugadores) || minJugadores < 0 || minJugadores > MAX_MIN_JUGADORES) {
    return { error: `El mínimo de jugadores tiene que ser un número entre 0 y ${MAX_MIN_JUGADORES}.` };
  }
  const modoJuego = parseModoJuego(formData);
  if ("error" in modoJuego) return modoJuego;
  return {
    vota_mvp: votaMvp,
    vota_peor: votaPeor,
    min_jugadores_votacion: minJugadores,
    pedir_confirmacion: pedirConfirmacion,
    ...modoJuego,
  };
}

/** Filas para guardar en la tabla config (upsert por grupo_id + clave). Las que no tienen valor no se guardan. */
export function filasConfig(grupoId: string, config: Partial<AppConfig>, userId: string) {
  const updated_at = new Date().toISOString();
  return (Object.keys(config) as (keyof AppConfig)[]).filter((clave) => config[clave] != null).map((clave) => ({
    grupo_id: grupoId,
    clave,
    valor: config[clave],
    updated_at,
    updated_by: userId,
  }));
}

/**
 * Qué categorías vota un partido con esta cantidad de jugadores (las columnas
 * con_votacion, con_mvp y con_peor de partidos).
 */
export function votacionDelPartido(
  cantidadJugadores: number,
  config: Pick<AppConfig, "vota_mvp" | "vota_peor" | "min_jugadores_votacion">
): { con_votacion: boolean; con_mvp: boolean; con_peor: boolean } {
  const alcanza = cantidadJugadores >= config.min_jugadores_votacion;
  const con_mvp = alcanza && config.vota_mvp;
  const con_peor = alcanza && config.vota_peor;
  return { con_votacion: con_mvp || con_peor, con_mvp, con_peor };
}
