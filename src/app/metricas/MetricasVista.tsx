import Card from "@/components/ui/Card";
import type { Metricas } from "@/lib/metricas";

const formatoCorto = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "numeric", timeZone: "UTC" });
const formatoDiaSemana = new Intl.DateTimeFormat("es-AR", { weekday: "narrow", timeZone: "UTC" });
const formatoFechaHora = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

// Columnas de la tabla por semana: clave del indicador y título corto.
const COLUMNAS = [
  ["nuevos", "Nuevos"],
  ["activos", "Entraron"],
  ["partidos", "Partidos"],
  ["resultados", "Result."],
  ["votos", "Votos"],
  ["grupos", "Grupos"],
] as const;

const corto = (dia: string) => formatoCorto.format(new Date(dia + "T00:00:00Z"));

function Delta({ actual, anterior }: { actual: number; anterior: number }) {
  const diferencia = actual - anterior;
  if (diferencia === 0) return <span className="text-zinc-500">= sem. pasada</span>;
  return (
    <span className={diferencia > 0 ? "text-primary-400" : "text-danger-400"}>
      {diferencia > 0 ? "▲" : "▼"} {Math.abs(diferencia)} <span className="text-zinc-500">vs {anterior}</span>
    </span>
  );
}

function Titulo({ children, detalle }: { children: React.ReactNode; detalle?: string }) {
  return (
    <div className="mb-2 mt-7 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-bold text-white">{children}</h2>
      {detalle && <span className="text-xs text-zinc-500">{detalle}</span>}
    </div>
  );
}

