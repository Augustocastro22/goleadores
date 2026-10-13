/**
 * El `next` de login/callback si es una ruta de esta app; si no, null (evita
 * open redirects). No alcanza con que empiece con "/": "//evil.com",
 * "/\evil.com" o "/<tab>/evil.com" los navegadores los resuelven como otro sitio.
 */
export function rutaInterna(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(next)) return null;
  const base = "http://goleadores.invalid";
  try {
    const url = new URL(next, base);
    return url.origin === base ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
}
