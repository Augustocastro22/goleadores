"use client";

import { useState } from "react";
import type { Bloqueo } from "@/lib/types";
import {
  AGENDA_DESDE,
  AGENDA_HASTA,
  bloqueosDeAgenda,
  bloqueosEnHora,
  fechaCoincide,
} from "@/lib/disponibilidad";
import { crearBloqueos } from "@/lib/actions/disponibilidad";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { IconChevronRight } from "@/components/icons";
import BloqueosDelDia from "./BloqueosDelDia";

const LETRAS = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const HORAS = Array.from({ length: AGENDA_HASTA - AGENDA_DESDE }, (_, i) => AGENDA_DESDE + i);

const selectClass =
  "w-full appearance-none rounded-xl border border-border bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20";

function sumarDias(fecha: string, dias: number) {
  const d = new Date(fecha + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function lunesDe(fecha: string) {
  const dia = new Date(fecha + "T00:00:00Z").getUTCDay();
  return sumarDias(fecha, -((dia + 6) % 7));
}

function numeroDia(fecha: string) {
  return Number(fecha.slice(8, 10));
}

function fechaCorta(fecha: string) {
  return `${numeroDia(fecha)} ${MESES_CORTOS[Number(fecha.slice(5, 7)) - 1]}`;
}

/** "14–16, 20–24" a partir de horas sueltas [14, 15, 20, 21, 22, 23]. */
function tramosTexto(horas: number[]) {
  const ordenadas = [...horas].sort((a, b) => a - b);
  const tramos: string[] = [];
  for (let i = 0; i < ordenadas.length; i++) {
    const desde = ordenadas[i];
    while (i + 1 < ordenadas.length && ordenadas[i + 1] === ordenadas[i] + 1) i++;
    tramos.push(`${desde}–${ordenadas[i] + 1}`);
  }
  return tramos.join(", ");
}

/**
 * Agenda de una semana, de 10 a 24, en bloques de una hora: se tocan las
 * horas que no se puede jugar (o el día de arriba para todo el día) y se
 * guardan para esa fecha o para todas las semanas. Tocar una hora ya
 * bloqueada abre lo de ese día, para editarlo o borrarlo.
 */
export default function AgendaSemana({
  bloqueos,
  grupos,
  hoy,
  nombreGrupo,
  onGuardado,
  onReemplazado,
  onBorrado,
}: {
  bloqueos: Bloqueo[];
  grupos: { id: string; nombre: string }[];
  hoy: string;
  nombreGrupo: Map<string, string>;
  onGuardado: (nuevos: Bloqueo[]) => void;
  onReemplazado: (id: string, nuevos: Bloqueo[]) => void;
  onBorrado: (id: string) => void;
}) {
  const [semana, setSemana] = useState(0);
  const [marcadas, setMarcadas] = useState<Map<string, number[]>>(new Map());
  const [repetir, setRepetir] = useState(false);
  const [grupoId, setGrupoId] = useState("");
  const [nota, setNota] = useState("");
  const [diaDetalle, setDiaDetalle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lunes = sumarDias(lunesDe(hoy), semana * 7);
  const fechas = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const hayMarcadas = [...marcadas.values()].some((h) => h.length > 0);
  const bloqueosDetalle = diaDetalle ? bloqueos.filter((b) => fechaCoincide(b, diaDetalle)) : [];

  const estaMarcada = (fecha: string, h: number) => marcadas.get(fecha)?.includes(h) ?? false;
  const estaBloqueada = (fecha: string, h: number) => bloqueosEnHora(bloqueos, fecha, h).length > 0;

  function setHoras(fecha: string, horas: number[]) {
    setMarcadas((m) => new Map(m).set(fecha, horas));
  }

  function tocarHora(fecha: string, h: number) {
    setError(null);
    if (bloqueosEnHora(bloqueos, fecha, h).length > 0) {
      setDiaDetalle(fecha);
      return;
    }
    setDiaDetalle(null);
    const horas = marcadas.get(fecha) ?? [];
    setHoras(fecha, horas.includes(h) ? horas.filter((x) => x !== h) : [...horas, h]);
  }

  function tocarDia(fecha: string) {
    setError(null);
    setDiaDetalle(null);
    const libres = HORAS.filter((h) => !estaBloqueada(fecha, h));
    const todasMarcadas = libres.every((h) => estaMarcada(fecha, h));
    setHoras(fecha, todasMarcadas ? [] : libres);
  }

  function limpiar() {
    setMarcadas(new Map());
    setRepetir(false);
    setNota("");
    setError(null);
  }

  async function guardar() {
    setSaving(true);
    setError(null);
    const result = await crearBloqueos({
      bloqueos: bloqueosDeAgenda(marcadas, repetir),
      grupoId: grupoId || null,
      nota: nota || null,
    });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    limpiar();
    onGuardado(result.bloqueos);
  }

  // Celdas seguidas del mismo estado se dibujan como un solo bloque, con el
  // horario escrito en la primera.
  function celda(fecha: string, h: number) {
    const pasado = fecha < hoy;
    const bloqueada = estaBloqueada(fecha, h);
    const marcada = !bloqueada && estaMarcada(fecha, h);
    const igual = (otra: number) =>
      otra >= AGENDA_DESDE &&
      otra < AGENDA_HASTA &&
      (bloqueada ? estaBloqueada(fecha, otra) : marcada && !estaBloqueada(fecha, otra) && estaMarcada(fecha, otra));
    const empieza = !igual(h - 1);
    const termina = !igual(h + 1);
    let fin = h;
    while (igual(fin + 1)) fin++;

    const color = bloqueada
      ? "bg-danger-500/35 text-danger-400"
      : marcada
        ? "bg-primary-500/30 text-primary-400"
        : "hover:bg-white/5";
    const forma =
      bloqueada || marcada
        ? `${empieza ? "rounded-t-md" : ""} ${termina ? "rounded-b-md" : ""} ${empieza ? "" : "border-t-transparent"}`
        : "";

    return (
      <button
        key={fecha + h}
        type="button"
        disabled={pasado}
        onClick={() => tocarHora(fecha, h)}
        aria-pressed={marcada}
        aria-label={`${DIAS_CORTOS[new Date(fecha + "T00:00:00Z").getUTCDay()]} ${numeroDia(fecha)}, de ${h} a ${h + 1}${
          bloqueada ? ", no podés" : marcada ? ", marcada" : ""
        }`}
        className={`relative h-7 border-t border-border text-left transition disabled:opacity-30 ${color} ${forma}`}
      >
        {(bloqueada || marcada) && empieza && (
          <span className="absolute top-0.5 left-1 text-[10px] leading-tight font-bold">
            {h === AGENDA_DESDE && fin === AGENDA_HASTA - 1 ? "Todo el día" : `${h}–${fin + 1}`}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSemana((s) => s - 1)}
          disabled={semana === 0}
          aria-label="Semana anterior"
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <IconChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <p className="text-sm font-semibold text-white">
          {fechaCorta(fechas[0])} – {fechaCorta(fechas[6])}
        </p>
        <button
          type="button"
          onClick={() => setSemana((s) => s + 1)}
          aria-label="Semana siguiente"
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] gap-x-0.5">
        <span />
        {fechas.map((fecha, i) => (
          <button
            key={fecha}
            type="button"
            disabled={fecha < hoy}
            onClick={() => tocarDia(fecha)}
            aria-label={`Todo el ${DIAS_CORTOS[new Date(fecha + "T00:00:00Z").getUTCDay()]} ${numeroDia(fecha)}`}
            className={`mb-1 flex flex-col items-center rounded-lg py-1 transition hover:bg-white/5 disabled:opacity-30 ${
              fecha === hoy ? "text-primary-400" : "text-zinc-300"
            }`}
          >
            <span className="text-[10px] text-zinc-500">{LETRAS[i]}</span>
            <span className="text-sm font-bold tabular-nums">{numeroDia(fecha)}</span>
          </button>
        ))}

        {HORAS.map((h) => (
          <div key={h} className="contents">
            <span className="-translate-y-1.5 pr-1 text-right text-[10px] text-zinc-600 tabular-nums">{h}</span>
            {fechas.map((fecha) => celda(fecha, h))}
          </div>
        ))}
        {/* Línea de cierre: la última fila va de 23 a 24. */}
        <span className="-translate-y-1.5 pr-1 text-right text-[10px] text-zinc-600 tabular-nums">
          {AGENDA_HASTA}
        </span>
        {fechas.map((fecha) => (
          <span key={fecha} className="border-t border-border" />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-danger-500/50" /> No podés (guardado)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary-500/50" /> Por guardar
        </span>
      </div>

      {diaDetalle && bloqueosDetalle.length > 0 && (
        <BloqueosDelDia
          titulo={`${DIAS_CORTOS[new Date(diaDetalle + "T00:00:00Z").getUTCDay()]} ${fechaCorta(diaDetalle)}`}
          fecha={diaDetalle}
          bloqueos={bloqueosDetalle}
          nombreGrupo={nombreGrupo}
          onReemplazado={onReemplazado}
          onBorrado={onBorrado}
          onCerrar={() => setDiaDetalle(null)}
        />
      )}

      {hayMarcadas && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary-500/20 bg-primary-500/5 p-4">
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="text-zinc-500">No puedo:</span>
            {[...marcadas.entries()]
              .filter(([, horas]) => horas.length > 0)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([fecha, horas]) => (
                <span key={fecha} className="font-semibold text-white">
                  {repetir
                    ? `Todos los ${DIAS_CORTOS[new Date(fecha + "T00:00:00Z").getUTCDay()].toLowerCase()}`
                    : `${DIAS_CORTOS[new Date(fecha + "T00:00:00Z").getUTCDay()]} ${fechaCorta(fecha)}`}
                  : {horas.length === HORAS.length ? "todo el día" : tramosTexto(horas)}
                </span>
              ))}
          </div>

          <div className="flex gap-2">
            {[
              { valor: false, label: "Solo esa fecha" },
              { valor: true, label: "Todas las semanas" },
            ].map((op) => (
              <button
                key={op.label}
                type="button"
                onClick={() => setRepetir(op.valor)}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  repetir === op.valor
                    ? "border-primary-500/40 bg-primary-500/15 text-primary-400"
                    : "border-border bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>

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
              placeholder="Ej: laburo"
              maxLength={100}
            />
          </Label>

          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={guardar} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={limpiar} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-400">
          {error}
        </p>
      )}
    </div>
  );
}
