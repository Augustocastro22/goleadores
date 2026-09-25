import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cambiarRol, editarPartido, guardarConfig } from "@/lib/actions/admin";
import { getConfig } from "@/lib/config";
import type { Partido, Profile } from "@/lib/types";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import { Input, Label } from "@/components/ui/Input";
import SubmitButton from "@/components/SubmitButton";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { buttonClass } from "@/components/ui/Button";
import { IconChevronRight } from "@/components/icons";
import AdminForm from "./AdminForm";

type Tab = "config" | "partidos" | "usuarios";

const TABS: { id: Tab; label: string }[] = [
  { id: "config", label: "Configuración" },
  { id: "partidos", label: "Partidos" },
  { id: "usuarios", label: "Usuarios" },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : "config";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (profile?.rol !== "admin") redirect("/partidos");

  return (
    <div>
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-white">Admin</h1>
      <p className="mb-4 text-sm text-zinc-500">Configuración de la app y datos de partidos y usuarios.</p>

      <div className="mb-5 inline-flex rounded-xl border border-border bg-white/5 p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.id ? "bg-primary-500/15 text-primary-400" : "text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "config" && <ConfigTab />}
      {tab === "partidos" && <PartidosTab />}
      {tab === "usuarios" && <UsuariosTab miId={user.id} />}
    </div>
  );
}

async function ConfigTab() {
  const supabase = await createClient();
  const config = await getConfig(supabase);

  return (
    <Card className="p-5">
      <AdminForm action={guardarConfig} className="flex flex-col gap-4">
        <Label>
          Mínimo de jugadores para votar Mejor y Peor
          <Input
            type="number"
            name="min_jugadores_votacion"
            min={0}
            max={50}
            required
            defaultValue={config.min_jugadores_votacion}
            className="max-w-28"
          />
          <span className="text-xs font-normal text-zinc-500">
            Si en un partido juegan menos, ese partido no tiene votación de Mejor y Peor Jugador.
            Cuentan los dos equipos. 0 = sin mínimo. Aplica a los partidos a los que todavía no se
            les cargaron los goles; los que ya tienen resultado no cambian.
          </span>
        </Label>
        <SubmitButton pendingText="Guardando..." size="sm" className="self-start">
          Guardar
        </SubmitButton>
      </AdminForm>
    </Card>
  );
}

type PartidoConCantidad = Partido & { partido_jugadores: { count: number }[] };

async function PartidosTab() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partidos")
    .select("*, partido_jugadores(count)")
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

              <AdminForm action={editarPartido} className="flex flex-col gap-3 border-t border-border px-4 py-4">
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
              </AdminForm>
            </details>
          </Card>
        );
      })}
    </div>
  );
}

async function UsuariosTab({ miId }: { miId: string }) {
  const supabase = await createClient();
  const [{ data: perfilesData }, { data: authData }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).returns<Profile[]>(),
    // El email y el último ingreso están en auth.users, que solo se lee con la service role.
    createAdminClient().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const perfiles = perfilesData ?? [];
  const authPorId = new Map((authData?.users ?? []).map((u) => [u.id, u]));

  const formatear = (iso: string | undefined) =>
    iso
      ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
      : "nunca";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-zinc-500">
        {perfiles.length} {perfiles.length === 1 ? "usuario registrado" : "usuarios registrados"}.
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
                  <AdminForm action={cambiarRol} className="flex flex-col items-end gap-1">
                    <input type="hidden" name="jugador_id" value={j.id} />
                    <input type="hidden" name="rol" value={esAdmin ? "jugador" : "admin"} />
                    <ConfirmSubmitButton
                      confirmMessage={
                        esAdmin
                          ? `¿Sacarle el rol de admin a ${j.apodo}?`
                          : `¿Hacer admin a ${j.apodo}? Va a poder cargar partidos y cambiar la configuración.`
                      }
                      className={buttonClass("ghost", "sm", "!px-2 !py-0.5 text-xs")}
                    >
                      {esAdmin ? "Quitar admin" : "Hacer admin"}
                    </ConfirmSubmitButton>
                  </AdminForm>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
