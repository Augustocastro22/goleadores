import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reglas que el admin de cada grupo elige al crearlo y edita desde /admin
 * (tabla `config`, ver supabase/migrations/0015_admin_config.sql y
 * 0016_multi_grupo.sql). Si una clave no está en la tabla se usa el valor
 * por defecto de acá.
 */
export interface AppConfig {
  /** Si el grupo vota Mejor y Peor Jugador después de cada partido. */
  votacion_activa: boolean;
  /** Mínimo de jugadores en un partido para que haya votación de Mejor/Peor. 0 = sin mínimo. */
  min_jugadores_votacion: number;
}

export const CONFIG_DEFAULTS: AppConfig = {
  votacion_activa: true,
  min_jugadores_votacion: 0,
};

export const MAX_MIN_JUGADORES = 50;

export async function getConfig(supabase: SupabaseClient, grupoId: string): Promise<AppConfig> {
  const { data } = await supabase.from("config").select("clave, valor").eq("grupo_id", grupoId);
  const config = { ...CONFIG_DEFAULTS };
  for (const row of data ?? []) {
    if (row.clave === "min_jugadores_votacion" && typeof row.valor === "number") {
      config.min_jugadores_votacion = row.valor;
    }
    if (row.clave === "votacion_activa" && typeof row.valor === "boolean") {
      config.votacion_activa = row.valor;
    }
  }
  return config;
}

/**
 * Lee las reglas de un form (los campos de ReglasFields). Devuelve un error
 * si el mínimo no es válido.
 */
export function parseConfig(formData: FormData): AppConfig | { error: string } {
  const votacionActiva = formData.get("votacion_activa") === "on";
  // Con la votación apagada el campo del mínimo no se muestra: se mantiene el
  // valor que venía (hidden) para que al volver a prenderla siga igual.
  const minJugadores = Number(formData.get("min_jugadores_votacion") ?? 0);
  if (!Number.isInteger(minJugadores) || minJugadores < 0 || minJugadores > MAX_MIN_JUGADORES) {
    return { error: `El mínimo de jugadores tiene que ser un número entre 0 y ${MAX_MIN_JUGADORES}.` };
  }
  return { votacion_activa: votacionActiva, min_jugadores_votacion: minJugadores };
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

/** Si un partido con esta cantidad de jugadores tiene votación de Mejor/Peor. */
export function tieneVotacion(
  cantidadJugadores: number,
  config: Pick<AppConfig, "votacion_activa" | "min_jugadores_votacion">
): boolean {
  return config.votacion_activa && cantidadJugadores >= config.min_jugadores_votacion;
}
