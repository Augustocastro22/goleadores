import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Nombre y escudo del grupo de un link de invitación, para la vista previa
 * que muestran WhatsApp y compañía (título e imagen). La pide un bot sin
 * sesión, así que se lee con la service role, como la página de unirse; solo
 * con el código exacto, no permite listar ni buscar grupos. Es lo mismo que
 * ya muestra la página a cualquiera que tenga el link.
 */
export const getGrupoDeInvitacion = cache(async (codigo: string) => {
  const { data } = await createAdminClient()
    .rpc("get_grupo_por_codigo", { p_codigo: codigo })
    .maybeSingle<{ nombre: string; logo_url: string | null }>();
  return data ? { nombre: data.nombre, logoUrl: data.logo_url } : null;
});

/**
 * Lo mismo para un link de desafío (/desafiar/<codigo>): nombre, escudo y
 * con cuántos desafíos jugados y sin verificar viene el grupo.
 */
export const getGrupoDeDesafio = cache(async (codigo: string) => {
  const { data } = await createAdminClient()
    .rpc("get_grupo_por_codigo_desafio", { p_codigo: codigo })
    .maybeSingle<{ id: string; nombre: string; logo_url: string | null; jugados: number; sin_verificar: number }>();
  return data
    ? {
        id: data.id,
        nombre: data.nombre,
        logoUrl: data.logo_url,
        jugados: Number(data.jugados),
        sinVerificar: Number(data.sin_verificar),
      }
    : null;
});
