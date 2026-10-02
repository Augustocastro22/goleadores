import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/grupo";
import { cambiarGrupo, unirseGrupo } from "@/lib/actions/grupos";
import Card from "@/components/ui/Card";
import GrupoLogo from "@/components/ui/GrupoLogo";
import { buttonClass } from "@/components/ui/Button";
import SubmitButton from "@/components/SubmitButton";
import ActionForm from "@/components/ActionForm";

export default async function UnirsePage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const { supabase, user, grupos } = await getContexto();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/unirse/${codigo}`)}`);

  const { data } = await supabase
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

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <Card className="w-full max-w-sm p-6 text-center">
        <GrupoLogo src={data.logo_url} nombre={data.nombre} size={88} className="mx-auto" />
        <p className="mt-4 text-sm text-zinc-500">Te invitaron a</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{data.nombre}</h1>
        <p className="mt-1 mb-5 text-sm text-zinc-500">
          {data.miembros} {data.miembros === 1 ? "miembro" : "miembros"}
        </p>
        {yaSoyMiembro ? (
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
