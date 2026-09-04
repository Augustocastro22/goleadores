import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setGoles, setGolesOtros, setGolesRival } from "@/lib/actions/partidos";
import { votar } from "@/lib/actions/votos";
import { votacionCerrada } from "@/lib/votacion";
import type { EstadoVotacion, Profile } from "@/lib/types";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { IconChevronRight, IconGoal } from "@/components/icons";

interface ParticipanteRow {
  jugador_id: string;
  goles: number;
  equipo: 1 | 2;
  profiles: Profile;
}

export default async function PartidoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: partido } = await supabase
    .from("partidos")
    .select("*")
    .eq("id", id)
    .single();
  if (!partido) notFound();

  const { data: miPerfil } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  const isAdmin = miPerfil?.rol === "admin";

  const { data: participantesRaw } = await supabase
    .from("partido_jugadores")
    .select("jugador_id, goles, equipo, profiles(*)")
    .eq("partido_id", id);
  const participantes = (participantesRaw ?? []) as unknown as ParticipanteRow[];
  const equipo1 = participantes.filter((p) => p.equipo === 1);
  const equipo2 = participantes.filter((p) => p.equipo === 2);

  const soyParticipante = participantes.some((p) => p.jugador_id === user.id);

  const { data: misVotos } = await supabase
    .from("votos")
    .select("tipo")
    .eq("partido_id", id)
    .eq("jugador_que_vota_id", user.id);

  const yaVoteMvp = (misVotos ?? []).some((v) => v.tipo === "MVP");
  const yaVotePeor = (misVotos ?? []).some((v) => v.tipo === "PEOR");
  const candidatos = participantes.filter((p) => p.jugador_id !== user.id);

  const { data: estadoVotacion } = await supabase
    .rpc("get_estado_votacion", { p_partido_id: id })
    .single<EstadoVotacion>();
  const totalParticipantes = estadoVotacion?.total_participantes ?? participantes.length;
  const votosMvp = estadoVotacion?.votos_mvp ?? 0;
  const votosPeor = estadoVotacion?.votos_peor ?? 0;
  const cerrada = votacionCerrada({
    fechaPartido: partido.fecha,
    totalParticipantes,
    votosMvp,
    votosPeor,
  });

  const golesEquipo1 = equipo1.reduce((total, p) => total + p.goles, 0) + partido.goles_otros;
  const golesEquipo2 = equipo2.reduce((total, p) => total + p.goles, 0) + partido.goles_rival;

  const fecha = new Date(partido.fecha + "T00:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-8">
      <Card className="p-6">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500">
          <span className="truncate capitalize">{fecha}</span>
          <span className="truncate">{partido.lugar}</span>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 sm:gap-6">
          <p className="flex-1 truncate text-right text-sm font-semibold text-zinc-300 sm:text-base">
            Nosotros
          </p>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-white/5 px-5 py-2.5">
            <span className="text-3xl font-extrabold tabular-nums text-white">{golesEquipo1}</span>
            <span className="text-lg font-bold text-zinc-600">–</span>
            <span className="text-3xl font-extrabold tabular-nums text-white">{golesEquipo2}</span>
          </div>
          <p className="flex-1 truncate text-left text-sm font-semibold text-zinc-300 sm:text-base">
            {partido.rival}
          </p>
        </div>
      </Card>

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <IconGoal className="h-5 w-5 text-primary-400" /> Goles · Equipo 1 (Nosotros)
          </h2>
          <Card className="divide-y divide-border overflow-hidden py-1">
            {equipo1.map((p) => (
              <GolRow key={p.jugador_id} p={p} isAdmin={isAdmin} partidoId={id} />
            ))}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-zinc-500">
                Invitados no registrados{" "}
                <span className="text-zinc-600">(no cuentan para la tabla)</span>
              </span>
              {isAdmin ? (
                <GolForm
                  action={setGolesOtros}
                  hidden={{ partido_id: id }}
                  fieldName="goles_otros"
                  defaultValue={partido.goles_otros}
                />
              ) : (
                <span className="text-lg font-bold tabular-nums text-white">
                  {partido.goles_otros}
                </span>
              )}
            </div>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <IconGoal className="h-5 w-5 text-gold-400" /> Goles · Equipo 2 ({partido.rival})
          </h2>
          <Card className="divide-y divide-border overflow-hidden py-1">
            {equipo2.length === 0 && (
              <p className="px-4 py-3 text-sm text-zinc-500">Ningún jugador del grupo jugó acá.</p>
            )}
            {equipo2.map((p) => (
              <GolRow key={p.jugador_id} p={p} isAdmin={isAdmin} partidoId={id} />
            ))}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-zinc-500">
                Invitados no registrados{" "}
                <span className="text-zinc-600">(no cuentan para la tabla)</span>
              </span>
              {isAdmin ? (
                <GolForm
                  action={setGolesRival}
                  hidden={{ partido_id: id }}
                  fieldName="goles_rival"
                  defaultValue={partido.goles_rival}
                />
              ) : (
                <span className="text-lg font-bold tabular-nums text-white">
                  {partido.goles_rival}
                </span>
              )}
            </div>
          </Card>
        </div>
      </section>

      {soyParticipante && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">Votación</h2>
          {cerrada ? (
            <Card className="px-4 py-3 text-sm text-zinc-500">
              La votación de este partido está cerrada.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-zinc-500">
                {votosMvp}/{totalParticipantes} votaron Mejor Jugador ·{" "}
                {votosPeor}/{totalParticipantes} votaron Peor Jugador
              </p>
              <VotacionForm
                partidoId={id}
                candidatos={candidatos}
                yaVoteMvp={yaVoteMvp}
                yaVotePeor={yaVotePeor}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function GolRow({
  p,
  isAdmin,
  partidoId,
}: {
  p: ParticipanteRow;
  isAdmin: boolean;
  partidoId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={p.profiles.foto_url} alt={p.profiles.apodo} size={32} />
        <span className="truncate text-sm text-zinc-200">
          {p.profiles.nombre} {p.profiles.apellido}{" "}
          <span className="text-zinc-500">({p.profiles.apodo})</span>
        </span>
      </div>
      {isAdmin ? (
        <GolForm
          action={setGoles}
          hidden={{ partido_id: partidoId, jugador_id: p.jugador_id }}
          fieldName="goles"
          defaultValue={p.goles}
        />
      ) : (
        <span className="text-lg font-bold tabular-nums text-white">{p.goles}</span>
      )}
    </div>
  );
}

function GolForm({
  action,
  hidden,
  fieldName,
  defaultValue,
}: {
  action: (formData: FormData) => Promise<unknown>;
  hidden: Record<string, string>;
  fieldName: string;
  defaultValue: number;
}) {
  return (
    <form
      action={async (formData) => {
        "use server";
        await action(formData);
      }}
      className="flex shrink-0 items-center gap-2"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input
        type="number"
        name={fieldName}
        min={0}
        defaultValue={defaultValue}
        className="w-14 rounded-lg border border-border bg-white/5 px-2 py-1.5 text-center text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
      />
      <button
        type="submit"
        className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
      >
        OK
      </button>
    </form>
  );
}

function VotacionForm({
  partidoId,
  candidatos,
  yaVoteMvp,
  yaVotePeor,
}: {
  partidoId: string;
  candidatos: ParticipanteRow[];
  yaVoteMvp: boolean;
  yaVotePeor: boolean;
}) {
  if (yaVoteMvp && yaVotePeor) {
    return (
      <Card className="px-4 py-3 text-sm text-zinc-500">Ya votaste en este partido.</Card>
    );
  }

  if (candidatos.length === 0) {
    return null;
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <form
        action={async (formData) => {
          "use server";
          const mvpId = String(formData.get("mvp_jugador_id") ?? "");
          const peorId = String(formData.get("peor_jugador_id") ?? "");

          if (mvpId) {
            const votoMvp = new FormData();
            votoMvp.set("partido_id", partidoId);
            votoMvp.set("tipo", "MVP");
            votoMvp.set("jugador_votado_id", mvpId);
            await votar(votoMvp);
          }

          if (peorId) {
            const votoPeor = new FormData();
            votoPeor.set("partido_id", partidoId);
            votoPeor.set("tipo", "PEOR");
            votoPeor.set("jugador_votado_id", peorId);
            await votar(votoPeor);
          }
        }}
        className="flex flex-col gap-4"
      >
        {yaVoteMvp ? (
          <p className="text-sm text-zinc-500">Ya votaste Mejor Jugador en este partido.</p>
        ) : (
          <VotoSelect label="Mejor Jugador" name="mvp_jugador_id" candidatos={candidatos} />
        )}
        {yaVotePeor ? (
          <p className="text-sm text-zinc-500">Ya votaste Peor Jugador en este partido.</p>
        ) : (
          <VotoSelect label="Peor Jugador" name="peor_jugador_id" candidatos={candidatos} />
        )}
        <Button type="submit" size="sm" className="self-start">
          Votar
        </Button>
      </form>
    </Card>
  );
}

function VotoSelect({
  label,
  name,
  candidatos,
}: {
  label: string;
  name: string;
  candidatos: ParticipanteRow[];
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <label className="text-sm font-semibold text-zinc-300 sm:w-32 sm:shrink-0">{label}</label>
      <div className="relative flex-1">
        <select
          name={name}
          required
          defaultValue=""
          className="w-full appearance-none rounded-xl border border-border bg-white/5 py-2.5 pr-9 pl-3.5 text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
        >
          <option value="" disabled className="bg-surface">
            Elegí un jugador...
          </option>
          {candidatos.map((c) => (
            <option key={c.jugador_id} value={c.jugador_id} className="bg-surface">
              {c.profiles.nombre} {c.profiles.apellido} ({c.profiles.apodo})
            </option>
          ))}
        </select>
        <IconChevronRight className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 rotate-90 text-zinc-500" />
      </div>
    </div>
  );
}
