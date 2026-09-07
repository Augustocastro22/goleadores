import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la service role key: bypasea RLS. Solo para usarse desde
 * código server-side que necesita leer/escribir datos de otros usuarios
 * (ej: suscripciones push de todos los convocados a un partido).
 * Nunca importar desde un componente cliente.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
