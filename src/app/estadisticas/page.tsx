import { requireGrupo } from "@/lib/grupo";
import { getConfig, grupoVota } from "@/lib/config";
import { votacionCerrada } from "@/lib/votacion";
import type { EstadoVotacion, RankingRow } from "@/lib/types";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import { IconGoal, IconThumbsDown, IconTrophy } from "@/components/icons";
import { ComponentType, SVGProps } from "react";
import GrupoLogo from "@/components/ui/GrupoLogo";
import { historialDesafios, type DesafioVista, type HistorialRival } from "@/lib/desafios";
import { RESULTADO_CLASS, RESULTADO_PLURAL } from "@/lib/resultado";

export default async function EstadisticasPage() {
  const { supabase, grupo } = await requireGrupo();
  // Cada ranking de votos se muestra solo si el grupo vota esa categoría (los
  // votos de cuando sí votaba quedan guardados y vuelven si se reactiva).
  const [config, goleadores, mvp, peor, partidosRes, desafiosRes] = await Promise.all([
    getConfig(supabase, grupo.id),
    supabase.rpc("get_goleadores", { p_grupo_id: grupo.id }),
    supabase.rpc("get_ranking_votos", { p_grupo_id: grupo.id, p_tipo: "MVP" }),
    supabase.rpc("get_ranking_votos", { p_grupo_id: grupo.id, p_tipo: "PEOR" }),
    supabase
      .from("partidos")
      .select("id, fecha, con_mvp, con_peor")
      .eq("grupo_id", grupo.id)
      .eq("jugado", true)
      .eq("con_votacion", true)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.rpc("get_desafios", { p_grupo_id: grupo.id }),
  ]);
  const historial = historialDesafios((desafiosRes.data ?? []) as DesafioVista[]);
  const votacionActiva = grupoVota(config);

  // Estado de la votación de los últimos partidos, todos a la vez (no uno
  // por uno), para quedarse con el más reciente que ya cerró.
  const recientes = votacionActiva ? (partidosRes.data ?? []) : [];
  const cerrados = await Promise.all(
    recientes.map(async (partido) => {
      const { data: estado } = await supabase
        .rpc("get_estado_votacion", { p_partido_id: partido.id })
        .single<EstadoVotacion>();
      return votacionCerrada({
        fechaPartido: partido.fecha,
        totalParticipantes: estado?.total_participantes ?? 0,
        votosMvp: estado?.votos_mvp ?? 0,
        votosPeor: estado?.votos_peor ?? 0,
        conMvp: partido.con_mvp,
        conPeor: partido.con_peor,
      });
    })
  );
  const ultimoPartidoCerradoId = recientes.find((_, i) => cerrados[i])?.id ?? null;

  let ultimoMvp: RankingRow[] = [];
  let ultimoPeor: RankingRow[] = [];
  if (ultimoPartidoCerradoId) {
    const [ultimoMvpRes, ultimoPeorRes] = await Promise.all([
      supabase.rpc("get_ganadores_votacion", {
        p_partido_id: ultimoPartidoCerradoId,
        p_tipo: "MVP",
      }),
      supabase.rpc("get_ganadores_votacion", {
        p_partido_id: ultimoPartidoCerradoId,
        p_tipo: "PEOR",
      }),
    ]);
    ultimoMvp = (ultimoMvpRes.data ?? []) as RankingRow[];
    ultimoPeor = (ultimoPeorRes.data ?? []) as RankingRow[];
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-white">Estadísticas</h1>
      <RankingList
        titulo="Goleadores"
        icon={IconGoal}
        iconClassName="bg-primary-500/15 text-primary-400"
        rows={(goleadores.data ?? []) as RankingRow[]}
        valueKey="goles"
        valueLabel="Goles"
      />
      {config.vota_mvp && (
        <RankingList
          titulo="Mejor Jugador (MVP)"
          icon={IconTrophy}
          iconClassName="bg-gold-500/15 text-gold-400"
          rows={(mvp.data ?? []) as RankingRow[]}
          valueKey="veces_elegido"
          valueLabel="Veces"
          onlyLideres
          ultimoPartidoGanadores={ultimoMvp}
        />
      )}
      {config.vota_peor && (
        <RankingList
          titulo="Peor Jugador"
          icon={IconThumbsDown}
          iconClassName="bg-danger-500/15 text-danger-400"
          rows={(peor.data ?? []) as RankingRow[]}
          valueKey="veces_elegido"
          valueLabel="Veces"
          onlyLideres
          ultimoPartidoGanadores={ultimoPeor}
        />
      )}
      {historial.length > 0 && <HistorialDesafios filas={historial} />}
    </div>
  );
}

