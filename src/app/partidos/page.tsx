import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Partido } from "@/lib/types";
import { calcularResultado, RESULTADO_CLASS, type Resultado } from "@/lib/resultado";
import Card from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { IconChevronRight, IconPlus } from "@/components/icons";

export default async function PartidosPage() {
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

  const { data: partidos } = await supabase
    .from("partidos")
    .select("*")
    .order("fecha", { ascending: false })
    .returns<Partido[]>();

  const resumenPorPartido = new Map<
    string,
    { golesEquipo1: number; golesEquipo2: number; resultado: Resultado }
  >();
  if (partidos && partidos.length > 0) {
    const { data: pj } = await supabase
      .from("partido_jugadores")
      .select("partido_id, goles, equipo")
      .in(
        "partido_id",
        partidos.map((p) => p.id)
      );

    const golesPorEquipo = new Map<string, { e1: number; e2: number }>();
    for (const row of pj ?? []) {
      const acc = golesPorEquipo.get(row.partido_id) ?? { e1: 0, e2: 0 };
      if (row.equipo === 1) acc.e1 += row.goles;
      else acc.e2 += row.goles;
      golesPorEquipo.set(row.partido_id, acc);
    }

    for (const partido of partidos) {
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

  const resultados = [...resumenPorPartido.values()].map((r) => r.resultado);
  const ganados = resultados.filter((r) => r === "G").length;
  const empatados = resultados.filter((r) => r === "E").length;
  const perdidos = resultados.filter((r) => r === "P").length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Partidos</h1>
        {profile?.rol === "admin" && (
          <Link href="/partidos/nuevo" className={buttonClass("primary", "sm")}>
            <IconPlus className="h-4 w-4" /> Nuevo
          </Link>
        )}
      </div>

      {!partidos || partidos.length === 0 ? (
        <Card className="px-5 py-10 text-center text-sm text-zinc-500">
          Todavía no hay partidos cargados.
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
                          {partido.lugar}
                          {partido.hora && ` · ${partido.hora.slice(0, 5)}hs`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {resumen && (
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
