import { cancelarDesafio, responderDesafio } from "@/lib/actions/desafios";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { buttonClass } from "@/components/ui/Button";
import type { EstadoDesafio } from "@/lib/desafios";

/** Aceptar o rechazar un desafío recibido. */
export function ResponderDesafio({ desafioId, rival }: { desafioId: string; rival: string }) {
  return (
    <>
      <ActionForm action={responderDesafio} className="flex flex-col gap-1">
        <input type="hidden" name="desafio_id" value={desafioId} />
        <input type="hidden" name="acepta" value="true" />
        <SubmitButton size="sm" pendingText="Aceptando…">
          Aceptar
        </SubmitButton>
      </ActionForm>
      <ActionForm action={responderDesafio} className="flex flex-col gap-1">
        <input type="hidden" name="desafio_id" value={desafioId} />
        <input type="hidden" name="acepta" value="false" />
        <ConfirmSubmitButton
          confirmMessage={`¿Rechazar el desafío de ${rival}? Se les avisa a sus admins.`}
          confirmLabel="Rechazar"
          className={buttonClass("ghost", "sm")}
        >
          Rechazar
        </ConfirmSubmitButton>
      </ActionForm>
    </>
  );
}

/** Retirar un desafío pendiente o cancelar uno aceptado (ver puedeCancelar). */
export function CancelarDesafio({
  desafioId,
  grupoId,
  rival,
  estado,
  botonClassName,
}: {
  desafioId: string;
  /** El grupo desde el que se cancela (el de la pantalla). */
  grupoId: string;
  rival: string;
  /** El estado que se ve en pantalla (si cambió mientras tanto, la base no cancela). */
  estado: EstadoDesafio;
  /** Para reemplazar el estilo del botón (en la página del partido va ancho, como Eliminar). */
  botonClassName?: string;
}) {
  // Pendiente: todavía no hay partido, se retira el desafío.
  const partidoArmado = estado !== "pendiente";
  return (
    <ActionForm action={cancelarDesafio} className="flex flex-col gap-1">
      <input type="hidden" name="desafio_id" value={desafioId} />
      <input type="hidden" name="grupo_id" value={grupoId} />
      <input type="hidden" name="estado" value={estado} />
      <ConfirmSubmitButton
        confirmMessage={
          partidoArmado
            ? `¿Cancelar el partido contra ${rival}? Se borra el partido de los dos grupos y se les avisa a los convocados.`
            : `¿Retirar el desafío a ${rival}?`
        }
        confirmLabel={partidoArmado ? "Cancelar partido" : "Retirar"}
        className={botonClassName ?? buttonClass("ghost", "sm", "!text-danger-400 hover:!text-danger-300")}
      >
        {partidoArmado ? "Cancelar partido" : "Retirar desafío"}
      </ConfirmSubmitButton>
    </ActionForm>
  );
}
