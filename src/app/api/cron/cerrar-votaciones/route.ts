import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cerrarDesempatesVencidos, cerrarVotacionSiCorresponde } from "@/lib/votaciones";
import { avisarDesafio } from "@/lib/desafios-avisos";
import { recordarConfirmaciones } from "@/lib/recordatorios";
import { recordarVotaciones } from "@/lib/recordatorios-votacion";

/**
 * Corre una vez por día (ver vercel.json). Cierra por vencimiento las
 * votaciones de partidos donde no votó todo el mundo: el cierre "por
 * completar todos los votos" ya se notifica al toque desde votar() en
 * src/lib/actions/votos.ts, y el vencido también se cierra apenas alguien
 * abre el partido. Esto cubre los que nadie abrió (y lo mismo con los
 * desempates, que vencen a las 24 h). También manda los recordatorios de las
 * votaciones abiertas (ver src/lib/recordatorios-votacion.ts).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: partidos, error } = await supabase
    .from("partidos")
    .select("id")
    .eq("votacion_cerrada_notificada", false)
    .eq("jugado", true)
    .eq("con_votacion", true)
    .lte("votacion_cierra_en", new Date().toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const partido of partidos ?? []) await cerrarVotacionSiCorresponde(partido.id);
  // Desempates que nadie terminó de definir en su plazo: se deciden con los votos que haya.
  await cerrarDesempatesVencidos();

  // Desafíos: resultados y fechas propuestas sin respuesta en 3 días se
  // aceptan solos, y los pendientes con fecha pasada quedan vencidos (ver
  // vencer_propuestas_desafios en 0024_desafios_completo.sql).
  const { data: desafiosVencidos, error: desafiosError } = await supabase.rpc("vencer_propuestas_desafios");
  if (desafiosError) console.error("No se pudieron vencer las propuestas de desafíos:", desafiosError);
  for (const v of (desafiosVencidos ?? []) as { desafio_id: string; tipo: "resultado" | "fecha" }[]) {
    await avisarDesafio(v.desafio_id, v.tipo === "resultado" ? "resultado_auto" : "fecha_auto");
  }

  // Convocados que no dijeron si juegan: recordatorio el día anterior y la mañana del partido.
  const recordados = await recordarConfirmaciones();

  // Votaciones abiertas: a los que no votaron y al admin, cuántos faltan y cuándo cierra.
  const recordadosVotacion = await recordarVotaciones();

  return NextResponse.json({
    cerrados: (partidos ?? []).length,
    desafios: (desafiosVencidos ?? []).length,
    recordados,
    recordadosVotacion,
  });
}
