"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PushInstrucciones from "@/components/PushInstrucciones";
import { usePushSubscription } from "@/lib/push/use-push-subscription";

export default function PushSubscribe() {
  const { estado, plataforma, working, error, activar, desactivar } = usePushSubscription();

  if (estado === "cargando") return null;

  return (
    <Card className="flex flex-col gap-3 p-6">
      <div>
        <p className="font-semibold text-white">Notificaciones</p>
        <p className="mt-0.5 text-sm text-zinc-500">
          Te avisamos cuando te convocan a un partido, cuando se abre o cierra la votación y cuando hay
          novedades de un desafío.
        </p>
      </div>

      <PushInstrucciones estado={estado} plataforma={plataforma} className="text-sm text-zinc-500" />

      {estado === "inactivo" && (
        <Button type="button" size="sm" onClick={activar} disabled={working} className="self-start">
          {working ? "Activando..." : "Activar notificaciones"}
        </Button>
      )}

      {estado === "activo" && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={desactivar}
          disabled={working}
          className="self-start"
        >
          {working ? "Desactivando..." : "Desactivar notificaciones"}
        </Button>
      )}

      {error && <p className="text-sm text-danger-400">{error}</p>}
    </Card>
  );
}
