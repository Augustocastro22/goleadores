import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Recuperar contraseña usa el flujo implícito (ver server.ts).
      auth: { flowType: "implicit" },
    }
  );
}
