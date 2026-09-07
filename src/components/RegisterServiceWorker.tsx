"use client";

import { useEffect } from "react";

/** Registra el service worker al cargar la app (necesario para Web Push). */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
