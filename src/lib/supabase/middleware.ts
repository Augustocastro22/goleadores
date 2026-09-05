import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRecoverySession } from "@/lib/recovery";

// No requieren sesión para poder verse.
const NO_AUTH_REQUIRED_PATHS = [
  "/login",
  "/signup",
  "/recuperar",
  "/auth/callback",
  "/actualizar-password",
];
// Si ya hay una sesión normal, no tiene sentido quedarse ahí (se manda a
// /partidos). "/actualizar-password" queda afuera a propósito: durante el
// primer render todavía no hay sesión (el token viaja en el fragmento de
// la URL, el navegador la crea recién al procesar el link), y una vez
// creada tampoco queremos sacarlo de esa pantalla hasta que termine.
const REDIRECT_IF_LOGGED_IN_PATHS = ["/login", "/signup", "/recuperar"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const noAuthRequired = NO_AUTH_REQUIRED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const redirectIfLoggedIn = REDIRECT_IF_LOGGED_IN_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!user && !noAuthRequired) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && redirectIfLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/partidos";
    return NextResponse.redirect(url);
  }

  // Una sesión creada por el link de "recuperar contraseña" no debe poder
  // navegar el resto de la app hasta que se defina la contraseña nueva.
  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (isRecoverySession(session?.access_token) && request.nextUrl.pathname !== "/actualizar-password") {
      const url = request.nextUrl.clone();
      url.pathname = "/actualizar-password";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