export default function MetricasVista({ m }: { m: Metricas }) {
  const estaSemana = m.semanas[m.semanas.length - 1];
  const pasada = m.semanas[m.semanas.length - 2];
  const maxDia = Math.max(1, ...m.activosPorDia.map((d) => d.cantidad));
  const tabla = COLUMNAS.map(([clave, label]) => ({ ...m.indicadores.find((i) => i.clave === clave)!, label }));
  const maxActivos = Math.max(1, ...m.semanas.map((s) => m.indicadores.find((i) => i.clave === "activos")!.porSemana.get(s) ?? 0));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-white">Métricas</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Uso de toda la app. Esta semana: desde el lunes {corto(estaSemana)} (hora de Argentina).
      </p>

      {m.faltaMigracion && (
        <Card className="mb-4 border-gold-500/30 p-4 text-sm text-gold-400">
          Falta correr la migración <code>0043_metricas_uso.sql</code>: sin ella no se registra quién entra ni cuándo
          se carga cada resultado.
        </Card>
      )}
      {m.errores.length > 0 && (
        <Card className="mb-4 border-danger-500/30 p-4 text-sm text-danger-400">
          No se pudo leer todo: {m.errores.join(" · ")}
        </Card>
      )}

      <div className="mb-2 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Usuarios", valor: m.totales.usuarios },
          { label: "Grupos", valor: m.totales.grupos },
          { label: "Partidos jugados", valor: m.totales.partidosJugados },
        ].map((t) => (
          <Card key={t.label} className="px-2 py-3">
            <div className="text-xl font-extrabold text-white tabular-nums">{t.valor}</div>
            <div className="text-[11px] text-zinc-500">{t.label}</div>
          </Card>
        ))}
      </div>

      <Titulo detalle="vs semana pasada completa">Esta semana</Titulo>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {m.indicadores.map((i) => {
          const actual = i.porSemana.get(estaSemana) ?? 0;
          const anterior = i.porSemana.get(pasada) ?? 0;
          return (
            <Card key={i.clave} className="p-3" title={i.nota}>
              <div className="text-[12px] leading-tight text-zinc-400">{i.label}</div>
              <div className="mt-1 text-2xl font-extrabold text-white tabular-nums">{actual}</div>
              <div className="text-[11px] tabular-nums">
                <Delta actual={actual} anterior={anterior} />
              </div>
            </Card>
          );
        })}
      </div>

      <Titulo detalle="últimos 14 días">Entraron por día</Titulo>
      <Card className="p-4">
        <div className="flex h-28 items-end gap-1">
          {m.activosPorDia.map((d) => (
            <div key={d.dia} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] text-zinc-400 tabular-nums">{d.cantidad || ""}</span>
              <div
                className={`w-full rounded-t ${d.dia >= estaSemana ? "bg-primary-500" : "bg-primary-500/40"}`}
                style={{ height: `${(d.cantidad / maxDia) * 100}%`, minHeight: d.cantidad ? 3 : 1 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {m.activosPorDia.map((d) => (
            <span key={d.dia} className="flex-1 text-center text-[10px] text-zinc-500 uppercase">
              {formatoDiaSemana.format(new Date(d.dia + "T00:00:00Z"))}
            </span>
          ))}
        </div>
      </Card>

      <Titulo detalle={`últimas ${m.semanas.length}`}>Por semana</Titulo>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border text-[11px] text-zinc-500">
              <th className="px-3 py-2 text-left font-medium">Semana</th>
              {tabla.map((i) => (
                <th key={i.clave} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                  {i.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...m.semanas].reverse().map((s) => (
              <tr key={s} className={`border-b border-border/50 last:border-0 ${s === estaSemana ? "text-white" : "text-zinc-300"}`}>
                <td className="px-3 py-1.5 whitespace-nowrap">{corto(s)}</td>
                {tabla.map((i) => {
                  const valor = i.porSemana.get(s) ?? 0;
                  return (
                    <td key={i.clave} className="relative px-2 py-1.5 text-right">
                      {i.clave === "activos" && valor > 0 && (
                        <span
                          className="absolute inset-y-1 right-0 rounded-l bg-primary-500/15"
                          style={{ width: `${(valor / maxActivos) * 100}%` }}
                        />
                      )}
                      <span className={`relative ${valor === 0 ? "text-zinc-600" : ""}`}>{valor}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Titulo detalle={`${m.entraron.length} personas`}>Quiénes entraron esta semana</Titulo>
      <Card className="divide-y divide-border/60">
        {m.entraron.length === 0 && <p className="p-4 text-sm text-zinc-500">Nadie todavía.</p>}
        {m.entraron.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm text-white">{u.nombre}</div>
              <div className="truncate text-xs text-zinc-500">{u.grupos.join(", ") || "Sin grupo"}</div>
            </div>
            <div className="shrink-0 text-right text-xs text-zinc-400 tabular-nums">
              {u.dias} {u.dias === 1 ? "día" : "días"}
              <div className="text-zinc-600">últ. {corto(u.ultimo)}</div>
            </div>
          </div>
        ))}
      </Card>

      <Titulo detalle="últimos 14 días">Usuarios nuevos</Titulo>
      <Card className="divide-y divide-border/60">
        {m.nuevos.length === 0 && <p className="p-4 text-sm text-zinc-500">Nadie se registró.</p>}
        {m.nuevos.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm text-white">{u.nombre}</div>
              <div className="truncate text-xs text-zinc-500">{u.email}</div>
              <div className={`truncate text-xs ${u.grupos.length ? "text-zinc-400" : "text-gold-400"}`}>
                {u.grupos.join(", ") || "Sin grupo"}
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-zinc-400 tabular-nums">
              {formatoFechaHora.format(new Date(u.creado))}
              {u.entroDespues && <div className="text-primary-400">volvió</div>}
            </div>
          </div>
        ))}
      </Card>

      <Titulo detalle="esta semana">Grupos con movimiento</Titulo>
      <Card className="overflow-x-auto">
        {m.gruposActivos.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">Ningún grupo tuvo actividad.</p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border text-[11px] text-zinc-500">
                <th className="px-3 py-2 text-left font-medium">Grupo</th>
                <th className="px-2 py-2 text-right font-medium">Entraron</th>
                <th className="px-2 py-2 text-right font-medium">Partidos</th>
                <th className="px-2 py-2 text-right font-medium">Result.</th>
                <th className="px-2 py-2 text-right font-medium">Votos</th>
                <th className="px-3 py-2 text-right font-medium">Nuevos</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {m.gruposActivos.map((g) => (
                <tr key={g.id} className="border-b border-border/50 last:border-0">
                  <td className="max-w-[9rem] truncate px-3 py-1.5 text-white">{g.nombre}</td>
                  {[g.activos, g.partidos, g.resultados, g.votos, g.nuevosMiembros].map((v, i) => (
                    <td key={i} className={`px-2 py-1.5 text-right last:pr-3 ${v === 0 ? "text-zinc-600" : ""}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Titulo detalle={`desde ${corto(m.semanas[0])}`}>Últimas sugerencias y fallas</Titulo>
      <Card className="mb-6 divide-y divide-border/60">
        {m.ultimosMensajes.length === 0 && <p className="p-4 text-sm text-zinc-500">No llegó ninguna.</p>}
        {m.ultimosMensajes.map((msg, i) => (
          <div key={i} className="px-4 py-2.5">
            <div className="flex justify-between gap-3 text-xs text-zinc-500">
              <span>
                {msg.motivo === "idea" ? "Idea" : msg.motivo === "falla" ? "Falla" : "Otro"} · {msg.nombre}
              </span>
              <span className="tabular-nums">{formatoFechaHora.format(new Date(msg.created_at))}</span>
            </div>
            <p className="mt-0.5 line-clamp-3 text-sm text-zinc-300">{msg.mensaje}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}
