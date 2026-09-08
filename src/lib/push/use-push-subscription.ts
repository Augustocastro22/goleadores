"use client";

import { useEffect, useState } from "react";
import { suscribirPush, desuscribirPush } from "@/lib/actions/push";

export type PushEstado = "cargando" | "no-soportado" | "denegado" | "activo" | "inactivo";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** Estado y acciones de la suscripción push del dispositivo actual. */
export function usePushSubscription() {
  const [estado, setEstado] = useState<PushEstado>("cargando");
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

  return { estado, working, error, activar, desactivar };
}
