import Link from "next/link";
import { requireGrupo } from "@/lib/grupo";
import type { Partido } from "@/lib/types";
import { calcularResultado, RESULTADO_CLASS, type Resultado } from "@/lib/resultado";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { IconChevronRight, IconPlus } from "@/components/icons";
import PushBanner from "@/components/PushBanner";
import { hoyArgentina } from "@/lib/confirmacion";
import { desafiosConGolesDeMas, esperaMiRespuesta, type DesafioVista } from "@/lib/desafios";

export default async function PartidosPage() {
  const { supabase, grupo } = await requireGrupo();

  const [{ data: partidos }, { data: desafiosRaw }] = await Promise.all([
    supabase
      .from("partidos")
      .select("*")
      .eq("grupo_id", grupo.id)
      .order("fecha", { ascending: false })
      .returns<Partido[]>(),
    supabase.rpc("get_desafios", { p_grupo_id: grupo.id }),
  ]);
  const hoy = hoyArgentina();
  const desafios = (desafiosRaw ?? []) as DesafioVista[];
  const desafiosParaResponder =
    grupo.rol === "admin" ? desafios.filter((d) => esperaMiRespuesta(d, hoy)).length : 0;
  const desafioPorPartido = new Map(desafios.filter((d) => d.partido_id).map((d) => [d.partido_id, d]));

  const resumenPorPartido = new Map<
    string,
    { golesEquipo1: number; golesEquipo2: number; resultado: Resultado }
  >();
  const golesPorEquipo = new Map<string, { e1: number; e2: number }>();
  if (partidos && partidos.length > 0) {
    const { data: pj } = await supabase
      .from("partido_jugadores")
      .select("partido_id, goles, equipo")
      .in(
        "partido_id",
        partidos.map((p) => p.id)
      );

    for (const row of pj ?? []) {
      const acc = golesPorEquipo.get(row.partido_id) ?? { e1: 0, e2: 0 };
      if (row.equipo === 1) acc.e1 += row.goles;
      else acc.e2 += row.goles;
      golesPorEquipo.set(row.partido_id, acc);
    }

    for (const partido of partidos) {
      if (!partido.jugado) continue;
      const acc = golesPorEquipo.get(partido.id) ?? { e1: 0, e2: 0 };
      const golesEquipo1 = acc.e1 + partido.goles_otros;
      const golesEquipo2 = acc.e2 + partido.goles_rival;
      resumenPorPartido.set(partido.id, {
        golesEquipo1,
        golesEquipo2,
        resultado: calcularResultado(golesEquipo1, golesEquipo2),
      });
    }
  }

  const conGolesDeMas = new Set(
    desafiosConGolesDeMas(
      desafios,
      new Map([...golesPorEquipo].map(([id, g]) => [id, g.e1]))
    ).map((d) => d.partido_id)
  );

  const resultados = [...resumenPorPartido.values()].map((r) => r.resultado);
  const ganados = resultados.filter((r) => r === "G").length;
  const empatados = resultados.filter((r) => r === "E").length;
  const perdidos = resultados.filter((r) => r === "P").length;

  return (
    <div>
      <PushBanner />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Partidos</h1>
        <div className="flex items-center gap-2">
          <Link href="/partidos/desafios" className={buttonClass("secondary", "sm")}>
            Desafíos
            {desafiosParaResponder > 0 && (
              <span className="rounded-full bg-gold-500/20 px-1.5 py-0.5 text-[11px] text-gold-400">
                {desafiosParaResponder}
              </span>
            )}
          </Link>
          {grupo.rol === "admin" && (
            <Link href="/partidos/nuevo" className={buttonClass("primary", "sm")}>
              <IconPlus className="h-4 w-4" /> Nuevo
            </Link>
          )}
        </div>
      </div>

      {!partidos || partidos.length === 0 ? (
        <Card className="px-5 py-10 text-center text-sm text-zinc-500">
          Todavía no hay partidos cargados.
          {grupo.rol === "admin" && (
            <span className="mt-1 block">
              Cargá el primero con <span className="text-zinc-300">+ Nuevo</span>, o invitá al
              resto del grupo desde Admin.
            </span>
          )}
        </Card>
      ) : (
        <>
          <Card className="mb-4 grid grid-cols-3 divide-x divide-border p-4 text-center">
            <ResumenStat value={ganados} label="Ganados" className="text-primary-400" />
            <ResumenStat value={empatados} label="Empatados" className="text-zinc-300" />
            <ResumenStat value={perdidos} label="Perdidos" className="text-danger-400" />
          </Card>

          <div className="flex flex-col gap-3">
            {partidos.map((partido) => {
              const fecha = new Date(partido.fecha + "T00:00:00");
              const resumen = resumenPorPartido.get(partido.id);
              return (
                <Link key={partido.id} href={`/partidos/${partido.id}`} className="block">
                  <Card className="flex items-center justify-between gap-4 px-4 py-4 transition hover:border-border-strong hover:bg-surface-2/80">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white/5 py-2">
                        <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                          {fecha.toLocaleDateString("es-AR", { month: "short" })}
                        </span>
                        <span className="text-lg font-bold text-white">{fecha.getDate()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">vs {partido.rival}</p>
                        <p className="truncate text-sm text-zinc-500">
                          {partido.desafio_id && (
                            <span className="font-medium text-gold-400">
                              {etiquetaDesafio(
                                desafioPorPartido.get(partido.id),
                                partido.jugado,
                                conGolesDeMas.has(partido.id)
                              )}{" "}
                              ·{" "}
                            </span>
                          )}
                          {partido.lugar}
                          {partido.hora && ` · ${partido.hora.slice(0, 5)}hs`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {resumen ? (
                        <>
                          <span className="text-sm font-bold tabular-nums text-white">
                            {resumen.golesEquipo1}-{resumen.golesEquipo2}
                          </span>
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${RESULTADO_CLASS[resumen.resultado]}`}
                          >
                            {resumen.resultado}
                          </span>
                        </>
                      ) : desafioPorPartido.get(partido.id)?.marcador_mios != null ? (
                        // Desafío con resultado pero sin los goles de los jugadores todavía
                        // (lo que falta se lee en la segunda línea, así no se corta el rival).
                        <span className="text-sm font-bold tabular-nums text-white">
                          {desafioPorPartido.get(partido.id)!.marcador_mios}-
                          {desafioPorPartido.get(partido.id)!.marcador_rival}
                        </span>
                      ) : desafioPorPartido.get(partido.id)?.estado === "suspendido" ? (
                        <Badge variant="gold">Suspendido</Badge>
                      ) : (
                        <Badge>Programado</Badge>
                      )}
                      <IconChevronRight className="h-5 w-5 text-zinc-600" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ResumenStat({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2">
      <span className={`text-2xl font-extrabold tabular-nums ${className}`}>{value}</span>
      <span className="text-[11px] text-zinc-500">{label}</span>
    </div>
  );
}

/**
 * "Desafío", o con lo que importa de un vistazo: suspendido, goles por
 * corregir, resultado a confirmar, faltan goles.
 */
function etiquetaDesafio(d: DesafioVista | undefined, jugado: boolean, golesDeMas: boolean) {
  if (d?.estado === "suspendido") return "Desafío suspendido";
  if (golesDeMas) return "Desafío · corregir goles";
  if (d?.resultado_estado === "en_discusion") return "Desafío · resultado a confirmar";
  const base = d?.resultado_estado === "sin_verificar" ? "Desafío sin verificar" : "Desafío";
  return d?.marcador_mios != null && !jugado ? `${base} · faltan goles` : base;
}
