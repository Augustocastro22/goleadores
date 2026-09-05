/**
 * El JWT de una sesión creada por el link de "recuperar contraseña" trae
 * amr: [{ method: "recovery", ... }]. Lo usamos para no dejar navegar el
 * resto de la app hasta que se defina la contraseña nueva.
 */
export function isRecoverySession(accessToken?: string | null): boolean {
  if (!accessToken) return false;
  try {
    const payload = accessToken.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const { amr } = JSON.parse(json) as { amr?: { method: string }[] };
    return amr?.[amr.length - 1]?.method === "recovery";
  } catch {
    return false;
  }
}
