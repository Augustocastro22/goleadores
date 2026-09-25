import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { encuestaCerrada } from "@/lib/encuestas";
import type { Encuesta, EncuestaOpcion, Profile, ResultadoEncuesta } from "@/lib/types";
import CrearEncuestaForm from "./CrearEncuestaForm";
import EncuestaCard from "./EncuestaCard";

export default async function EncuestasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: miPerfil } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  const isAdmin = miPerfil?.rol === "admin";

  const [{ data: encuestas }, { data: opcionesRaw }, { data: creadoresRaw }, { count: totalParticipantes }] =
    await Promise.all([
      supabase.from("encuestas").select("*").order("created_at", { ascending: false }).returns<Encuesta[]>(),
      supabase.from("encuesta_opciones").select("*").order("orden").returns<EncuestaOpcion[]>(),
      supabase.from("profiles").select("id, apodo").returns<Pick<Profile, "id" | "apodo">[]>(),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);

  const apodoPorId = new Map((creadoresRaw ?? []).map((p) => [p.id, p.apodo]));
  const opcionesPorEncuesta = new Map<string, EncuestaOpcion[]>();
  for (const op of opcionesRaw ?? []) {
    const lista = opcionesPorEncuesta.get(op.encuesta_id) ?? [];
    lista.push(op);
    opcionesPorEncuesta.set(op.encuesta_id, lista);
  }

  const { data: misVotos } = await supabase
    .from("encuesta_votos")
    .select("encuesta_id, opcion_id")
    .eq("jugador_id", user.id);
  const miVotoPorEncuesta = new Map((misVotos ?? []).map((v) => [v.encuesta_id, v.opcion_id]));

  const resultadosPorEncuesta = new Map<string, Map<string, number>>();
  await Promise.all(
    (encuestas ?? []).map(async (e) => {
      const { data } = await supabase.rpc("get_resultados_encuesta", { p_encuesta_id: e.id });
      const mapa = new Map<string, number>();
      for (const r of (data ?? []) as ResultadoEncuesta[]) mapa.set(r.opcion_id, r.votos);
      resultadosPorEncuesta.set(e.id, mapa);
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-white">Encuestas</h1>
        <p className="text-sm text-zinc-500">
          Cualquiera puede crear una. Los resultados se ven en el momento, como en Twitter.
        </p>
      </div>

      <CrearEncuestaForm />

      {(encuestas ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">Todavía no hay encuestas.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {(encuestas ?? []).map((e) => {
            const opciones = opcionesPorEncuesta.get(e.id) ?? [];
            const votos = resultadosPorEncuesta.get(e.id) ?? new Map();
            const totalVotos = opciones.reduce((sum, o) => sum + (votos.get(o.id) ?? 0), 0);
            const cerrada = encuestaCerrada({
              cierraEn: e.cierra_en,
              totalParticipantes: totalParticipantes ?? 0,
              totalVotos,
            });
            return (
              <EncuestaCard
                key={e.id}
                encuestaId={e.id}
                pregunta={e.pregunta}
                creadorApodo={apodoPorId.get(e.creado_por) ?? "?"}
                cierraEn={e.cierra_en}
                cerrada={cerrada}
                opciones={opciones.map((o) => ({ id: o.id, texto: o.texto, votos: votos.get(o.id) ?? 0 }))}
                miVoto={miVotoPorEncuesta.get(e.id) ?? null}
                puedoBorrar={isAdmin || e.creado_por === user.id}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
