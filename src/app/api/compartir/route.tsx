import { NextRequest, NextResponse } from "next/server";
import { getContexto } from "@/lib/grupo";
import { imagenRanking, type FilaRanking, type Formato } from "@/lib/compartir/imagenes";
import type { RankingRow } from "@/lib/types";

/*
 * Imagen para compartir (ver src/components/Compartir.tsx):
 *   ?que=goleadores&grupo=<id>&formato=historia|cuadrado
 * Solo para miembros del grupo: los datos salen con la sesión de quien la
 * pide, así que las RPC deciden qué puede ver.
 */

/** Mayor primero; los empatados comparten puesto (1, 1, 3…), como en Estadísticas. */
function ranking(rows: RankingRow[]): FilaRanking[] {
  const ordenadas = rows.filter((r) => (r.goles ?? 0) > 0).sort((a, b) => (b.goles ?? 0) - (a.goles ?? 0));
  return ordenadas.map((r) => ({
    puesto: ordenadas.findIndex((o) => (o.goles ?? 0) === (r.goles ?? 0)) + 1,
    apodo: r.apodo,
    nombre: `${r.nombre} ${r.apellido}`.trim(),
    fotoUrl: r.foto_url,
    valor: r.goles ?? 0,
  }));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const formato: Formato = params.get("formato") === "cuadrado" ? "cuadrado" : "historia";
  if (params.get("que") !== "goleadores") return NextResponse.json({ error: "Imagen inválida." }, { status: 400 });

  const ctx = await getContexto();
  if (!ctx.user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const grupo = ctx.grupos.find((g) => g.id === params.get("grupo"));
  if (!grupo) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const { data } = await ctx.supabase.rpc("get_goleadores", { p_grupo_id: grupo.id });
  const imagen = await imagenRanking({
    formato,
    encabezado: { grupoNombre: grupo.nombre, grupoLogoUrl: grupo.logo_url, titulo: "Tabla de goleadores", color: "#34d399" },
    filas: ranking((data ?? []) as RankingRow[]),
    unidad: "goles",
    vacio: "Todavía nadie hizo goles.",
  });

  // Son datos del grupo: que no los guarde ningún caché compartido.
  imagen.headers.set("Cache-Control", "private, no-store");
  return imagen;
}
