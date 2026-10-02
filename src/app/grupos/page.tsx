import { redirect } from "next/navigation";
import { getContexto } from "@/lib/grupo";
import {
  cambiarGrupo,
  cancelarSolicitud,
  crearGrupo,
  salirDelGrupo,
  unirseGrupo,
} from "@/lib/actions/grupos";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import GrupoLogo from "@/components/ui/GrupoLogo";
import { Input, Label } from "@/components/ui/Input";
import { buttonClass } from "@/components/ui/Button";
import SubmitButton from "@/components/SubmitButton";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import ActionForm from "@/components/ActionForm";
import ReglasFields from "@/components/ReglasFields";
import { CONFIG_DEFAULTS } from "@/lib/config";
import { IconChevronRight } from "@/components/icons";

export default async function GruposPage() {
  const { supabase, user, grupos, grupo: activo } = await getContexto();
  if (!user) redirect("/login");

  const { data: solicitudesRaw } = await supabase
    .from("grupo_solicitudes")
    .select("grupo_id, grupos(nombre, logo_url)")
    .eq("jugador_id", user.id)
    .order("created_at");
  const solicitudes = (solicitudesRaw ?? []) as unknown as {
    grupo_id: string;
    grupos: { nombre: string; logo_url: string | null } | null;
  }[];

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-white">
          {grupos.length === 0 && solicitudes.length === 0 ? "¡Hola!" : "Tus grupos"}
        </h1>
        <p className="text-sm text-zinc-500">
          {grupos.length > 0
            ? "Cada grupo tiene sus propios partidos, estadísticas y encuestas."
            : solicitudes.length > 0
              ? "Mientras esperás que te acepten, podés sumarte a otro grupo o crear el tuyo."
              : "Para empezar, creá el grupo de tu equipo o sumate a uno con el link que te pasaron."}
        </p>
      </div>

      {grupos.length > 0 && (
        <Card className="divide-y divide-border overflow-hidden py-1">
          {grupos.map((g) => {
            const esActivo = g.id === activo?.id;
            return (
              <div
                key={g.id}
                className={`flex items-center gap-3 px-4 py-3.5 ${
                  esActivo ? "border-l-2 border-l-primary-400 bg-primary-500/5" : ""
                }`}
              >
                <GrupoLogo src={g.logo_url} nombre={g.nombre} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{g.nombre}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant={g.rol === "admin" ? "gold" : "neutral"}>
                      {g.rol === "admin" ? "Admin" : "Jugador"}
                    </Badge>
                    {esActivo && <Badge variant="primary">Viendo ahora</Badge>}
                    <ActionForm action={salirDelGrupo} className="flex items-center gap-1.5">
                      <input type="hidden" name="grupo_id" value={g.id} />
                      <ConfirmSubmitButton
                        confirmMessage={`¿Salir de ${g.nombre}? Para volver vas a necesitar un link de invitación.`}
                        className="px-1.5 text-xs text-zinc-500 transition hover:text-danger-400"
                      >
                        Salir del grupo
                      </ConfirmSubmitButton>
                    </ActionForm>
                  </div>
                </div>
                {!esActivo && (
                  <form action={cambiarGrupo} className="shrink-0">
                    <input type="hidden" name="grupo_id" value={g.id} />
                    <SubmitButton pendingText="Entrando..." size="sm">
                      Entrar <IconChevronRight className="-mr-1 h-4 w-4" />
                    </SubmitButton>
                  </form>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {solicitudes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-gold-400">Esperando aprobación</p>
          <Card className="divide-y divide-border overflow-hidden py-1">
            {solicitudes.map((s) => (
              <div key={s.grupo_id} className="flex items-center gap-3 px-4 py-3">
                <GrupoLogo src={s.grupos?.logo_url} nombre={s.grupos?.nombre ?? "?"} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{s.grupos?.nombre ?? "Grupo"}</p>
                  <p className="text-xs text-zinc-500">
                    Le avisamos al admin. Cuando te acepte te llega una notificación.
                  </p>
                </div>
                <ActionForm action={cancelarSolicitud} className="flex shrink-0 flex-col items-end gap-1">
                  <input type="hidden" name="grupo_id" value={s.grupo_id} />
                  <ConfirmSubmitButton
                    confirmMessage="¿Cancelar el pedido para entrar a este grupo?"
                    className={buttonClass("ghost", "sm", "!px-2 !py-0.5 text-xs")}
                  >
                    Cancelar
                  </ConfirmSubmitButton>
                </ActionForm>
              </div>
            ))}
          </Card>
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-1 font-bold text-white">Sumarme a un grupo</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Pedile el link de invitación al admin del grupo. Si ya lo abriste, no hace falta esto.
        </p>
        <ActionForm action={unirseGrupo} className="flex flex-col gap-3">
          <Label>
            Link o código de invitación
            <Input type="text" name="codigo" required placeholder="https://.../unirse/abc123" />
          </Label>
          <SubmitButton pendingText="Sumándote..." size="sm" className="self-start">
            Sumarme
          </SubmitButton>
        </ActionForm>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-bold text-white">Crear un grupo</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Quedás como admin: cargás los partidos e invitás al resto con un link.
        </p>
        <ActionForm action={crearGrupo} className="flex flex-col gap-4">
          <Label>
            Nombre del grupo
            <Input type="text" name="nombre" required maxLength={60} placeholder="Fútbol de los jueves" />
          </Label>
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Reglas</p>
            <ReglasFields inicial={CONFIG_DEFAULTS} />
            <label className="flex items-start gap-2.5 text-sm text-zinc-300">
              <input type="checkbox" name="requiere_aprobacion" className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500" />
              <span>
                Pedir aprobación para entrar
                <span className="block text-xs font-normal text-zinc-500">
                  Quien abra el link de invitación queda pendiente hasta que lo aceptes.
                </span>
              </span>
            </label>
            <p className="text-xs text-zinc-500">Todo esto se puede cambiar después desde Admin.</p>
          </div>
          <SubmitButton pendingText="Creando..." size="sm" className="self-start">
            Crear grupo
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
