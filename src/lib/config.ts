import type { SupabaseClient } from "@supabase/supabase-js";

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
}

export const CONFIG_DEFAULTS: AppConfig = {
  vota_mvp: true,
  vota_peor: true,
  min_jugadores_votacion: 0,
  pedir_confirmacion: false,
};

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
  }
  return config;
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
  return {
    vota_mvp: votaMvp,
    vota_peor: votaPeor,
    min_jugadores_votacion: minJugadores,
    pedir_confirmacion: pedirConfirmacion,
  };
}

/** Filas para guardar en la tabla config (upsert por grupo_id + clave). */
export function filasConfig(grupoId: string, config: AppConfig, userId: string) {
  const updated_at = new Date().toISOString();
  return (Object.keys(config) as (keyof AppConfig)[]).map((clave) => ({
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
