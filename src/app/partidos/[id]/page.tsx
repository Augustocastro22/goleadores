import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deletePartido } from "@/lib/actions/partidos";
import { votar } from "@/lib/actions/votos";
import { votacionCerrada } from "@/lib/votacion";
import type { EstadoVotacion, Profile, RankingRow } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { IconChevronRight } from "@/components/icons";
import GolesEditor from "./GolesEditor";

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

  let ganadoresMvp: RankingRow[] = [];
  let ganadoresPeor: RankingRow[] = [];
  if (cerrada) {
    const [mvpRes, peorRes] = await Promise.all([
      supabase.rpc("get_ganadores_votacion", { p_partido_id: id, p_tipo: "MVP" }),
      supabase.rpc("get_ganadores_votacion", { p_partido_id: id, p_tipo: "PEOR" }),
    ]);
    ganadoresMvp = (mvpRes.data ?? []) as RankingRow[];
    ganadoresPeor = (peorRes.data ?? []) as RankingRow[];
  }

  const fecha = new Date(partido.fecha + "T00:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const toJugador = (p: ParticipanteRow) => ({
    jugadorId: p.jugador_id,
    nombre: p.profiles.nombre,
    apellido: p.profiles.apellido,
    apodo: p.profiles.apodo,
    fotoUrl: p.profiles.foto_url,
    goles: p.goles,
  });

  return (
    <div className="flex flex-col gap-8">
      <GolesEditor
        partidoId={id}
        rival={partido.rival}
        fecha={fecha}
        lugar={partido.lugar}
        equipo1={equipo1.map(toJugador)}
        equipo2={equipo2.map(toJugador)}
        golesOtrosInit={partido.goles_otros}
        golesRivalInit={partido.goles_rival}
        isAdmin={isAdmin}
      />

      {soyParticipante && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">Votación</h2>
          {cerrada ? (
            <div className="flex flex-col gap-3">
              <GanadorCard label="Mejor Jugador" ganadores={ganadoresMvp} />
              <GanadorCard label="Peor Jugador" ganadores={ganadoresPeor} />
            </div>
          ) : (
            <VotacionForm
              partidoId={id}
              candidatos={candidatos}
              yaVoteMvp={yaVoteMvp}
              yaVotePeor={yaVotePeor}
            />
          )}
        </section>
      )}

      {isAdmin && (
        <section>
          <form
            action={async (formData) => {
              "use server";
              await deletePartido(formData);
            }}
          >
            <input type="hidden" name="partido_id" value={id} />
            <ConfirmSubmitButton
              confirmMessage="¿Seguro que querés borrar este partido? Se pierden los goles y los votos cargados."
              className="w-full rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-2.5 text-sm font-semibold text-danger-400 transition hover:bg-danger-500/20"
            >
              Eliminar partido
            </ConfirmSubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}

function GanadorCard({ label, ganadores }: { label: string; ganadores: RankingRow[] }) {
  if (ganadores.length === 0) {
    return (
      <Card className="px-4 py-3 text-sm text-zinc-500">
        {label}: nadie votó a tiempo en este partido.
      </Card>
    );
  }

  const nombres = ganadores
    .map((g) => `${g.nombre} ${g.apellido} (${g.apodo})`)
    .join(" y ");
  const votos = ganadores[0].votos ?? 0;

  return (
    <Card className="px-4 py-3 text-sm text-zinc-200">
      <span className="font-semibold text-white">{label}:</span> {nombres} — {votos}{" "}
      {votos === 1 ? "voto" : "votos"}
    </Card>
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
