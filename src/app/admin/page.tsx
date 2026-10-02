import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  aceptarSolicitud,
  cambiarRol,
  editarPartido,
  guardarConfig,
  guardarGrupo,
  rechazarSolicitud,
  regenerarInvitacion,
  sacarDelGrupo,
} from "@/lib/actions/admin";
import { getConfig } from "@/lib/config";
import { getContexto, getMiembros, type MiGrupo } from "@/lib/grupo";
import { getSiteUrl } from "@/lib/site-url";
import type { Partido, Profile } from "@/lib/types";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import { Input, Label } from "@/components/ui/Input";
import SubmitButton from "@/components/SubmitButton";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { buttonClass } from "@/components/ui/Button";
import { IconChevronRight } from "@/components/icons";
import ActionForm from "@/components/ActionForm";
import ReglasFields from "@/components/ReglasFields";
import InvitacionLink from "./InvitacionLink";
import LogoUploader from "./LogoUploader";

type Tab = "grupo" | "config" | "partidos" | "usuarios";

const TABS: { id: Tab; label: string }[] = [
  { id: "grupo", label: "Grupo" },
  { id: "config", label: "Reglas" },
  { id: "partidos", label: "Partidos" },
  { id: "usuarios", label: "Miembros" },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : "grupo";

  const { supabase, user, grupo } = await getContexto();
  if (!user) redirect("/login");
  if (!grupo) redirect("/grupos");
  if (grupo.rol !== "admin") redirect("/partidos");

  const { count: solicitudesPendientes } = await supabase
    .from("grupo_solicitudes")
    .select("jugador_id", { count: "exact", head: true })
    .eq("grupo_id", grupo.id);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-white">Admin</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Invitaciones, reglas, partidos y miembros de <span className="text-zinc-300">{grupo.nombre}</span>.
      </p>

      <div className="no-scrollbar mb-5 flex max-w-full overflow-x-auto rounded-xl border border-border bg-white/5 p-1 sm:inline-flex">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.id ? "bg-primary-500/15 text-primary-400" : "text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
            {t.id === "usuarios" && (solicitudesPendientes ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-gold-500/20 px-1.5 py-0.5 text-[11px] text-gold-400">
                {solicitudesPendientes}
              </span>
            )}
          </Link>
        ))}
      </div>

      {tab === "grupo" && <GrupoTab grupo={grupo} />}
      {tab === "config" && <ConfigTab grupoId={grupo.id} />}
      {tab === "partidos" && <PartidosTab grupoId={grupo.id} />}
      {tab === "usuarios" && <UsuariosTab grupoId={grupo.id} miId={user.id} />}
    </div>
  );
}

async function GrupoTab({ grupo }: { grupo: MiGrupo }) {
  const url = `${await getSiteUrl()}/unirse/${grupo.codigo_invitacion}`;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h2 className="mb-1 font-bold text-white">Invitar al grupo</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Mandá este link por WhatsApp. Quien lo abra se registra (o entra) y queda como jugador
          del grupo.
        </p>
        <InvitacionLink url={url} nombreGrupo={grupo.nombre} />
        <ActionForm action={regenerarInvitacion} className="mt-3 flex flex-col gap-1">
          <ConfirmSubmitButton
            confirmMessage="¿Generar un link nuevo? El link actual deja de funcionar (los que ya se sumaron siguen en el grupo)."
            confirmLabel="Generar"
            className={buttonClass("ghost", "sm", "self-start !px-2 text-xs")}
          >
            Generar link nuevo
          </ConfirmSubmitButton>
        </ActionForm>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-bold text-white">Escudo</h2>
        <LogoUploader nombre={grupo.nombre} logoInicial={grupo.logo_url} />
      </Card>

      <Card className="p-5">
        <ActionForm action={guardarGrupo} className="flex flex-col gap-4">
          <Label>
            Nombre del grupo
            <Input type="text" name="nombre" required maxLength={60} defaultValue={grupo.nombre} />
          </Label>
          <label className="flex items-start gap-2.5 text-sm text-zinc-300">
            <input
              type="checkbox"
              name="requiere_aprobacion"
              defaultChecked={grupo.requiere_aprobacion}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500"
            />
            <span>
              Pedir aprobación para entrar
              <span className="block text-xs font-normal text-zinc-500">
                Quien abra el link queda pendiente hasta que un admin lo acepte en Miembros. Sirve
                si el link se reenvía a gente que no es del grupo.
              </span>
            </span>
          </label>
          <SubmitButton pendingText="Guardando..." size="sm" className="self-start">
            Guardar
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}

