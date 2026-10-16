"use client";

import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import Card from "@/components/ui/Card";
import ModoJuegoFields from "@/components/ModoJuegoFields";
import { CONFIG_DEFAULTS, type ModoJuego } from "@/lib/config";
import { elegirModoJuego } from "@/lib/actions/admin";

/**
 * La pregunta única a los admins de un grupo que todavía no eligió cómo juega
 * (se muestra en Partidos y al armar uno). Al guardar no vuelve a aparecer; se
 * cambia después en Admin → Reglas.
 */
export default function PreguntaModoJuego({ grupoId, sugerido }: { grupoId: string; sugerido: ModoJuego | null }) {
  return (
    <Card className="mb-4 p-4">
      <p className="text-sm font-semibold text-white">Una pregunta rápida</p>
      <p className="mt-0.5 mb-3 text-xs text-zinc-500">
        Así armamos los partidos a su manera: elegir quién juega contra un rival, o dividirse en dos equipos.
      </p>
      <ActionForm action={elegirModoJuego} grupoId={grupoId} className="flex flex-col gap-3">
        <ModoJuegoFields inicial={{ ...CONFIG_DEFAULTS, modo_juego: null }} sugerido={sugerido} />
        <SubmitButton pendingText="Guardando..." size="sm" className="self-start">
          Listo
        </SubmitButton>
      </ActionForm>
    </Card>
  );
}
