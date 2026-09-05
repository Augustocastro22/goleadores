import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  // Formato token_hash: no depende de nada guardado en el navegador que
  // pidió el reset, así que funciona aunque el link se abra en otro
  // navegador o en el navegador in-app del mail (Gmail, etc.).
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}/actualizar-password`);
    }
  }

  // Formato PKCE (?code=), por si algún flujo lo sigue generando.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/actualizar-password`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("El link de recuperación venció o no es válido.")}`
  );
}