async function ConfigTab({ grupoId }: { grupoId: string }) {
  const { supabase } = await getContexto();
  const config = await getConfig(supabase, grupoId);

  return (
    <Card className="p-5">
      <ActionForm action={guardarConfig} className="flex flex-col gap-4">
        <ReglasFields inicial={config} />
        <p className="text-xs text-zinc-500">
          Los cambios aplican a los partidos a los que todavía no se les cargaron los goles; los
          que ya tienen resultado (y sus votos) no cambian.
        </p>
        <SubmitButton pendingText="Guardando..." size="sm" className="self-start">
          Guardar
        </SubmitButton>
      </ActionForm>
    </Card>
  );
}

type PartidoConCantidad = Partido & { partido_jugadores: { count: number }[] };

async function PartidosTab({ grupoId }: { grupoId: string }) {
  const { supabase } = await getContexto();
  const { data } = await supabase
    .from("partidos")
    .select("*, partido_jugadores(count)")
    .eq("grupo_id", grupoId)
    .order("fecha", { ascending: false })
    .returns<PartidoConCantidad[]>();
  const partidos = data ?? [];

  if (partidos.length === 0) {
    return <Card className="px-4 py-3 text-sm text-zinc-500">Todavía no hay partidos.</Card>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-zinc-500">Tocá un partido para editar fecha, hora, lugar o rival.</p>
      {partidos.map((p) => {
        const cantidad = p.partido_jugadores[0]?.count ?? 0;
        const fecha = new Date(p.fecha + "T00:00:00").toLocaleDateString("es-AR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        return (
          <Card key={p.id} className="overflow-hidden">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">vs {p.rival}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {fecha}
                    {p.hora ? ` · ${p.hora.slice(0, 5)}hs` : ""} · {p.lugar} · {cantidad}{" "}
                    {cantidad === 1 ? "jugador" : "jugadores"}
                  </p>
                </div>
                {!p.jugado ? (
                  <Badge>Programado</Badge>
                ) : p.con_votacion ? (
                  <Badge variant="primary">Jugado</Badge>
                ) : (
                  <Badge variant="gold">Sin votación</Badge>
                )}
                <IconChevronRight className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-90" />
              </summary>

              <ActionForm action={editarPartido} className="flex flex-col gap-3 border-t border-border px-4 py-4">
                <input type="hidden" name="partido_id" value={p.id} />
                <div className="flex gap-3">
                  <Label className="flex-1">
                    Fecha
                    <Input type="date" name="fecha" required defaultValue={p.fecha} />
                  </Label>
                  <Label className="w-28 shrink-0">
                    Hora
                    <Input type="time" name="hora" defaultValue={p.hora?.slice(0, 5) ?? ""} />
                  </Label>
                </div>
                <Label>
                  Lugar
                  <Input type="text" name="lugar" required defaultValue={p.lugar} />
                </Label>
                <Label>
                  Rival / nombre del Equipo 2
                  <Input type="text" name="rival" required defaultValue={p.rival} />
                </Label>
                {!p.jugado && (
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" name="avisar" defaultChecked className="h-4 w-4 accent-primary-500" />
                    Avisar a los convocados si cambia la fecha o la hora
                  </label>
                )}
                <div className="flex items-center gap-3">
                  <SubmitButton pendingText="Guardando..." size="sm">
                    Guardar
                  </SubmitButton>
                  <Link
                    href={`/partidos/${p.id}`}
                    className="text-sm font-medium text-zinc-400 transition hover:text-white"
                  >
                    Ver partido
                  </Link>
                </div>
              </ActionForm>
            </details>
          </Card>
        );
      })}
    </div>
  );
}

