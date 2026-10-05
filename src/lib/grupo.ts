import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { GRUPO_COOKIE } from "@/lib/grupo-cookie";
import type { Grupo, Miembro, Profile, Rol } from "@/lib/types";

type GrupoBasico = Pick<
  Grupo,
  "id" | "nombre" | "codigo_invitacion" | "requiere_aprobacion" | "logo_url"
>;

export type MiGrupo = GrupoBasico & { rol: Rol };

/** Lo que las páginas usan del usuario logueado (sale del token de sesión). */
export interface UsuarioSesion {
  id: string;
  email: string | null;
}

export interface Contexto {
  supabase: SupabaseClient;
  user: UsuarioSesion | null;
  /** Todos los grupos del usuario, en el orden en que se sumó. */
  grupos: MiGrupo[];
  /** El grupo que está mirando (cookie), o el primero si la cookie no es válida. */
  grupo: MiGrupo | null;
}

/**
 * Usuario logueado, sus grupos y el grupo activo. Memoizado por request, así
 * NavBar y la página no repiten las mismas consultas.
 */
export const getContexto = cache(async (): Promise<Contexto> => {
  const supabase = await createClient();
  // Verificado localmente con la clave pública del proyecto (ver
  // src/lib/supabase/middleware.ts); las acciones que cambian datos de la
  // cuenta siguen usando getUser.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return { supabase, user: null, grupos: [], grupo: null };
  const user: UsuarioSesion = { id: claims.sub, email: claims.email ?? null };

  const { data } = await supabase
    .from("grupo_miembros")
    .select("rol, grupos(id, nombre, codigo_invitacion, requiere_aprobacion, logo_url)")
    .eq("jugador_id", user.id)
    .order("created_at");
  const grupos = ((data ?? []) as unknown as {
    rol: Rol;
    grupos: GrupoBasico | null;
  }[])
    .filter((m) => m.grupos)
    .map((m) => ({ ...m.grupos!, rol: m.rol }));

  const cookieId = (await cookies()).get(GRUPO_COOKIE)?.value;
  const grupo = grupos.find((g) => g.id === cookieId) ?? grupos[0] ?? null;

  return { supabase, user, grupos, grupo };
});

/** Para páginas que necesitan un grupo: sin sesión va a /login, sin grupo a /grupos. */
export async function requireGrupo() {
  const ctx = await getContexto();
  if (!ctx.user) redirect("/login");
  if (!ctx.grupo) redirect("/grupos");
  return { ...ctx, user: ctx.user, grupo: ctx.grupo };
}

/** Rol del usuario actual en un grupo puntual (null si no es miembro). */
export function rolEn(ctx: Contexto, grupoId: string): Rol | null {
  return ctx.grupos.find((g) => g.id === grupoId)?.rol ?? null;
}

/** Miembros de un grupo con su rol, ordenados por nombre. */
export async function getMiembros(supabase: SupabaseClient, grupoId: string): Promise<Miembro[]> {
  const { data } = await supabase
    .from("grupo_miembros")
    .select("rol, profiles(*)")
    .eq("grupo_id", grupoId);
  return ((data ?? []) as unknown as { rol: Rol; profiles: Profile | null }[])
    .filter((m) => m.profiles)
    .map((m) => ({ ...m.profiles!, rol: m.rol }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
