"use client";

import { useEffect, useState } from "react";
import { suscribirPush, desuscribirPush } from "@/lib/actions/push";

export type PushEstado =
  | "cargando"
  | "no-soportado"
  | "navegador-app"
  | "requiere-instalar"
  | "denegado"
  | "activo"
  | "inactivo";

export type Plataforma = "ios" | "android" | "escritorio";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** iPhone o iPad (el iPad se presenta como "Macintosh", pero con pantalla táctil). */
function esIOS() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

function plataformaActual(): Plataforma {
  if (esIOS()) return "ios";
  if (/android/i.test(navigator.userAgent)) return "android";
  return "escritorio";
}

/** Abierta desde el ícono de la pantalla de inicio (no en una pestaña del navegador). */
function esAppInstalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * El navegador de adentro de Instagram, Facebook o TikTok (al tocar un link
 * desde ahí): no recibe notificaciones ni se puede instalar.
 */
function esNavegadorDeApp() {
  return /instagram|fban|fbav|fb_iab|tiktok|musical_ly|bytedancewebview/i.test(navigator.userAgent);
}

/** Estado y acciones de la suscripción push del dispositivo actual. */
export function usePushSubscription() {
  const [estado, setEstado] = useState<PushEstado>("cargando");
  const [plataforma, setPlataforma] = useState<Plataforma>("escritorio");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      setPlataforma(plataformaActual());
      // Antes que ver si hay soporte: en estos casos el navegador dice que no
      // soporta notificaciones, pero hay un paso para habilitarlas.
      if (esNavegadorDeApp()) {
        setEstado("navegador-app");
        return;
      }
      // iOS solo entrega push a la app agregada a la pantalla de inicio: en
      // una pestaña de Safari (o de Chrome, que en iOS también es Safari) ni
      // siquiera existen Notification ni PushManager.
      if (esIOS() && !esAppInstalada()) {
        setEstado("requiere-instalar");
        return;
      }
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
      // El navegador la tiene: se asegura de que en la base esté a nombre de
      // quien está ahora (al cerrar sesión se borra, ver PushEndpointCampo).
      if (subscription) {
        const json = subscription.toJSON();
        if (json.keys?.p256dh && json.keys.auth) {
          suscribirPush({ endpoint: subscription.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }).catch(
            () => {}
          );
        }
      }
    }
    check().catch(() => setEstado("no-soportado"));
  }, []);

  async function activar() {
    setWorking(true);
    setError(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso === "denied") {
        setEstado("denegado");
        return;
      }
      if (permiso !== "granted") {
        // Cerró el cartel sin elegir: se puede volver a pedir.
        setError("No elegiste ninguna opción. Tocá Activar de nuevo y elegí Permitir.");
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

  return { estado, plataforma, working, error, activar, desactivar };
}
