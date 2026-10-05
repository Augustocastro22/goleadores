import type { Metadata } from "next";
import Link from "next/link";
import { getContexto } from "@/lib/grupo";
import { createAdminClient } from "@/lib/supabase/admin";
import { cambiarGrupo, unirseGrupo } from "@/lib/actions/grupos";
import Card from "@/components/ui/Card";
import GrupoLogo from "@/components/ui/GrupoLogo";
import { buttonClass } from "@/components/ui/Button";
import SubmitButton from "@/components/SubmitButton";
import ActionForm from "@/components/ActionForm";
import { getGrupoDeInvitacion } from "@/lib/invitacion";

/** Vista previa del link (la imagen está en opengraph-image.tsx, al lado). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>;
}): Promise<Metadata> {
  const { codigo } = await params;
  const grupo = await getGrupoDeInvitacion(codigo);
  if (!grupo) return {};

  const title = `Sumate a ${grupo.nombre}`;
  const description = `Te invitaron al grupo ${grupo.nombre} en Goleadores. Entrá para ver los partidos, los goles y las votaciones.`;
  return {
    title,
    description,
    // Va completo: el openGraph de una página reemplaza al del layout, no se combina.
    openGraph: { title, description, siteName: "Goleadores", locale: "es_AR", type: "website" },
  };
}

export default async function UnirsePage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const { supabase, user, grupos } = await getContexto();

  // Sin sesión no hay usuario con el que llamar a la función, así que la
  // vista previa (nombre, escudo, cantidad de miembros) se lee con la service
  // role. Solo con el código exacto: no permite listar ni buscar grupos.
  const { data } = await (user ? supabase : createAdminClient())
    .rpc("get_grupo_por_codigo", { p_codigo: codigo })
    .maybeSingle<{
      id: string;
      nombre: string;
      logo_url: string | null;
      miembros: number;
      requiere_aprobacion: boolean;
      pendiente: boolean;
    }>();

  if (!data) {
    return (
      <Card className="mx-auto max-w-sm p-6 text-center">
        <p className="mb-1 font-bold text-white">Link inválido</p>
        <p className="mb-4 text-sm text-zinc-500">
          Esta invitación no existe o el admin la renovó. Pedile el link nuevo.
        </p>
        <Link href="/grupos" className={buttonClass("secondary", "sm")}>
          Ir a mis grupos
        </Link>
      </Card>
    );
  }

  const yaSoyMiembro = grupos.some((g) => g.id === data.id);
  const next = encodeURIComponent(`/unirse/${codigo}`);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <Card className="w-full max-w-sm p-6 text-center">
        <GrupoLogo src={data.logo_url} nombre={data.nombre} size={88} className="mx-auto" />
        <p className="mt-4 text-sm text-zinc-500">Te invitaron a</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{data.nombre}</h1>
        <p className="mt-1 mb-5 text-sm text-zinc-500">
          {data.miembros} {data.miembros === 1 ? "miembro" : "miembros"}
        </p>
        {!user ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-400">
              Para sumarte, creá tu cuenta o entrá con la que ya tenés. Después volvés acá solo.
            </p>
            <Link href={`/signup?next=${next}`} className={buttonClass("primary", "md", "w-full")}>
              Crear mi cuenta
            </Link>
            <Link href={`/login?next=${next}`} className={buttonClass("secondary", "md", "w-full")}>
              Ya tengo cuenta
            </Link>
          </div>
        ) : yaSoyMiembro ? (
          <form action={cambiarGrupo}>
            <input type="hidden" name="grupo_id" value={data.id} />
            <p className="mb-3 text-sm text-zinc-400">Ya sos parte de este grupo.</p>
            <SubmitButton pendingText="Entrando..." className="w-full">
              Entrar
            </SubmitButton>
          </form>
        ) : data.pendiente ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-400">
              Ya pediste entrar. Cuando el admin te acepte te llega una notificación.
            </p>
            <Link href="/grupos" className={buttonClass("secondary", "md", "w-full")}>
              Ver mis grupos
            </Link>
          </div>
        ) : (
          <ActionForm action={unirseGrupo} className="flex flex-col gap-3">
            <input type="hidden" name="codigo" value={codigo} />
            {data.requiere_aprobacion && (
              <p className="text-sm text-zinc-400">
                Este grupo pide aprobación: el admin tiene que aceptarte antes de que puedas entrar.
              </p>
            )}
            <SubmitButton pendingText="Enviando..." className="w-full">
              {data.requiere_aprobacion ? "Pedir para entrar" : "Sumarme al grupo"}
            </SubmitButton>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
