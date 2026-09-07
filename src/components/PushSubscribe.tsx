"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { suscribirPush, desuscribirPush } from "@/lib/actions/push";

type Estado = "cargando" | "no-soportado" | "denegado" | "activo" | "inactivo";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushSubscribe() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setEstado("no-soportado");
        return;
      }
      if (Notification.permission === "denied") {
        setEstado("denegado");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setEstado(subscription ? "activo" : "inactivo");
    }
    check().catch(() => setEstado("no-soportado"));
  }, []);

  async function activar() {
    setWorking(true);
    setError(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado("denegado");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Falta configurar la clave pública VAPID.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = subscription.toJSON();
      const result = await suscribirPush({
        endpoint: subscription.endpoint,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEstado("activo");
    } catch {
      setError("No se pudo activar las notificaciones.");
    } finally {
      setWorking(false);
    }
  }

  async function desactivar() {
    setWorking(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await desuscribirPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEstado("inactivo");
    } catch {
      setError("No se pudo desactivar las notificaciones.");
    } finally {
      setWorking(false);
    }
  }

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

      <p className="text-xs text-zinc-600">
        En iPhone: agregá esta app a la pantalla de inicio (Compartir → Agregar a inicio) para
        poder recibir notificaciones.
      </p>

      {error && <p className="text-sm text-danger-400">{error}</p>}
    </Card>
  );
}
