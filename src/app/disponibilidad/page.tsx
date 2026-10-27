import Link from "next/link";
import { BLOQUEOS_DEMO, JUGADORES_DEMO } from "@/lib/disponibilidad-demo";
import EquipoDisponibilidad from "./EquipoDisponibilidad";

// BOCETO: usa datos de ejemplo. Falta leer los bloqueos reales de los
// miembros del grupo (hoy la RLS de bloqueos_disponibilidad solo deja verlos
// al admin) y agregar la sección a la navegación.
export default function DisponibilidadEquipoPage() {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-white">Disponibilidad del equipo</h1>
      <p className="mb-5 text-sm text-zinc-400">
        Mirá cuándo puede jugar cada uno y elegí el mejor horario.{" "}
        <Link href="/perfil" className="font-semibold text-primary-400 hover:text-primary-300">
          Cargar la mía
        </Link>
      </p>
      <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2 text-xs text-amber-300">
        Boceto con datos de ejemplo.
      </p>
      <EquipoDisponibilidad jugadores={JUGADORES_DEMO} bloqueos={BLOQUEOS_DEMO} hoy={hoy} />
    </div>
  );
}
