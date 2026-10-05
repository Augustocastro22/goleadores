import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRecoverySession } from "@/lib/recovery";
import { GRUPO_COOKIE, GRUPO_COOKIE_OPTIONS } from "@/lib/grupo-cookie";

// No requieren sesión para poder verse.
const NO_AUTH_REQUIRED_PATHS = [
  "/login",
  "/signup",
  "/recuperar",
  "/auth/callback",
  "/actualizar-password",
  // La invitación se ve sin sesión: muestra el grupo y ofrece entrar o crear
  // la cuenta (ver src/app/unirse/[codigo]/page.tsx).
  "/unirse/",
  "/privacidad",
  "/contacto",
  // La imagen de la vista previa de los links: la pide WhatsApp, sin sesión.
  "/opengraph-image",
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

  // getClaims verifica el token acá mismo con la clave pública del proyecto
  // (firma ES256), sin ir al servidor de Supabase en cada pantalla como
  // getUser. Si el token venció, lo renueva y actualiza las cookies.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  const noAuthRequired = NO_AUTH_REQUIRED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const redirectIfLoggedIn = REDIRECT_IF_LOGGED_IN_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!user && !noAuthRequired) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
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

  // ?grupo=<id> (lo traen los links de las notificaciones push) cambia el
  // grupo activo y se saca de la URL. Si no es miembro de ese grupo,
  // getContexto() lo ignora y usa otro.
  const grupoParam = request.nextUrl.searchParams.get("grupo");
  if (user && grupoParam) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("grupo");
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    response.cookies.set(GRUPO_COOKIE, grupoParam, GRUPO_COOKIE_OPTIONS);
    return response;
  }

  return supabaseResponse;
}
