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
