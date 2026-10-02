import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de los links que manda Supabase por mail:
 * - Confirmación de cuenta (signup): trae ?next= con a dónde iba la persona
 *   (por ejemplo /unirse/<codigo>), ver signup() en src/lib/actions/auth.ts.
 * - Recuperar contraseña: siempre termina en /actualizar-password.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  // Solo rutas internas (evita open redirects).
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const destino = type === "recovery" || !next ? "/actualizar-password" : next;

  const supabase = await createClient();

  // Formato token_hash: no depende de nada guardado en el navegador que
  // pidió el link, así que funciona aunque se abra en otro navegador o en el
  // navegador in-app del mail (Gmail, etc.).
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }

  // Formato PKCE (?code=): es el que usan la confirmación de cuenta y el
  // login con Google.
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Con Google no pasa por la casilla del registro: el botón avisa que al
      // continuar acepta la política, y acá queda registrado cuándo.
      if (searchParams.get("oauth") && !data.user?.user_metadata?.privacidad_aceptada_en) {
        await supabase.auth.updateUser({ data: { privacidad_aceptada_en: new Date().toISOString() } });
      }
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  // Si el mail de confirmación se abrió en otro navegador, el email igual
  // queda confirmado pero no se puede abrir la sesión acá: alcanza con entrar.
  const mensaje = next
    ? "No pudimos abrir tu sesión desde el link. Si ya confirmaste tu email, entrá con tu contraseña."
    : "El link de recuperación venció o no es válido.";
  const login = new URL("/login", origin);
  login.searchParams.set("error", mensaje);
  if (next && next !== "/partidos") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
