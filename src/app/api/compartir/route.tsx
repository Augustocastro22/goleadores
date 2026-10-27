import { NextRequest, NextResponse } from "next/server";
import { getContexto } from "@/lib/grupo";
import { imagenRanking, type FilaRanking, type Formato, type NombresJugador } from "@/lib/compartir/imagenes";
import { leerTema } from "@/lib/compartir/temas";
import { imagenPartido, type JugadorPartido, type VistaPartido } from "@/lib/compartir/imagen-partido";
import type { Profile, RankingRow } from "@/lib/types";
import { leerFiltroPartidos } from "@/lib/tipos-partido";
import { esPartidoInterno, getConfig, nombresDelPartido } from "@/lib/config";
import type { DesafioVista } from "@/lib/desafios";

const TITULOS = {
  todos: "Tabla de goleadores",
  rivales: "Goleadores · contra rivales",
  entre_nosotros: "Goleadores · entre nosotros",
} as const;

/*
 * Imagen para compartir (ver src/components/Compartir.tsx):
 *   ?que=goleadores&grupo=<id>&formato=historia|cuadrado[&filtro=rivales|entre_nosotros][&estilo=podio|lista]
 *   ?que=partido&partido=<id>&formato=historia|cuadrado[&vista=resultado|convocados]
 * y, en las dos, &nombres=apodos|completos, &diseno=cancha|marco|franjas|rayos y &color=<6 dígitos hex>.
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

interface ParticipanteRow {
  goles: number;
  equipo: 1 | 2;
  respuesta: "pendiente" | "juega" | "no_juega";
  profiles: Pick<Profile, "apodo" | "nombre" | "apellido" | "foto_url">;
}

/** Apodos o nombres completos: si no es uno de los dos, apodos. */
function leerNombres(valor: string | null): NombresJugador {
  return valor === "completos" ? "completos" : "apodos";
}

/** "Martes, 22 de septiembre · 21:00hs": solo la primera en mayúscula. */
function fechaLarga(fecha: string, hora: string | null) {
  const dia = new Date(fecha + "T00:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return dia.charAt(0).toUpperCase() + dia.slice(1) + (hora ? ` · ${hora.slice(0, 5)}hs` : "");
}

async function imagenDePartido(request: NextRequest, formato: Formato) {
  const params = request.nextUrl.searchParams;
  const ctx = await getContexto();
  if (!ctx.user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  // La fila sale con la sesión de quien la pide: si no es de su grupo, no la ve.
  const { data: partido } = await ctx.supabase
    .from("partidos")
    .select("*")
    .eq("id", params.get("partido") ?? "")
    .maybeSingle();
  const grupo = partido && ctx.grupos.find((g) => g.id === partido.grupo_id);
  if (!partido || !grupo) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const [config, { data: participantesRaw }, { data: desafioRaw }] = await Promise.all([
    getConfig(ctx.supabase, partido.grupo_id),
    ctx.supabase
      .from("partido_jugadores")
      .select("goles, equipo, respuesta, profiles(apodo, nombre, apellido, foto_url)")
      .eq("partido_id", partido.id),
    partido.desafio_id
      ? ctx.supabase.rpc("get_desafios", { p_grupo_id: partido.grupo_id, p_desafio_id: partido.desafio_id })
      : Promise.resolve({ data: [] }),
  ]);
  const desafio = ((desafioRaw ?? []) as DesafioVista[])[0] ?? null;
  // Los que dijeron que no van no salen; el resto sí (convocados, o los que jugaron).
  const participantes = ((participantesRaw ?? []) as unknown as ParticipanteRow[]).filter(
    (p) => p.respuesta !== "no_juega"
  );
  const delEquipo = (equipo: 1 | 2): JugadorPartido[] =>
    participantes
      .filter((p) => p.equipo === equipo)
      .map((p) => ({
        apodo: p.profiles.apodo,
        nombre: `${p.profiles.nombre} ${p.profiles.apellido}`.trim(),
        fotoUrl: p.profiles.foto_url,
        goles: p.goles,
      }));
  const equipo1 = delEquipo(1);
  const equipo2 = delEquipo(2);
  const suma = (lista: JugadorPartido[]) => lista.reduce((t, j) => t + j.goles, 0);

  const interno = esPartidoInterno(equipo2.length, partido.desafio_id);
  // Contra otro equipo, "nosotros" es el nombre del grupo; entre ellos, el del equipo de ese día.
  const nombres = nombresDelPartido(partido, interno, config);
  const nosotros = interno ? nombres.nosotros : grupo.nombre;
  const rival = nombres.rival;
  // El mismo marcador que ve el grupo: el del desafío, o lo cargado más lo de los jugadores.
  const golesNosotros = desafio ? desafio.marcador_mios : partido.goles_otros + suma(equipo1);
  const golesRival = desafio ? desafio.marcador_rival : partido.goles_rival + suma(equipo2);
  const vista: VistaPartido = params.get("vista") === "convocados" || !partido.jugado ? "convocados" : "resultado";

  const imagen = await imagenPartido({
    formato,
    grupo: { nombre: grupo.nombre, logoUrl: grupo.logo_url },
    nombres: leerNombres(params.get("nombres")),
    tema: leerTema(params.get("diseno"), params.get("color")),
    vista,
    partido: {
      nosotros,
      rival,
      golesNosotros: partido.jugado ? golesNosotros : null,
      golesRival: partido.jugado ? golesRival : null,
      fecha: fechaLarga(partido.fecha, partido.hora),
      lugar: partido.lugar,
      equipo1,
      equipo2: interno ? equipo2 : [],
      otros1: desafio ? Math.max(0, (golesNosotros ?? 0) - suma(equipo1)) : partido.goles_otros,
      otros2: interno ? partido.goles_rival : 0,
    },
  });
  imagen.headers.set("Cache-Control", "private, no-store");
  return imagen;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const formato: Formato = params.get("formato") === "cuadrado" ? "cuadrado" : "historia";
  if (params.get("que") === "partido") return imagenDePartido(request, formato);
  if (params.get("que") !== "goleadores") return NextResponse.json({ error: "Imagen inválida." }, { status: 400 });

  const ctx = await getContexto();
  if (!ctx.user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const grupo = ctx.grupos.find((g) => g.id === params.get("grupo"));
  if (!grupo) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const filtro = leerFiltroPartidos(params.get("filtro"));
  const { data } =
    filtro === "todos"
      ? await ctx.supabase.rpc("get_goleadores", { p_grupo_id: grupo.id })
      : await ctx.supabase.rpc("get_goleadores", { p_grupo_id: grupo.id, p_filtro: filtro });
  const imagen = await imagenRanking({
    formato,
    encabezado: { grupoNombre: grupo.nombre, grupoLogoUrl: grupo.logo_url, titulo: TITULOS[filtro] },
    nombres: leerNombres(params.get("nombres")),
    tema: leerTema(params.get("diseno"), params.get("color")),
    filas: ranking((data ?? []) as RankingRow[]),
    unidad: "goles",
    vacio: "Todavía nadie hizo goles.",
    estilo: params.get("estilo") === "lista" ? "lista" : "podio",
  });

  // Son datos del grupo: que no los guarde ningún caché compartido.
  imagen.headers.set("Cache-Control", "private, no-store");
  return imagen;
}
