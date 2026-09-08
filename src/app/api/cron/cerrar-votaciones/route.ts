import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push/send";
import { fechaLimiteVotacion } from "@/lib/votacion";

/**
 * Corre una vez por día (ver vercel.json). Cierra por vencimiento las
 * votaciones de partidos donde no votó todo el mundo: el cierre "por
 * completar todos los votos" ya se notifica al toque desde votar() en
 * src/lib/actions/votos.ts, esto solo cubre el caso del plazo de 7 días.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: partidos, error } = await supabase
    .from("partidos")
    .select("id, fecha, rival")
    .eq("votacion_cerrada_notificada", false)
    .eq("jugado", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ahora = new Date();
  const vencidos = (partidos ?? []).filter((p) => ahora > fechaLimiteVotacion(p.fecha));

  for (const partido of vencidos) {
    const { data: participantes } = await supabase
      .from("partido_jugadores")
      .select("jugador_id")
      .eq("partido_id", partido.id);

    if (participantes && participantes.length > 0) {
      await enviarPush(
        participantes.map((p) => p.jugador_id),
        {
          title: "Se cerró la votación",
          body: `Ya se puede ver quién ganó Mejor Jugador y Peor Jugador vs ${partido.rival}.`,
          url: `/partidos/${partido.id}`,
        }
      );
    }

    await supabase
      .from("partidos")
      .update({ votacion_cerrada_notificada: true })
      .eq("id", partido.id);
  }

  return NextResponse.json({ cerrados: vencidos.length });
}
