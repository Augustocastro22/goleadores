import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularNiveles, historialPorJugador, type FilaHistorial, type Niveles } from "./nivel";

const PAGINA = 1000;

/**
 * Los niveles de los miembros del grupo para "Equipos parejos" (ver nivel.ts).
 * Solo para el admin: los niveles a mano solo los puede leer él
 * (0042_niveles_manuales.sql). Sin nadie medido ni con nivel a mano, todos valen 5,5
 * (y el editor no ofrece "Equipos parejos", pero sí poner niveles a mano).
 */
export async function getNiveles(
  supabase: SupabaseClient,
  grupoId: string,
  miembroIds: string[]
): Promise<Niveles> {
  const filas: FilaHistorial[] = [];
  const [manualesRes] = await Promise.all([
    supabase.from("niveles_manuales").select("jugador_id, nivel").eq("grupo_id", grupoId),
    (async () => {
      // De a páginas: la API corta en 1000 filas y un grupo con historia las pasa.
      for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
          .from("partido_jugadores")
          .select("partido_id, jugador_id, goles, equipo, partidos!inner(goles_rival, goles_otros)")
          .eq("partidos.grupo_id", grupoId)
          .eq("partidos.jugado", true)
          .order("id")
          .range(desde, desde + PAGINA - 1);
        if (error || !data) break;
        for (const f of data as unknown as {
          partido_id: string;
          jugador_id: string;
          goles: number;
          equipo: 1 | 2;
          partidos: { goles_rival: number; goles_otros: number };
        }[]) {
          filas.push({
            partido_id: f.partido_id,
            jugador_id: f.jugador_id,
            goles: f.goles,
            equipo: f.equipo,
            goles_rival: f.partidos.goles_rival,
            goles_otros: f.partidos.goles_otros,
          });
        }
        if (data.length < PAGINA) break;
      }
    })(),
  ]);
  const manuales = Object.fromEntries(
    ((manualesRes.data ?? []) as { jugador_id: string; nivel: number }[]).map((m) => [m.jugador_id, m.nivel])
  );
  return calcularNiveles(historialPorJugador(filas), { miembros: new Set(miembroIds), manuales }) ?? {
    medidos: {},
    manuales: {},
    promedio: 5.5,
  };
}
