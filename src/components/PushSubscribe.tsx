"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { usePushSubscription } from "@/lib/push/use-push-subscription";

export default function PushSubscribe() {
  const { estado, working, error, activar, desactivar } = usePushSubscription();

  if (estado === "cargando") return null;

  return (
    <Card className="flex flex-col gap-3 p-6">
      <div>
        <p className="font-semibold text-white">Notificaciones</p>
        <p className="mt-0.5 text-sm text-zinc-500">
          Recibí un aviso cuando se crea un partido nuevo y cuando se abre o cierra la votación.
        </p>
      </div>

      {estado === "no-soportado" && (
        <p className="text-sm text-zinc-500">Tu navegador no soporta notificaciones push.</p>
      )}

      {estado === "requiere-instalar" && (
        <p className="text-sm text-zinc-500">
          En iPhone, Safari solo entrega notificaciones a apps agregadas a la pantalla de inicio.
          Tocá <span className="text-zinc-300">Compartir → Agregar a inicio</span>, abrí la app
          desde ese ícono y volvé acá para activarlas.
        </p>
      )}

      {estado === "denegado" && (
        <p className="text-sm text-zinc-500">
          Bloqueaste las notificaciones para este sitio. Para activarlas, habilitalas desde los
          permisos del navegador.
        </p>
      )}

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
