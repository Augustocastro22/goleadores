import Link from "next/link";
import { getMiembros, requireGrupo } from "@/lib/grupo";
import { hoyArgentina } from "@/lib/confirmacion";
import type { Bloqueo } from "@/lib/types";
import EquipoDisponibilidad from "./EquipoDisponibilidad";

export default async function DisponibilidadEquipoPage() {
  const { supabase, grupo, user } = await requireGrupo();

  const [miembros, { data }] = await Promise.all([
    getMiembros(supabase, grupo.id),
    supabase.rpc("get_disponibilidad_grupo", { p_grupo_id: grupo.id }),
  ]);
  // La función no devuelve la nota (es privada); el resto de los campos es el de un Bloqueo.
  const bloqueos = ((data ?? []) as Omit<Bloqueo, "nota" | "created_at">[]).map((b) => ({
    ...b,
    nota: null,
    created_at: "",
  })) as Bloqueo[];

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-white">Disponibilidad</h1>
      <p className="mb-5 text-sm text-zinc-400">
        Mirá cuándo puede jugar cada uno y elegí el mejor horario.{" "}
        <Link href="/perfil" className="font-semibold text-primary-400 hover:text-primary-300">
          Cargar la mía
        </Link>
      </p>
      <EquipoDisponibilidad
        jugadores={miembros.map((m) => ({ id: m.id, nombre: m.nombre }))}
        bloqueos={bloqueos}
        hoy={hoyArgentina()}
        yoId={user.id}
      />
    </div>
  );
}
