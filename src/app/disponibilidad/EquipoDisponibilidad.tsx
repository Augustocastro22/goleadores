"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Bloqueo } from "@/lib/types";
import { AGENDA_DESDE, AGENDA_HASTA, bloqueosEnHora } from "@/lib/disponibilidad";
import Card from "@/components/ui/Card";
import { IconChevronRight } from "@/components/icons";

const HORAS = Array.from({ length: AGENDA_HASTA - AGENDA_DESDE }, (_, i) => AGENDA_DESDE + i);
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function sumarDias(fecha: string, dias: number) {
  const d = new Date(fecha + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function lunesDe(fecha: string) {
  const dia = new Date(fecha + "T00:00:00Z").getUTCDay();
  return sumarDias(fecha, -((dia + 6) % 7));
}
function etiquetaDia(fecha: string) {
  return `${DIAS_CORTOS[new Date(fecha + "T00:00:00Z").getUTCDay()]} ${Number(fecha.slice(8, 10))} ${
    MESES_CORTOS[Number(fecha.slice(5, 7)) - 1]
  }`;
}

interface Jugador {
  id: string;
  nombre: string;
}
interface Franja {
  fecha: string;
  desde: number;
  hasta: number;
  pueden: number;
}

/**
 * Disponibilidad de todo el grupo: cruza los bloqueos de cada jugador en una
 * grilla día × hora y marca cuántos pueden. Quien no cargó nada cuenta como
 * disponible pero se lista aparte ("sin cargar"), para pedirle que lo haga.
 */
export default function EquipoDisponibilidad({
  jugadores,
  bloqueos,
  hoy,
  yoId,
}: {
  jugadores: Jugador[];
  bloqueos: Bloqueo[];
  hoy: string;
  yoId: string;
}) {
  const [lunes, setLunes] = useState(lunesDe(hoy));
  // Arranca pidiendo que puedan todos; se baja si hace falta (por ej. si no juegan todos).
  const [necesarios, setNecesarios] = useState(jugadores.length);
  const [sel, setSel] = useState<{ fecha: string; hora: number } | null>(null);

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)), [lunes]);
  const sinCargar = useMemo(
    () => jugadores.filter((j) => !bloqueos.some((b) => b.jugador_id === j.id)),
    [jugadores, bloqueos]
  );
  const porJugador = useMemo(
    () => new Map(jugadores.map((j) => [j.id, bloqueos.filter((b) => b.jugador_id === j.id)])),
    [jugadores, bloqueos]
  );

  /** Quiénes no pueden de h a h+1 en esa fecha. */
  function noPueden(fecha: string, h: number) {
    return jugadores.filter((j) => bloqueosEnHora(porJugador.get(j.id) ?? [], fecha, h).length > 0);
  }

  const grilla = useMemo(() => {
    const m = new Map<string, number>();
    for (const fecha of dias) {
      for (const h of HORAS) {
        const no = jugadores.filter((j) => bloqueosEnHora(porJugador.get(j.id) ?? [], fecha, h).length > 0);
        m.set(`${fecha}|${h}`, jugadores.length - no.length);
      }
    }
    return m;
  }, [dias, jugadores, porJugador]);

  // Mejores franjas: horas seguidas (mínimo 2) con al menos `necesarios` jugadores.
  const mejores = useMemo(() => {
    const out: Franja[] = [];
    for (const fecha of dias) {
      if (fecha < hoy) continue;
      for (let i = 0; i < HORAS.length; i++) {
        if ((grilla.get(`${fecha}|${HORAS[i]}`) ?? 0) < necesarios) continue;
        const desde = HORAS[i];
        // Se corta cuando cambia la cantidad, para no mezclar horas buenas con regulares.
        const pueden = grilla.get(`${fecha}|${desde}`)!;
        while (i + 1 < HORAS.length && grilla.get(`${fecha}|${HORAS[i + 1]}`) === pueden) i++;
        if (HORAS[i] + 1 - desde >= 2) out.push({ fecha, desde, hasta: HORAS[i] + 1, pueden });
      }
    }
    return out.sort((a, b) => b.pueden - a.pueden || b.hasta - b.desde - (a.hasta - a.desde)).slice(0, 4);
  }, [grilla, dias, necesarios, hoy]);

  const total = jugadores.length;
  const detalleNo = sel ? noPueden(sel.fecha, sel.hora) : [];
  const detalleSi = sel ? jugadores.filter((j) => !detalleNo.includes(j)) : [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-white">Mejores horarios</p>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            Mínimo de jugadores
            <span className="flex items-center rounded-lg border border-border bg-white/5">
              <button
                type="button"
                onClick={() => setNecesarios((n) => Math.max(2, n - 1))}
                className="px-2 py-1 text-white"
                aria-label="Menos jugadores"
              >
                −
              </button>
              <span className="w-6 text-center font-bold tabular-nums text-white">{necesarios}</span>
              <button
                type="button"
                onClick={() => setNecesarios((n) => Math.min(total, n + 1))}
                className="px-2 py-1 text-white"
                aria-label="Más jugadores"
              >
                +
              </button>
            </span>
          </label>
        </div>
        {mejores.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Esta semana no hay 2 horas seguidas con {necesarios} jugadores. Probá con otra semana o bajá el mínimo.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mejores.map((f) => (
              <li key={f.fecha + f.desde}>
                <button
                  type="button"
                  onClick={() => setSel({ fecha: f.fecha, hora: f.desde })}
                  className="flex w-full items-center justify-between rounded-xl border border-primary-500/20 bg-primary-500/5 px-3.5 py-2.5 text-left transition hover:bg-primary-500/10"
                >
                  <span>
                    <span className="block text-sm font-semibold text-white">{etiquetaDia(f.fecha)}</span>
                    <span className="text-xs text-zinc-400">
                      de {f.desde} a {f.hasta} hs
                    </span>
                  </span>
                  <span className="text-sm font-bold tabular-nums text-primary-400">
                    {f.pueden} de {total}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setLunes((l) => sumarDias(l, -7))}
            disabled={lunes <= lunesDe(hoy)}
            aria-label="Semana anterior"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            <IconChevronRight className="h-4 w-4 rotate-180" />
          </button>
          <p className="text-sm font-semibold text-white">
            {etiquetaDia(dias[0])} – {etiquetaDia(dias[6])}
          </p>
          <button
            type="button"
            onClick={() => setLunes((l) => sumarDias(l, 7))}
            aria-label="Semana siguiente"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-[2rem_repeat(7,1fr)] gap-0.5 text-center">
          <span />
          {dias.map((f) => (
            <span key={f} className={`pb-1 text-[11px] font-bold ${f < hoy ? "text-zinc-700" : "text-zinc-400"}`}>
              {DIAS_CORTOS[new Date(f + "T00:00:00Z").getUTCDay()]}
              <span className="block text-[10px] font-medium text-zinc-600">{Number(f.slice(8, 10))}</span>
            </span>
          ))}
          {HORAS.map((h) => (
            <div key={h} className="contents">
              <span className="pr-1 text-right text-[10px] leading-6 tabular-nums text-zinc-500">{h}</span>
              {dias.map((f) => {
                const pueden = grilla.get(`${f}|${h}`) ?? 0;
                const pasado = f < hoy;
                const activo = sel?.fecha === f && sel.hora === h;
                const ok = pueden >= necesarios;
                return (
                  <button
                    key={f}
                    type="button"
                    disabled={pasado}
                    onClick={() => setSel({ fecha: f, hora: h })}
                    aria-label={`${etiquetaDia(f)} ${h} hs: pueden ${pueden} de ${total}`}
                    className={`h-6 rounded transition ${
                      pasado ? "bg-transparent" : ok ? "bg-primary-500" : "bg-white/[0.06]"
                    } ${activo ? "ring-2 ring-white" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary-500" /> Llegan a {necesarios}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-white/[0.06]" /> No llegan
          </span>
          <span>Tocá una casilla para ver quiénes pueden.</span>
        </div>
      </Card>

      {sel && (
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white">
              {etiquetaDia(sel.fecha)} · {sel.hora} a {sel.hora + 1} hs
            </p>
            <button type="button" onClick={() => setSel(null)} className="text-xs text-zinc-500 hover:text-white">
              Cerrar
            </button>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-primary-400">Pueden ({detalleSi.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {detalleSi.map((j) => (
                <span key={j.id} className="rounded-full bg-primary-500/15 px-2.5 py-1 text-xs text-primary-400">
                  {j.nombre}
                  {sinCargar.includes(j) ? " ?" : ""}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-danger-400">No pueden ({detalleNo.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {detalleNo.map((j) => (
                <span key={j.id} className="rounded-full bg-danger-500/15 px-2.5 py-1 text-xs text-danger-400">
                  {j.nombre}
                </span>
              ))}
              {detalleNo.length === 0 && <span className="text-xs text-zinc-500">Nadie, todos pueden.</span>}
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">
            Los marcados con “?” no cargaron su disponibilidad, así que no se sabe si pueden.
          </p>
        </Card>
      )}

      {sinCargar.length > 0 && (
        <Card className="flex flex-col gap-2 p-5">
          <p className="text-sm font-semibold text-white">
            Faltan cargar su disponibilidad ({sinCargar.length} de {total})
          </p>
          <p className="text-xs text-zinc-500">
            Cuentan como que pueden en todo momento hasta que marquen cuándo no. Cuanta más gente lo
            cargue, más confiable es esta grilla.
          </p>
          {sinCargar.some((j) => j.id === yoId) && (
            <Link href="/perfil" className="text-sm font-semibold text-primary-400 hover:text-primary-300">
              Cargar la mía →
            </Link>
          )}
          <div className="flex flex-wrap gap-1.5">
            {sinCargar.map((j) => (
              <span key={j.id} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
                {j.nombre}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
