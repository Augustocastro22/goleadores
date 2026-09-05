import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Sin SMTP propio no podemos editar la plantilla de mail para usar
      // el formato token_hash de PKCE, así que usamos el flujo implícito
      // (funciona con la plantilla por defecto de Supabase y no depende
      // de ninguna cookie guardada en el navegador que pidió el reset).
      auth: { flowType: "implicit" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // se llama desde un Server Component; el middleware refresca la sesión
          }
        },
      },
    }
  );
}
