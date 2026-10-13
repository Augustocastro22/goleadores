import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cerrarVotacionSiCorresponde } from "@/lib/votaciones";
import { avisarDesafio } from "@/lib/desafios-avisos";

/**
 * Corre una vez por día (ver vercel.json). Cierra por vencimiento las
 * votaciones de partidos donde no votó todo el mundo: el cierre "por
 * completar todos los votos" ya se notifica al toque desde votar() en
 * src/lib/actions/votos.ts, y el vencido también se cierra apenas alguien
 * abre el partido. Esto cubre los que nadie abrió.
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

  // Desafíos: resultados y fechas propuestas sin respuesta en 3 días se
  // aceptan solos, y los pendientes con fecha pasada quedan vencidos (ver
  // vencer_propuestas_desafios en 0024_desafios_completo.sql).
  const { data: desafiosVencidos, error: desafiosError } = await supabase.rpc("vencer_propuestas_desafios");
  if (desafiosError) console.error("No se pudieron vencer las propuestas de desafíos:", desafiosError);
  for (const v of (desafiosVencidos ?? []) as { desafio_id: string; tipo: "resultado" | "fecha" }[]) {
    await avisarDesafio(v.desafio_id, v.tipo === "resultado" ? "resultado_auto" : "fecha_auto");
  }

  return NextResponse.json({ cerrados: (partidos ?? []).length, desafios: (desafiosVencidos ?? []).length });
}
