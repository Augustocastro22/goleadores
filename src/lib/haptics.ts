/**
 * Vibraciones cortas para acompañar lo que se toca. En iPhone (Safari) no hay
 * vibración: por eso siempre van junto con una señal visual, nunca solas.
 */
function vibrar(patron: number | number[]) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  // Chrome no deja vibrar si la persona todavía no tocó la página (y lo marca como error en la consola).
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    navigator.vibrate(patron);
  } catch {
    // Algunos navegadores lo bloquean sin interacción previa: no pasa nada.
  }
}

/** Un toque (sumar o restar un gol, elegir algo). */
export const tap = () => vibrar(10);
/** Algo salió bien (se guardó, ganaron). */
export const exito = () => vibrar([12, 40, 18]);
/** Algo no se pudo. */
export const error = () => vibrar([30, 50, 30]);