async function UsuariosTab({ grupoId, miId }: { grupoId: string; miId: string }) {
  const { supabase } = await getContexto();
  const perfiles = await getMiembros(supabase, grupoId);
  // El email y el último ingreso están en auth.users, que solo se lee con la
  // service role: se piden uno por uno solo los de este grupo (nunca se
  // listan los usuarios de otros grupos).
  const admin = createAdminClient();
  const authUsers = await Promise.all(
    perfiles.map(async (p) => (await admin.auth.admin.getUserById(p.id)).data.user)
  );
  const authPorId = new Map(authUsers.filter((u) => u !== null).map((u) => [u.id, u]));

  const { data: solicitudesRaw } = await supabase
    .from("grupo_solicitudes")
    .select("created_at, profiles(*)")
    .eq("grupo_id", grupoId)
    .order("created_at");
  const solicitudes = ((solicitudesRaw ?? []) as unknown as {
    created_at: string;
    profiles: Profile | null;
  }[]).filter((s) => s.profiles);

  const formatear = (iso: string | undefined) =>
    iso
      ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
      : "nunca";

  return (
    <div className="flex flex-col gap-2">
      {solicitudes.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gold-400">
            {solicitudes.length === 1 ? "1 persona quiere" : `${solicitudes.length} personas quieren`}{" "}
            entrar al grupo
          </p>
          <Card className="mb-4 divide-y divide-border overflow-hidden py-1">
            {solicitudes.map(({ created_at, profiles: j }) => (
              <div key={j!.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar src={j!.foto_url} alt={j!.apodo} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">
                    {j!.nombre} {j!.apellido} <span className="text-zinc-500">({j!.apodo})</span>
                  </p>
                  <p className="truncate text-xs text-zinc-600">Pidió entrar el {formatear(created_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <ActionForm action={rechazarSolicitud} className="flex flex-col items-end">
                    <input type="hidden" name="jugador_id" value={j!.id} />
                    <ConfirmSubmitButton
                      confirmMessage={`¿Rechazar a ${j!.apodo}?`}
                      confirmLabel="Rechazar"
                      className={buttonClass("ghost", "sm", "!px-2 text-xs")}
                    >
                      Rechazar
                    </ConfirmSubmitButton>
                  </ActionForm>
                  <ActionForm action={aceptarSolicitud} className="flex flex-col items-end">
                    <input type="hidden" name="jugador_id" value={j!.id} />
                    <SubmitButton pendingText="..." size="sm">
                      Aceptar
                    </SubmitButton>
                  </ActionForm>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
      <p className="text-xs text-zinc-500">
        {perfiles.length} {perfiles.length === 1 ? "miembro" : "miembros"}.
      </p>
      <Card className="divide-y divide-border overflow-hidden py-1">
        {perfiles.map((j) => {
          const auth = authPorId.get(j.id);
          const esAdmin = j.rol === "admin";
          return (
            <div key={j.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar src={j.foto_url} alt={j.apodo} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-200">
                  {j.nombre} {j.apellido} <span className="text-zinc-500">({j.apodo})</span>
                </p>
                <p className="truncate text-xs text-zinc-500">{auth?.email ?? "sin email"}</p>
                <p className="truncate text-xs text-zinc-600">
                  Alta {formatear(j.created_at)} · Último ingreso {formatear(auth?.last_sign_in_at)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Badge variant={esAdmin ? "gold" : "neutral"}>{esAdmin ? "Admin" : "Jugador"}</Badge>
                {j.id !== miId && (
                  <ActionForm action={cambiarRol} className="flex flex-col items-end gap-1">
                    <input type="hidden" name="jugador_id" value={j.id} />
                    <input type="hidden" name="rol" value={esAdmin ? "jugador" : "admin"} />
                    <ConfirmSubmitButton
                      confirmMessage={
                        esAdmin
                          ? `¿Sacarle el rol de admin a ${j.apodo}?`
                          : `¿Hacer admin a ${j.apodo}? Va a poder cargar partidos y cambiar la configuración.`
                      }
                      confirmLabel={esAdmin ? "Quitar admin" : "Hacer admin"}
                      className={buttonClass("ghost", "sm", "!px-2 !py-0.5 text-xs")}
                    >
                      {esAdmin ? "Quitar admin" : "Hacer admin"}
                    </ConfirmSubmitButton>
                  </ActionForm>
                )}
                {j.id !== miId && (
                  <ActionForm action={sacarDelGrupo} className="flex flex-col items-end gap-1">
                    <input type="hidden" name="jugador_id" value={j.id} />
                    <ConfirmSubmitButton
                      confirmMessage={`¿Sacar a ${j.apodo} del grupo? Sus partidos jugados quedan en el historial.`}
                      confirmLabel="Sacar"
                      className={buttonClass("ghost", "sm", "!px-2 !py-0.5 text-xs !text-danger-400")}
                    >
                      Sacar del grupo
                    </ConfirmSubmitButton>
                  </ActionForm>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
