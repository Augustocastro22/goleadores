import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ajustes que el admin edita desde /admin (tabla `config`, ver
 * supabase/migrations/0015_admin_config.sql). Si una clave no está en la
 * tabla se usa el valor por defecto de acá.
 */
export interface AppConfig {
  /** Mínimo de jugadores en un partido para que haya votación de Mejor/Peor. 0 = sin mínimo. */
  min_jugadores_votacion: number;
}

export const CONFIG_DEFAULTS: AppConfig = {
  min_jugadores_votacion: 0,
};

export async function getConfig(supabase: SupabaseClient): Promise<AppConfig> {
  const { data } = await supabase.from("config").select("clave, valor");
  const config = { ...CONFIG_DEFAULTS };
  for (const row of data ?? []) {
    if (row.clave === "min_jugadores_votacion" && typeof row.valor === "number") {
      config.min_jugadores_votacion = row.valor;
    }
  }
  return config;
}

/** Si un partido con esta cantidad de jugadores tiene votación de Mejor/Peor. */
export function tieneVotacion(cantidadJugadores: number, minJugadores: number): boolean {
  return cantidadJugadores >= minJugadores;
}
