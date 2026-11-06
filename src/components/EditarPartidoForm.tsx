import Link from "next/link";
import { editarPartido } from "@/lib/actions/admin";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import HoraSelect from "@/components/HoraSelect";
import CanchaInput from "@/components/CanchaInput";
import { Input, Label } from "@/components/ui/Input";

/**
 * Fecha, hora, lugar y rival de un partido (no de un desafío: eso lo acuerdan
 * los dos grupos). Está en el propio partido y en Admin → Partidos. Entre
 * ellos el rival es el nombre del segundo equipo, que se cambia en la
 * convocatoria: acá no se muestra.
 */
export default function EditarPartidoForm({
  partido,
  grupoId,
  canchas,
  interno,
  pideConfirmacion,
  verPartido = false,
  className = "",
}: {
  partido: { id: string; fecha: string; hora: string | null; lugar: string; rival: string; jugado: boolean };
  grupoId: string;
  canchas: { nombre: string }[];
  interno: boolean;
  /** Si el grupo pide confirmación: se ofrece pedir que vuelvan a confirmar si cambia el horario. */
  pideConfirmacion: boolean;
  /** El link "Ver partido" (en Admin). */
  verPartido?: boolean;
  className?: string;
}) {
  return (
    <ActionForm action={editarPartido} soloConCambios grupoId={grupoId} className={`flex flex-col gap-3 ${className}`}>
      <input type="hidden" name="partido_id" value={partido.id} />
      <div className="flex gap-3">
        <Label className="flex-1">
          Fecha
          <Input type="date" name="fecha" required defaultValue={partido.fecha} />
        </Label>
        <Label className="w-28 shrink-0">
          Hora
          <HoraSelect defaultValue={partido.hora?.slice(0, 5) ?? ""} />
        </Label>
      </div>
      <Label>
        Lugar
        <CanchaInput canchas={canchas} defaultValue={partido.lugar} required />
      </Label>
      {interno ? (
        <input type="hidden" name="rival" value={partido.rival} />
      ) : (
        <Label>
          Rival
          <Input type="text" name="rival" required defaultValue={partido.rival} />
        </Label>
      )}
      {!partido.jugado && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="avisar" defaultChecked className="h-4 w-4 accent-primary-500" />
            Avisar a los convocados si cambia la fecha o la hora
          </label>
          {pideConfirmacion && (
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" name="reconfirmar" className="h-4 w-4 accent-primary-500" />
              Si cambia la fecha o la hora, pedir que vuelvan a confirmar
            </label>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Guardando..." size="sm">
          Guardar
        </SubmitButton>
        {verPartido && (
          <Link href={`/partidos/${partido.id}`} className="text-sm font-medium text-zinc-400 transition hover:text-white">
            Ver partido
          </Link>
        )}
      </div>
    </ActionForm>
  );
}
