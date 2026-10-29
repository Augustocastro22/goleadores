"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import SobreResultado, { suscribir, useSobreAbierto, yaAbierto, type GanadorSobre } from "@/components/SobreResultado";

export interface SobrePila {
  id: string;
  titulo: string;
  peor?: boolean;
  ganadores: GanadorSobre[];
  candidatos: GanadorSobre[];
}

/**
 * Los sobres del último partido que todavía no se abrieron en este
 * dispositivo (los del partido y los de acá se acuerdan juntos): se abre uno,
 * y recién cuando termina aparece el siguiente. Los que ya se abrieron no
 * se muestran.
 */
export default function PilaSobres({ sobres }: { sobres: SobrePila[] }) {
  const estado = useSyncExternalStore(
    suscribir,
    () => sobres.map((s) => (yaAbierto(s.id) ? "1" : "0")).join(""),
    () => null
  );
  // Cuáles faltaban al llegar: se queda con eso para que un sobre recién abierto no desaparezca de golpe.
  const [inicial, setInicial] = useState<string | null>(null);
  if (estado !== null && inicial === null) setInicial(estado);
  const [abiertos, setAbiertos] = useState(0);

  if (inicial === null) return null;
  const pendientes = sobres.filter((_, i) => inicial[i] === "0");
  if (pendientes.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold text-white">Último partido</h2>
        <p className="text-xs text-zinc-500">
          {pendientes.length === 1 ? "Tenés un sobre sin abrir." : "Tenés sobres sin abrir: de a uno."}
        </p>
      </div>
      {pendientes.slice(0, abiertos + 1).map((s, i) => (
        <SobreResultado
          key={s.id}
          id={s.id}
          titulo={s.titulo}
          peor={s.peor}
          ganadores={s.ganadores}
          candidatos={s.candidatos}
          alAbrir={() => setAbiertos((a) => Math.max(a, i + 1))}
        />
      ))}
    </section>
  );
}

/** Muestra lo de adentro solo una vez abierto ese sobre (para no adelantar el resultado en otro lado). */
export function SoloSiAbierto({ id, children }: { id: string; children: ReactNode }) {
  return useSobreAbierto(id) ? <>{children}</> : null;
}
