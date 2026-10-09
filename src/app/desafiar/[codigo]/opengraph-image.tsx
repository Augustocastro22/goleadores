import { getGrupoDeDesafio } from "@/lib/invitacion";
import { imagenGrupo, OG_SIZE } from "@/lib/og/imagen-grupo";

/* Vista previa de un link de desafío: el escudo y el nombre del grupo que desafían. */

export const alt = "Desafío a un grupo de Goleadores";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return imagenGrupo(await getGrupoDeDesafio(codigo), "Desafiá a");
}
