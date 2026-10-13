"use client";

import { useEffect, useState } from "react";

/**
 * Campo oculto del form de "Salir" con la suscripción push de este
 * dispositivo, para borrarla al cerrar sesión: si no, en un celular
 * compartido le seguían llegando los avisos del que salió al que entra.
 */
export default function PushEndpointCampo() {
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    async function leer() {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) setEndpoint(subscription.endpoint);
    }
    leer().catch(() => {});
  }, []);

  return <input type="hidden" name="push_endpoint" value={endpoint} />;
}
