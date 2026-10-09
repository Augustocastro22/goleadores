import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push/send";
import { categoriasTexto, fechaLimiteVotacion } from "@/lib/votacion";
import { revisarEmpates } from "@/lib/votaciones";
import { urlConGrupo } from "@/lib/grupo-cookie";
import { avisarDesafio } from "@/lib/desafios-avisos";

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
    .select("id, grupo_id, fecha, rival, con_mvp, con_peor")
    .eq("votacion_cerrada_notificada", false)
    .eq("jugado", true)
    .eq("con_votacion", true);

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
          body: `Ya se puede ver quién ganó ${categoriasTexto({ conMvp: partido.con_mvp, conPeor: partido.con_peor })} vs ${partido.rival}.`,
          url: urlConGrupo(`/partidos/${partido.id}`, partido.grupo_id),
        }
      );
    }

    await supabase
      .from("partidos")
      .update({ votacion_cerrada_notificada: true })
      .eq("id", partido.id);

    await revisarEmpates(partido.id);
  }

  // Desafíos: resultados y fechas propuestas sin respuesta en 3 días se
  // aceptan solos, y los pendientes con fecha pasada quedan vencidos (ver
  // vencer_propuestas_desafios en 0024_desafios_completo.sql).
  const { data: desafiosVencidos, error: desafiosError } = await supabase.rpc("vencer_propuestas_desafios");
  if (desafiosError) console.error("No se pudieron vencer las propuestas de desafíos:", desafiosError);
  for (const v of (desafiosVencidos ?? []) as { desafio_id: string; tipo: "resultado" | "fecha" }[]) {
    await avisarDesafio(v.desafio_id, v.tipo === "resultado" ? "resultado_auto" : "fecha_auto");
  }

  return NextResponse.json({ cerrados: vencidos.length, desafios: (desafiosVencidos ?? []).length });
}
