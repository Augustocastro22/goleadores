import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deletePartido } from "@/lib/actions/partidos";
import { votar, votarDesempate } from "@/lib/actions/votos";
import { votacionCerrada } from "@/lib/votacion";
import type { Desempate, EstadoVotacion, Profile, RankingRow } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { IconChevronRight } from "@/components/icons";
import GolesEditor from "./GolesEditor";
import ConvocadosEditor from "./ConvocadosEditor";

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
  const jugadorPorId = new Map(participantes.map((p) => [p.jugador_id, p.profiles]));

  let todosLosJugadores: Profile[] = [];
  if (isAdmin && !partido.jugado) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("nombre")
      .returns<Profile[]>();
    todosLosJugadores = data ?? [];
  }

  const { data: misVotos } = await supabase
    .from("votos")
    .select("tipo")
    .eq("partido_id", id)
    .eq("jugador_que_vota_id", user.id);

  const yaVoteMvp = (misVotos ?? []).some((v) => v.tipo === "MVP");
  const yaVotePeor = (misVotos ?? []).some((v) => v.tipo === "PEOR");
  const candidatos = participantes.filter((p) => p.jugador_id !== user.id);

  let cerrada = false;
  let desgloseMvp: RankingRow[] = [];
  let desglosePeor: RankingRow[] = [];
  let desempates: Desempate[] = [];
  let misVotosDesempate: string[] = [];
  if (partido.jugado) {
    const { data: estadoVotacion } = await supabase
      .rpc("get_estado_votacion", { p_partido_id: id })
      .single<EstadoVotacion>();
    const totalParticipantes = estadoVotacion?.total_participantes ?? participantes.length;
    const votosMvp = estadoVotacion?.votos_mvp ?? 0;
    const votosPeor = estadoVotacion?.votos_peor ?? 0;
    cerrada = votacionCerrada({
      fechaPartido: partido.fecha,
      totalParticipantes,
      votosMvp,
      votosPeor,
    });

    if (cerrada) {
      const [mvpRes, peorRes, desempatesRes] = await Promise.all([
        supabase.rpc("get_desglose_votos", { p_partido_id: id, p_tipo: "MVP" }),
        supabase.rpc("get_desglose_votos", { p_partido_id: id, p_tipo: "PEOR" }),
        supabase.from("desempates").select("*").eq("partido_id", id).returns<Desempate[]>(),
      ]);
      desgloseMvp = (mvpRes.data ?? []) as RankingRow[];
      desglosePeor = (peorRes.data ?? []) as RankingRow[];
      desempates = desempatesRes.data ?? [];

      const pendientes = desempates.filter((d) => !d.resuelto);
      if (pendientes.length > 0) {
        const { data: misVotosDesempateRaw } = await supabase
          .from("desempate_votos")
          .select("desempate_id")
          .eq("jugador_que_vota_id", user.id)
          .in(
            "desempate_id",
            pendientes.map((d) => d.id)
          );
        misVotosDesempate = (misVotosDesempateRaw ?? []).map((v) => v.desempate_id);
      }
    }
  }

  const fecha =
    new Date(partido.fecha + "T00:00:00").toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }) + (partido.hora ? ` · ${partido.hora.slice(0, 5)}hs` : "");

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
      {isAdmin && !partido.jugado && (
        <ConvocadosEditor
          partidoId={id}
          jugadores={todosLosJugadores}
          equipo1IdsInit={equipo1.map((p) => p.jugador_id)}
          equipo2IdsInit={equipo2.map((p) => p.jugador_id)}
        />
      )}

      {partido.jugado || isAdmin ? (
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
      ) : (
        <EventoProgramado
          rival={partido.rival}
          fecha={fecha}
          lugar={partido.lugar}
          equipo1={equipo1}
          equipo2={equipo2}
        />
      )}

      {soyParticipante && partido.jugado && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">Votación</h2>
          {cerrada ? (
            <div className="flex flex-col gap-3">
              <DesgloseVotos label="Mejor Jugador" filas={desgloseMvp} />
              <DesempateInfo
                desempate={desempates.find((d) => d.tipo === "MVP") ?? null}
                yaVote={misVotosDesempate}
                miId={user.id}
                jugadorPorId={jugadorPorId}
              />
              <DesgloseVotos label="Peor Jugador" filas={desglosePeor} />
              <DesempateInfo
                desempate={desempates.find((d) => d.tipo === "PEOR") ?? null}
                yaVote={misVotosDesempate}
                miId={user.id}
                jugadorPorId={jugadorPorId}
              />
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

function EventoProgramado({
  rival,
  fecha,
  lugar,
  equipo1,
  equipo2,
}: {
  rival: string;
  fecha: string;
  lugar: string;
  equipo1: ParticipanteRow[];
  equipo2: ParticipanteRow[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500">
          <span className="truncate capitalize">{fecha}</span>
          <span className="truncate">{lugar}</span>
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Badge>Partido programado</Badge>
          <p className="text-lg font-bold text-white">vs {rival}</p>
        </div>
      </Card>

      <ConvocadosList titulo="Convocados · Equipo 1 (Nosotros)" jugadores={equipo1} />
      {equipo2.length > 0 && (
        <ConvocadosList titulo={`Convocados · Equipo 2 (${rival})`} jugadores={equipo2} />
      )}
    </div>
  );
}

function ConvocadosList({ titulo, jugadores }: { titulo: string; jugadores: ParticipanteRow[] }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-white">{titulo}</h2>
      <Card className="divide-y divide-border overflow-hidden py-1">
        {jugadores.map((p) => (
          <div key={p.jugador_id} className="flex items-center gap-3 px-4 py-3">
            <Avatar src={p.profiles.foto_url} alt={p.profiles.apodo} size={32} />
            <span className="truncate text-sm text-zinc-200">
              {p.profiles.nombre} {p.profiles.apellido}{" "}
              <span className="text-zinc-500">({p.profiles.apodo})</span>
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function DesgloseVotos({ label, filas }: { label: string; filas: RankingRow[] }) {
  if (filas.length === 0) {
    return (
      <Card className="px-4 py-3 text-sm text-zinc-500">
        {label}: nadie votó a tiempo en este partido.
      </Card>
    );
  }

  const maxVotos = filas[0].votos ?? 0;

  return (
    <Card className="p-4">
      <p className="mb-2 text-sm font-semibold text-white">{label}</p>
      <div className="flex flex-col gap-1.5">
        {filas.map((f) => {
          const esGanador = (f.votos ?? 0) === maxVotos;
          return (
            <div key={f.jugador_id} className="flex items-center justify-between gap-3 text-sm">
              <span className={esGanador ? "font-semibold text-white" : "text-zinc-400"}>
                {f.nombre} {f.apellido} <span className="text-zinc-500">({f.apodo})</span>
              </span>
              <span
                className={`shrink-0 font-bold tabular-nums ${esGanador ? "text-primary-400" : "text-zinc-500"}`}
              >
                {f.votos}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DesempateInfo({
  desempate,
  yaVote,
  miId,
  jugadorPorId,
}: {
  desempate: Desempate | null;
  yaVote: string[];
  miId: string;
  jugadorPorId: Map<string, Profile>;
}) {
  if (!desempate) return null;

  const nombreDe = (id: string) => {
    const j = jugadorPorId.get(id);
    return j ? j.apodo : "?";
  };
  const nombresEmpatados = desempate.candidatos.map(nombreDe).join(" y ");

  if (desempate.resuelto) {
    return (
      <Card className="px-4 py-3 text-sm text-zinc-400">
        Empate entre {nombresEmpatados}: se definió por revotación y ganó{" "}
        <span className="font-semibold text-white">
          {desempate.ganador_id ? nombreDe(desempate.ganador_id) : "nadie (quedó sin resolver)"}
        </span>
        .
      </Card>
    );
  }

  const puedoDefinir = desempate.elegibles.includes(miId) && !yaVote.includes(desempate.id);

  if (!puedoDefinir) {
    return (
      <Card className="px-4 py-3 text-sm text-zinc-500">
        Empate entre {nombresEmpatados}: todavía falta que lo definan.
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm text-zinc-300">
        Empate entre {nombresEmpatados}. Como no votaste a ninguno de los dos, tu voto define quién
        gana.
      </p>
      <form
        action={async (formData) => {
          "use server";
          await votarDesempate(formData);
        }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="desempate_id" value={desempate.id} />
        <div className="relative flex-1">
          <select
            name="jugador_votado_id"
            required
            defaultValue=""
            className="w-full appearance-none rounded-xl border border-border bg-white/5 py-2.5 pr-9 pl-3.5 text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
          >
            <option value="" disabled className="bg-surface">
              Elegí un jugador...
            </option>
            {desempate.candidatos.map((cid) => (
              <option key={cid} value={cid} className="bg-surface">
                {nombreDe(cid)}
              </option>
            ))}
          </select>
          <IconChevronRight className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 rotate-90 text-zinc-500" />
        </div>
        <Button type="submit" size="sm">
          Definir
        </Button>
      </form>
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
