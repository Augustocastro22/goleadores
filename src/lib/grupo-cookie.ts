/**
 * Cookie con el grupo que el usuario está mirando. Vive en un módulo aparte
 * (sin next/headers) para poder usarla también desde el proxy.
 * El valor nunca se confía tal cual: getContexto() lo valida contra las
 * membresías del usuario y, si no es miembro, cae al primer grupo suyo.
 */
export const GRUPO_COOKIE = "grupo_activo";

export const GRUPO_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  httpOnly: true,
};

/** Agrega ?grupo=<id> a un link (para que al abrir una notificación se vea el grupo correcto). */
export function urlConGrupo(path: string, grupoId: string) {
  return `${path}${path.includes("?") ? "&" : "?"}grupo=${grupoId}`;
}
