import type { Bloqueo } from "@/lib/types";
import { describirBloqueo } from "@/lib/disponibilidad";

/** Un jugador que ese día ya está convocado en un partido de otro grupo (get_ocupados_otro_grupo). */
export interface Ocupado {
  jugador_id: string;
  hora: string | null;
  /** Si confirmó que juega allá (si no, solo está convocado). */
  confirmado: boolean;
}

function textoOcupado(o: Ocupado) {
  const hora = o.hora ? ` (${o.hora.slice(0, 5)}hs)` : "";
  return o.confirmado ? `Ya juega con otro grupo ese día${hora}` : `Está convocado en otro grupo ese día${hora}`;
}

/**
 * Los avisos de disponibilidad de un convocado (dijo que no puede, ya está en
 * otro grupo ese día). Son solo avisos: no impiden convocarlo.
 */
export default function AvisosConvocado({ bloqueo, ocupado }: { bloqueo?: Bloqueo; ocupado?: Ocupado }) {
  return (
    <>
      {bloqueo && (
        <p className="truncate text-xs text-gold-400">
          ⚠ Dijo que no puede: {describirBloqueo(bloqueo)}
          {bloqueo.nota ? ` (${bloqueo.nota})` : ""}
        </p>
      )}
      {ocupado && <p className="truncate text-xs text-gold-400">⚠ {textoOcupado(ocupado)}</p>}
    </>
  );
}
