"use client";

import { useState } from "react";
import type { Bloqueo } from "@/lib/types";
import {
  DIAS_SEMANA,
  HORARIOS,
  armarBloqueos,
  fechaCoincide,
  type Horario,
} from "@/lib/disponibilidad";
import { crearBloqueos } from "@/lib/actions/disponibilidad";
import Card from "@/components/ui/Card";
import AgendaSemana from "./AgendaSemana";
import BloqueosDelDia from "./BloqueosDelDia";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { IconChevronRight, IconClose, IconPlus } from "@/components/icons";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
// Encabezado de lunes a domingo, con el índice de getDay() (0 = domingo).
const ENCABEZADO = [
  { letra: "L", dia: 1 },
  { letra: "M", dia: 2 },
  { letra: "M", dia: 3 },
  { letra: "J", dia: 4 },
  { letra: "V", dia: 5 },
  { letra: "S", dia: 6 },
  { letra: "D", dia: 0 },
];
const DIAS_PLURAL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

const HORARIO_VACIO: Horario = { desde: "", hasta: "" };

/** Todas las fechas entre a y b (incluidas), en cualquier orden. */
function fechasEntre(a: string, b: string): string[] {
  const [desde, hasta] = a <= b ? [a, b] : [b, a];
  const fechas: string[] = [];
  const d = new Date(desde + "T00:00:00Z");
  while (d.toISOString().slice(0, 10) <= hasta) {
    fechas.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return fechas;
}

const selectClass =
  "w-full appearance-none rounded-xl border border-border bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20";

function aFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function diaDeSemana(fecha: string) {
  return new Date(fecha + "T00:00:00Z").getUTCDay();
}

function fechaCorta(fecha: string) {
  const [, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3).toLowerCase()}`;
}

/**
 * Disponibilidad del jugador: se marcan en un calendario los días (o "todos
 * los jueves") en que no puede jugar, todo el día o en ciertos horarios.
 * `hoy` viene del servidor (hora de Argentina) para que coincida el render.
 */
export default function DisponibilidadEditor({
  bloqueosIniciales,
  grupos,
  hoy,
}: {
  bloqueosIniciales: Bloqueo[];
  grupos: { id: string; nombre: string }[];
  hoy: string;
}) {
  const nombreGrupo = new Map(grupos.map((g) => [g.id, g.nombre]));
  const [anioHoy, mesHoy] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1];

  // "mes" para días enteros y rangos; "semana" para marcar horas en una agenda.
  const [pestana, setPestana] = useState<"mes" | "semana">("mes");
  const [vista, setVista] = useState({ anio: anioHoy, mes: mesHoy });
  const [fechasSel, setFechasSel] = useState<Set<string>>(new Set());
  const [diasSel, setDiasSel] = useState<Set<number>>(new Set());
  // "sueltos": cada toque marca o desmarca un día. "rango": el primer toque es
  // el desde y el segundo el hasta, y se marcan todos los del medio.
  const [modo, setModo] = useState<"sueltos" | "rango">("sueltos");
  const [inicioRango, setInicioRango] = useState<string | null>(null);
  const [todoElDia, setTodoElDia] = useState(true);
  const [horarios, setHorarios] = useState<Horario[]>([HORARIO_VACIO]);
  const [grupoId, setGrupoId] = useState("");
  const [nota, setNota] = useState("");
  // Día marcado que se tocó: muestra lo que tiene para editarlo o borrarlo.
  const [diaDetalle, setDiaDetalle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // Copia local para que cada cambio se vea al toque (las acciones devuelven
  // las filas creadas). Cuando llega la página recargada del servidor, manda
  // esa (ajuste de estado durante el render, como recomienda React).
  const [bloqueos, setBloqueos] = useState(bloqueosIniciales);
  const [iniciales, setIniciales] = useState(bloqueosIniciales);
  if (bloqueosIniciales !== iniciales) {
    setIniciales(bloqueosIniciales);
    setBloqueos(bloqueosIniciales);
  }
  const reemplazado = (id: string, nuevos: Bloqueo[]) =>
    setBloqueos((bs) => [...bs.filter((b) => b.id !== id), ...nuevos]);
  const borrado = (id: string) => setBloqueos((bs) => bs.filter((b) => b.id !== id));
  const agregados = (nuevos: Bloqueo[]) => {
    setBloqueos((bs) => [...bs, ...nuevos]);
    setMessage({
      type: "ok",
      text: nuevos.length > 0 ? "Listo, quedó guardado." : "Eso ya lo tenías marcado.",
    });
  };
  const bloqueosDetalle = diaDetalle ? bloqueos.filter((b) => fechaCoincide(b, diaDetalle)) : [];

  const haySeleccion = fechasSel.size > 0 || diasSel.size > 0;
  const esMesActual = vista.anio === anioHoy && vista.mes === mesHoy;

  const primerDia = new Date(Date.UTC(vista.anio, vista.mes, 1)).getUTCDay();
  const huecos = (primerDia + 6) % 7; // la semana arranca el lunes
  const diasDelMes = new Date(Date.UTC(vista.anio, vista.mes + 1, 0)).getUTCDate();

  function moverMes(delta: number) {
    setVista(({ anio, mes }) => {
      const d = new Date(Date.UTC(anio, mes + delta, 1));
      return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() };
    });
  }

  function alternar<T>(set: Set<T>, valor: T) {
    const nuevo = new Set(set);
    if (nuevo.has(valor)) nuevo.delete(valor);
    else nuevo.add(valor);
    return nuevo;
  }

  function limpiarSeleccion() {
    setFechasSel(new Set());
    setDiasSel(new Set());
    setInicioRango(null);
    setTodoElDia(true);
    setHorarios([HORARIO_VACIO]);
    setNota("");
  }

  function tocarDia(fecha: string) {
    setMessage(null);
    // Un día que ya tiene algo marcado abre su detalle (salvo que ya se lo
    // haya elegido para marcarle otra cosa, o se esté armando un rango).
    if (modo === "sueltos" && !fechasSel.has(fecha) && bloqueos.some((b) => fechaCoincide(b, fecha))) {
      setDiaDetalle(fecha);
      return;
    }
    setDiaDetalle(null);
    if (modo === "sueltos") {
      setFechasSel((s) => alternar(s, fecha));
      return;
    }
    if (!inicioRango) {
      setInicioRango(fecha);
      setFechasSel((s) => new Set(s).add(fecha));
      return;
    }
    // Los días del rango que ya pasaron no se marcan (no se pueden tocar).
    const nuevas = fechasEntre(inicioRango, fecha).filter((f) => f >= hoy);
    setFechasSel((s) => new Set([...s, ...nuevas]));
    setInicioRango(null);
  }

  function cambiarModo(nuevo: "sueltos" | "rango") {
    setModo(nuevo);
    setInicioRango(null);
  }

  function actualizarHorario(i: number, campo: keyof Horario, valor: string) {
    setHorarios((hs) =>
      hs.map((h, j) => {
        if (j !== i) return h;
        const nuevo = { ...h, [campo]: valor };
        // Si el "hasta" quedó antes que el nuevo "desde", se vacía para elegirlo de nuevo.
        if (campo === "desde" && nuevo.hasta && nuevo.hasta <= valor) nuevo.hasta = "";
        return nuevo;
      })
    );
  }

  async function guardar() {
    setMessage(null);
    if (!todoElDia) {
      if (horarios.some((h) => !h.desde || !h.hasta)) {
        setMessage({ type: "error", text: "Completá el desde y el hasta de cada horario." });
        return;
      }
      if (horarios.some((h) => h.hasta <= h.desde)) {
        setMessage({ type: "error", text: 'En cada horario, el "hasta" tiene que ser después del "desde".' });
        return;
      }
    }
    setSaving(true);
    const result = await crearBloqueos({
      bloqueos: armarBloqueos({
        fechas: [...fechasSel],
        diasSemana: [...diasSel],
        horarios: todoElDia ? null : horarios,
      }),
      grupoId: grupoId || null,
      nota: nota || null,
    });
    setSaving(false);
    if ("error" in result) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    limpiarSeleccion();
    agregados(result.bloqueos);
  }

  // Los días seguidos se resumen como rango, igual que se van a guardar.
  const tramos = armarBloqueos({ fechas: [...fechasSel], diasSemana: [], horarios: null });
  const resumenSeleccion = [
    ...(tramos.length > 4
      ? [`${fechasSel.size} días`]
      : tramos.map((t) =>
          t.tipo === "rango"
            ? `${fechaCorta(t.fecha_desde!)} – ${fechaCorta(t.fecha_hasta!)}`
            : fechaCorta(t.fecha_desde!)
        )),
    ...[...diasSel].sort().map((d) => `todos los ${DIAS_PLURAL[d]}`),
  ].join(", ");

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div>
        <p className="font-semibold text-white">Disponibilidad</p>
        <p className="mt-1 text-xs text-zinc-500">
          Marcá cuándo no podés jugar: en el mes, días enteros o de un día a otro; en la semana,
          las horas. Es solo un aviso para el admin al armar la convocatoria, no te saca solo del
          partido.
        </p>
      </div>

      <div className="inline-flex self-start rounded-xl border border-border bg-white/5 p-1">
        {[
          { valor: "mes" as const, label: "Mes" },
          { valor: "semana" as const, label: "Semana (horarios)" },
        ].map((op) => (
          <button
            key={op.valor}
            type="button"
            onClick={() => {
              setPestana(op.valor);
              setMessage(null);
            }}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              pestana === op.valor ? "bg-primary-500/15 text-primary-400" : "text-zinc-400 hover:text-white"
            }`}
          >
            {op.label}
          </button>
        ))}
      </div>

      {pestana === "semana" ? (
        <AgendaSemana
          bloqueos={bloqueos}
          grupos={grupos}
          hoy={hoy}
          nombreGrupo={nombreGrupo}
          onGuardado={agregados}
          onReemplazado={reemplazado}
          onBorrado={borrado}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {[
                { valor: "sueltos" as const, label: "Días sueltos" },
                { valor: "rango" as const, label: "Desde – hasta" },
              ].map((op) => (
                <button
                  key={op.valor}
                  type="button"
                  onClick={() => cambiarModo(op.valor)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    modo === op.valor
                      ? "border-primary-500/40 bg-primary-500/15 text-primary-400"
                      : "border-border bg-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
            {modo === "rango" && (
              <p className="text-xs text-primary-400">
                {inicioRango
                  ? `Desde el ${fechaCorta(inicioRango)}. Ahora tocá el último día.`
                  : "Tocá el primer día del rango."}
              </p>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => moverMes(-1)}
                disabled={esMesActual}
                aria-label="Mes anterior"
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <IconChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <p className="text-sm font-semibold text-white">
                {MESES[vista.mes]} {vista.anio}
              </p>
              <button
                type="button"
                onClick={() => moverMes(1)}
                aria-label="Mes siguiente"
                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                <IconChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {ENCABEZADO.map(({ letra, dia }) => (
                <button
                  key={dia}
                  type="button"
                  onClick={() => setDiasSel((s) => alternar(s, dia))}
                  aria-pressed={diasSel.has(dia)}
                  title={`Todos los ${DIAS_PLURAL[dia]}`}
                  className={`rounded-lg py-1 text-xs font-bold transition ${
                    diasSel.has(dia)
                      ? "bg-primary-500/15 text-primary-400"
                      : "text-zinc-500 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {letra}
                </button>
              ))}

              {Array.from({ length: huecos }, (_, i) => (
                <span key={`h${i}`} />
              ))}

              {Array.from({ length: diasDelMes }, (_, i) => {
                const fecha = aFecha(vista.anio, vista.mes, i + 1);
                const pasado = fecha < hoy;
                const delDia = bloqueos.filter((b) => fechaCoincide(b, fecha));
                const completo = delDia.some((b) => !b.hora_desde);
                const parcial = !completo && delDia.length > 0;
                const seleccionado = fechasSel.has(fecha) || diasSel.has(diaDeSemana(fecha));
                return (
                  <button
                    key={fecha}
                    type="button"
                    disabled={pasado}
                    onClick={() => tocarDia(fecha)}
                    aria-pressed={seleccionado}
                    aria-label={`${i + 1} de ${MESES[vista.mes]}${
                      completo ? ", no podés" : parcial ? ", no podés en algún horario" : ""
                    }`}
                    className={`relative flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums transition ${
                      pasado
                        ? "text-zinc-700"
                        : seleccionado
                          ? "bg-primary-500/20 font-bold text-white ring-2 ring-primary-400"
                          : completo
                            ? "bg-danger-500/20 font-semibold text-danger-400 hover:bg-danger-500/30"
                            : "text-zinc-200 hover:bg-white/5"
                    }`}
                  >
                    {i + 1}
                    {parcial && !pasado && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-danger-400" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-danger-500/40" /> No podés en todo el día
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-danger-400" /> En algún horario
              </span>
            </div>
          </div>

          {diaDetalle && bloqueosDetalle.length > 0 && (
            <BloqueosDelDia
              titulo={`${DIAS_SEMANA[new Date(diaDetalle + "T00:00:00Z").getUTCDay()]} ${fechaCorta(diaDetalle)}`}
              fecha={diaDetalle}
              bloqueos={bloqueosDetalle}
              nombreGrupo={nombreGrupo}
              onReemplazado={reemplazado}
              onBorrado={borrado}
              onCerrar={() => setDiaDetalle(null)}
              onAgregar={() => {
                setFechasSel((s) => new Set(s).add(diaDetalle));
                setDiaDetalle(null);
              }}
            />
          )}

          {haySeleccion && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary-500/20 bg-primary-500/5 p-4">
              <p className="text-sm text-zinc-300">
                <span className="text-zinc-500">No puedo: </span>
                <span className="font-semibold text-white">{resumenSeleccion}</span>
              </p>

              <div className="flex gap-2">
                {[
                  { valor: true, label: "Todo el día" },
                  { valor: false, label: "En ciertos horarios" },
                ].map((op) => (
                  <button
                    key={op.label}
                    type="button"
                    onClick={() => setTodoElDia(op.valor)}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      todoElDia === op.valor
                        ? "border-primary-500/40 bg-primary-500/15 text-primary-400"
                        : "border-border bg-white/5 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>

              {!todoElDia && (
                <div className="flex flex-col gap-2">
                  {horarios.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={h.desde}
                        onChange={(e) => actualizarHorario(i, "desde", e.target.value)}
                        aria-label="Desde"
                        className={selectClass}
                      >
                        <option value="" disabled className="bg-surface">
                          Desde
                        </option>
                        {HORARIOS.slice(0, -1).map((hr) => (
                          <option key={hr} value={hr} className="bg-surface">
                            {hr}
                          </option>
                        ))}
                      </select>
                      <span className="shrink-0 text-xs text-zinc-500">a</span>
                      <select
                        value={h.hasta}
                        onChange={(e) => actualizarHorario(i, "hasta", e.target.value)}
                        aria-label="Hasta"
                        className={selectClass}
                      >
                        <option value="" disabled className="bg-surface">
                          Hasta
                        </option>
                        {HORARIOS.slice(1)
                          .filter((hr) => !h.desde || hr > h.desde)
                          .map((hr) => (
                          <option key={hr} value={hr} className="bg-surface">
                            {hr}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setHorarios((hs) => hs.filter((_, j) => j !== i))}
                        disabled={horarios.length === 1}
                        aria-label="Quitar horario"
                        className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:text-danger-400 disabled:invisible"
                      >
                        <IconClose className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setHorarios((hs) => [...hs, HORARIO_VACIO])}
                    className="flex items-center gap-1.5 self-start text-xs font-semibold text-primary-400 hover:text-primary-300"
                  >
                    <IconPlus className="h-3.5 w-3.5" /> Agregar otro horario
                  </button>
                </div>
              )}

              {grupos.length > 1 && (
                <Label>
                  Para qué grupo
                  <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className={selectClass}>
                    <option value="" className="bg-surface">
                      Todos mis grupos
                    </option>
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id} className="bg-surface">
                        Solo {g.nombre}
                      </option>
                    ))}
                  </select>
                </Label>
              )}

              <Label>
                Nota (opcional)
                <Input
                  type="text"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej: de viaje"
                  maxLength={100}
                />
              </Label>

              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={guardar} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={limpiarSeleccion} disabled={saving}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

        </>
      )}

      {message && (
        <p
          className={`rounded-xl border px-3.5 py-2.5 text-sm ${
            message.type === "ok"
              ? "border-primary-500/20 bg-primary-500/10 text-primary-400"
              : "border-danger-500/20 bg-danger-500/10 text-danger-400"
          }`}
        >
          {message.text}
        </p>
      )}

    </Card>
  );
}