/** Contra cada grupo desafiado: G/E/P de los resultados verificados y los sin verificar. */
function HistorialDesafios({ filas }: { filas: HistorialRival[] }) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-bold text-white">Desafíos</h2>
      <p className="mb-3 text-xs text-zinc-500">
        Contra otros grupos. Los sin verificar (sin acuerdo en el resultado) no cuentan como ganados ni
        perdidos.
      </p>
      <Card className="divide-y divide-border overflow-hidden py-1">
        {filas.map((f) => (
          <div key={f.rivalNombre} className="flex items-center gap-3 px-4 py-3">
            <GrupoLogo src={f.rivalLogoUrl} nombre={f.rivalNombre} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">vs {f.rivalNombre}</p>
              {f.sinVerificar > 0 && <p className="text-xs text-zinc-500">{f.sinVerificar} sin verificar</p>}
            </div>
            <div className="flex shrink-0 gap-1.5">
              {(["G", "E", "P"] as const).map((r) => (
                <span
                  key={r}
                  className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums ${RESULTADO_CLASS[r]}`}
                  title={RESULTADO_PLURAL[r]}
                >
                  {r === "G" ? f.ganados : r === "E" ? f.empatados : f.perdidos}
                  {r}
                </span>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}

const rankBadge = [
  "bg-gold-500/20 text-gold-400",
  "bg-white/10 text-zinc-300",
  "bg-orange-500/15 text-orange-400",
];

function RankingList({
  titulo,
  icon: Icon,
  iconClassName,
  rows,
  valueKey,
  valueLabel,
  onlyLideres = false,
  ultimoPartidoGanadores,
}: {
  titulo: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName: string;
  rows: RankingRow[];
  valueKey: "goles" | "veces_elegido";
  valueLabel: string;
  onlyLideres?: boolean;
  ultimoPartidoGanadores?: RankingRow[];
}) {
  let ordenadas = [...rows]
    .filter((r) => (r[valueKey] ?? 0) > 0)
    .sort((a, b) => (b[valueKey] ?? 0) - (a[valueKey] ?? 0));

  if (onlyLideres && ordenadas.length > 0) {
    const max = ordenadas[0][valueKey] ?? 0;
    ordenadas = ordenadas.filter((r) => (r[valueKey] ?? 0) === max);
  }

  return (
    <section>
      <div className="mb-1 flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-white">{titulo}</h2>
          {onlyLideres && ordenadas.length > 0 && (
            <p className="text-xs text-zinc-500">
              {ordenadas.length > 1 ? "Líderes empatados" : "Líder actual"}
            </p>
          )}
        </div>
      </div>
      {ultimoPartidoGanadores && ultimoPartidoGanadores.length > 0 && (
        <p className="mb-3 pl-10 text-xs text-zinc-500">
          Último partido:{" "}
          <span className="text-zinc-400">
            {ultimoPartidoGanadores.map((g) => g.apodo).join(" y ")}
          </span>{" "}
          con {ultimoPartidoGanadores[0].votos}{" "}
          {ultimoPartidoGanadores[0].votos === 1 ? "voto" : "votos"}
        </p>
      )}
      {ordenadas.length === 0 ? (
        <Card className="px-5 py-8 text-center text-sm text-zinc-500">Todavía no hay datos.</Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden py-1">
          {ordenadas.map((row, i) => (
            <div key={row.jugador_id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  onlyLideres ? rankBadge[0] : (rankBadge[i] ?? "text-zinc-600")
                }`}
              >
                {onlyLideres ? 1 : i + 1}
              </span>
              <Avatar
                src={row.foto_url}
                alt={row.apodo}
                size={36}
                className={row.sigue_en_grupo === false ? "opacity-50 grayscale" : ""}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  {row.nombre} {row.apellido}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {row.apodo} · {row.partidos_jugados ?? 0}{" "}
                  {row.partidos_jugados === 1 ? "partido" : "partidos"}
                  {row.sigue_en_grupo === false && " · ya no está en el grupo"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-lg font-bold tabular-nums text-white">{row[valueKey]}</span>
                <span className="hidden text-xs text-zinc-600 sm:inline">{valueLabel}</span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
