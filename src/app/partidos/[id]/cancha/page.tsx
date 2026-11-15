import { notFound, redirect } from "next/navigation";
import { getContexto, rolEn } from "@/lib/grupo";
import type { FormacionGuardada } from "@/lib/formacion";
import { esPartidoInterno, getConfig, nombresDelPartido } from "@/lib/config";
import type { Profile, Respuesta } from "@/lib/types";
import Card from "@/components/ui/Card";
import Volver from "@/components/Volver";
import ArmadorCancha, { type EquipoCancha } from "@/components/cancha/ArmadorCancha";

/**
 * "La cancha" de un partido: los convocados (menos los que dijeron que no)
 * ubicados en una cancha, para mirar cómo forman y compartirlo. Entre ellos,
 * los dos equipos, cada uno en su mitad. La ven todos los del grupo; si el
 * admin guardó la formación, todos ven esa (ver lib/formacion.ts).
 */
export default async function CanchaPartidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContexto();
  const { supabase, user } = ctx;
  if (!user) redirect("/login");

  const { data: partido } = await supabase.from("partidos").select("*").eq("id", id).single();
  if (!partido) notFound();

  const [config, { data: participantesRaw }] = await Promise.all([
    getConfig(supabase, partido.grupo_id),
    supabase.from("partido_jugadores").select("equipo, respuesta, profiles(*)").eq("partido_id", id),
  ]);
  const participantes = ((participantesRaw ?? []) as unknown as { equipo: 1 | 2; respuesta: Respuesta; profiles: Profile }[])
    .filter((p) => p.respuesta !== "no_juega")
    .sort((a, b) => a.profiles.apodo.localeCompare(b.profiles.apodo, "es"));
  const equipo1 = participantes.filter((p) => p.equipo === 1).map((p) => p.profiles);
  const equipo2 = participantes.filter((p) => p.equipo === 2).map((p) => p.profiles);
  const interno = esPartidoInterno(equipo2.length, partido.desafio_id, partido.nombre_equipo);
  const { nosotros } = nombresDelPartido(partido, interno, config);
  const nombreGrupo = ctx.grupos.find((g) => g.id === partido.grupo_id)?.nombre ?? nosotros;
  const esAdmin = rolEn(ctx, partido.grupo_id) === "admin";
  // La formación que guardó el admin (0041_formacion_partido.sql); sin guardar, se arma sola.
  const guardada = (partido.formacion ?? null) as FormacionGuardada | null;
  // Para el admin que todavía no la guardó: la del último partido del grupo que tenga una, para repetirla.
  const { data: previa } =
    esAdmin && !guardada
      ? await supabase
          .from("partidos")
          .select("fecha, formacion")
          .eq("grupo_id", partido.grupo_id)
          .neq("id", id)
          .not("formacion", "is", null)
          .lte("fecha", partido.fecha)
          .order("fecha", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

  // Entre ellos con los equipos armados: uno en cada mitad. Si no, todos juntos.
  const dosEquipos = interno && equipo2.length > 0;
  const equipos: EquipoCancha[] = dosEquipos
    ? [
        { nombre: nosotros, jugadores: equipo1 },
        { nombre: partido.rival, jugadores: equipo2 },
      ]
    : [{ nombre: nombreGrupo, jugadores: [...equipo1, ...equipo2] }];

  const dia = new Date(partido.fecha + "T00:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
  });
  const subtitulo = [dia, partido.hora?.slice(0, 5), partido.lugar].filter(Boolean).join(" · ");
  const titulo = dosEquipos ? `${nosotros} vs ${partido.rival}` : `${nombreGrupo} vs ${partido.rival}`;

  return (
    <div className="flex flex-col gap-4">
      <Volver href={`/partidos/${id}`}>Partido</Volver>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">La cancha</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {titulo} · {subtitulo}
        </p>
      </div>
      {interno && !dosEquipos && (
        <Card className="border-gold-500/20 px-4 py-3 text-sm text-zinc-300">
          Los equipos todavía no están armados: por ahora están todos juntos. Cuando el admin los arme (o los sortee),
          acá aparece cada uno en su mitad.
        </Card>
      )}
      {participantes.length === 0 ? (
        <Card className="px-4 py-3 text-sm text-zinc-500">Todavía no hay nadie convocado.</Card>
      ) : (
        <ArmadorCancha
          equipos={equipos}
          titulo={titulo}
          subtitulo={subtitulo}
          autoUbicar
          archivo="la-cancha"
          partidoId={id}
          guardada={guardada}
          previa={previa ? { formacion: previa.formacion as FormacionGuardada, fecha: previa.fecha } : null}
          esAdmin={esAdmin}
        />
      )}
    </div>
  );
}
