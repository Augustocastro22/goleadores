"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bloqueo, Profile, Respuesta } from "@/lib/types";
import { bloqueaFecha, describirBloqueo } from "@/lib/disponibilidad";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { actualizarConvocados } from "@/lib/actions/partidos";
import { IconClose } from "@/components/icons";
import { RespuestaAdmin, ResumenRespuestas } from "./Confirmacion";
import NombresEquipos from "@/components/NombresEquipos";
import { Input } from "@/components/ui/Input";

type Equipo = 1 | 2;

/** Un jugador que ese día ya está convocado en un partido de otro grupo (get_ocupados_otro_grupo). */
export interface Ocupado {
  jugador_id: string;
  hora: string | null;
  /** Si confirmó que juega allá (si no, solo está convocado). */
  confirmado: boolean;
}

function textoOcupado(o: Ocupado) {
  const hora = o.hora ? ` (${o.hora.slice(0, 5)}hs)` : "";
  return o.confirmado ? `Ya juega con otro grupo ese día${hora}` : `Está convocado en otro grupo ese día${hora}`;
}

export default function ConvocadosEditor({
  partidoId,
  jugadores,
  equipo1IdsInit,
  equipo2IdsInit,
  partidoFecha,
  partidoHora,
  bloqueos,
  respuestas,
  unSoloEquipo = false,
  ocupados = [],
  exMiembroIds = [],
  rival,
  nombresEquipos,
  mostrarResumen = true,
  cambioDeModo,
}: {
  /**
   * Para pasar el partido de "contra otro equipo" a "entre nosotros" (o al
   * revés) al editar, y cambiar los nombres. No va en un desafío ni en un
   * grupo que todavía no eligió cómo juega (ahí, los dos equipos como siempre).
   */
  cambioDeModo?: { interno: boolean; rival: string; nombres: [string, string] };
  partidoId: string;
  jugadores: Profile[];
  /** Para el título del Equipo 2. */
  rival?: string;
  /** Cuando juegan entre ellos, los nombres de los dos equipos (títulos y botones). */
  nombresEquipos?: [string, string];
  /** El "2 juegan · 6 sin responder": no hace falta si ya está en la tarjeta del partido. */
  mostrarResumen?: boolean;
  /** Convocados que ya no están en el grupo: solo se los puede sacar. */
  exMiembroIds?: string[];
  equipo1IdsInit: string[];
  equipo2IdsInit: string[];
  partidoFecha: string;
  partidoHora: string | null;
  bloqueos: Bloqueo[];
  /** Respuesta de cada convocado, si el grupo pide confirmación. */
  respuestas?: Record<string, Respuesta>;
  /** En un desafío el Equipo 2 es el otro grupo: solo se elige quién juega. */
  unSoloEquipo?: boolean;
  /** Los que ese día ya están convocados en otro grupo. */
  ocupados?: Ocupado[];
}) {
  const router = useRouter();
  const asignacionesIniciales = useMemo(() => {
    const inicial: Record<string, Equipo> = {};
    for (const id of equipo1IdsInit) inicial[id] = 1;
    for (const id of equipo2IdsInit) inicial[id] = 2;
    return inicial;
  }, [equipo1IdsInit, equipo2IdsInit]);

  const [editando, setEditando] = useState(false);
  const [asignaciones, setAsignaciones] = useState(asignacionesIniciales);
  const [saving, setSaving] = useState(false);
  const [interno, setInterno] = useState(cambioDeModo?.interno ?? false);
  const [rivalEditado, setRivalEditado] = useState(cambioDeModo && !cambioDeModo.interno ? cambioDeModo.rival : "");
  const [nombresEditados, setNombresEditados] = useState<[string, string]>(cambioDeModo?.nombres ?? ["", ""]);
  // Botones al editar: con cambio de modo, según el modo elegido; si no, como venía.
  const soloUno = cambioDeModo ? !interno : unSoloEquipo;
  // Con confirmación todavía tienen que decir si van: "Convocado"; sin, ya juegan.
  const botonSolo = respuestas ? "Convocado" : "Juega";
  const etiquetas: [string, string] | undefined = cambioDeModo
    ? interno
      ? [nombresEditados[0] || "Equipo 1", nombresEditados[1] || "Equipo 2"]
      : undefined
    : nombresEquipos;
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const cantidad = useMemo(() => Object.keys(asignaciones).length, [asignaciones]);

  const jugadorPorId = useMemo(() => {
    const map = new Map<string, Profile>();
    jugadores.forEach((j) => map.set(j.id, j));
    return map;
  }, [jugadores]);

  // Por equipo (los títulos solo si hay Equipo 2) y, con confirmación,
  // primero los que juegan, después los que no respondieron y al final los que no.
  const equiposActuales = useMemo(() => {
    const orden: Record<Respuesta, number> = { juega: 0, pendiente: 1, no_juega: 2 };
    const perfiles = (ids: string[]) =>
      ids
        .map((id) => jugadorPorId.get(id))
        .filter((j): j is Profile => Boolean(j))
        .sort((a, b) => (respuestas ? orden[respuestas[a.id]] - orden[respuestas[b.id]] : 0));
    return [
      { titulo: nombresEquipos?.[0] ?? "Equipo 1 (Nosotros)", jugadores: perfiles(equipo1IdsInit) },
      { titulo: nombresEquipos?.[1] ?? `Equipo 2${rival ? ` (${rival})` : ""}`, jugadores: perfiles(equipo2IdsInit) },
    ].filter((e) => e.jugadores.length > 0);
  }, [equipo1IdsInit, equipo2IdsInit, jugadorPorId, respuestas, rival, nombresEquipos]);
  const hayConvocados = equiposActuales.length > 0;

  const bloqueoPorJugador = useMemo(() => {
    const map = new Map<string, Bloqueo>();
    for (const b of bloqueos) {
      if (!map.has(b.jugador_id) && bloqueaFecha(b, partidoFecha, partidoHora)) {
        map.set(b.jugador_id, b);
      }
    }
    return map;
  }, [bloqueos, partidoFecha, partidoHora]);

  const ocupadoPorJugador = useMemo(() => new Map(ocupados.map((o) => [o.jugador_id, o])), [ocupados]);
  const exMiembros = useMemo(() => new Set(exMiembroIds), [exMiembroIds]);

  function empezarEdicion() {
    setMessage(null);
    setAsignaciones(asignacionesIniciales);
    if (cambioDeModo) {
      setInterno(cambioDeModo.interno);
      setRivalEditado(cambioDeModo.interno ? "" : cambioDeModo.rival);
      setNombresEditados(cambioDeModo.nombres);
    }
    setEditando(true);
  }

  function cambiarInterno(valor: boolean) {
    setMessage(null);
    setInterno(valor);
    // Contra otro equipo nadie del grupo va al segundo: los que estaban ahí pasan al primero.
    if (!valor) {
      setAsignaciones((prev) => Object.fromEntries(Object.entries(prev).map(([id]) => [id, 1 as Equipo])));
    }
  }

  function cancelarEdicion() {
    setMessage(null);
    setAsignaciones(asignacionesIniciales);
    setEditando(false);
  }

  function sacar(jugadorId: string) {
    setMessage(null);
    setAsignaciones((prev) => {
      const next = { ...prev };
      delete next[jugadorId];
      return next;
    });
  }

  function elegir(jugadorId: string, equipo: Equipo) {
    setMessage(null);
    setAsignaciones((prev) => {
      const next = { ...prev };
      if (next[jugadorId] === equipo) {
        delete next[jugadorId];
      } else {
        next[jugadorId] = equipo;
      }
      return next;
    });
  }

  async function handleGuardar() {
    setSaving(true);
    setMessage(null);
    const result = await actualizarConvocados({
      partidoId,
      participantes: Object.entries(asignaciones).map(([jugadorId, equipo]) => ({
        jugadorId,
        equipo,
      })),
      equipos: cambioDeModo
        ? interno
          ? { interno: true, rival: nombresEditados[1], nombreEquipo: nombresEditados[0] }
          : { interno: false, rival: rivalEditado, nombreEquipo: null }
        : undefined,
    });
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "ok", text: "Convocatoria guardada." });
      setEditando(false);
      router.refresh();
    }
  }

  if (!editando) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Convocatoria</h2>
          <button
            type="button"
            onClick={empezarEdicion}
            className="text-xs font-semibold text-primary-400 hover:text-primary-300"
          >
            Editar
          </button>
        </div>
        {mostrarResumen && respuestas && hayConvocados && (
          <div className="-mt-1 mb-3">
            <ResumenRespuestas respuestas={Object.values(respuestas)} />
          </div>
        )}
        {!hayConvocados && (
          <Card className="px-4 py-3 text-sm text-zinc-500">Todavía no hay nadie convocado.</Card>
        )}
        <div className="flex flex-col gap-3">
          {equiposActuales.map((equipo) => (
            <div key={equipo.titulo}>
              {equiposActuales.length > 1 && (
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  {equipo.titulo}
                </p>
              )}
              <Card className="divide-y divide-border overflow-hidden py-1">
                {equipo.jugadores.map((jugador) => {
                  const bloqueo = bloqueoPorJugador.get(jugador.id);
                  const ocupado = ocupadoPorJugador.get(jugador.id);
                  return (
                    <div key={jugador.id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar src={jugador.foto_url} alt={jugador.apodo} size={32} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-zinc-200">
                          {jugador.nombre} {jugador.apellido}{" "}
                          <span className="text-zinc-500">({jugador.apodo})</span>
                        </span>
                        {bloqueo && (
                          <p className="truncate text-xs text-gold-400">
                            ⚠ Dijo que no puede: {describirBloqueo(bloqueo)}
                            {bloqueo.nota ? ` (${bloqueo.nota})` : ""}
                          </p>
                        )}
                        {ocupado && <p className="truncate text-xs text-gold-400">⚠ {textoOcupado(ocupado)}</p>}
                        {exMiembros.has(jugador.id) && (
                          <p className="truncate text-xs text-danger-400">Ya no está en el grupo: sacalo con Editar.</p>
                        )}
                      </div>
                      {respuestas?.[jugador.id] && !exMiembros.has(jugador.id) && (
                        <RespuestaAdmin
                          // Si la respuesta cambia desde otro lado, arranca de nuevo con la nueva.
                          key={respuestas[jugador.id]}
                          partidoId={partidoId}
                          jugadorId={jugador.id}
                          respuesta={respuestas[jugador.id]}
                        />
                      )}
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
        {message && (
          <p
            className={`mt-2 rounded-xl border px-3.5 py-2.5 text-sm ${
              message.type === "ok"
                ? "border-primary-500/20 bg-primary-500/10 text-primary-400"
                : "border-danger-500/20 bg-danger-500/10 text-danger-400"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-white">Convocatoria</h2>
      <Card className="p-4">
        {cambioDeModo && (
          <div className="mb-3">
            {interno ? (
              <NombresEquipos
                nombres={nombresEditados}
                onChange={setNombresEditados}
                accion={<LinkModo interno onCambiar={cambiarInterno} />}
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="rival-convocatoria" className="text-sm font-medium text-zinc-300">
                    Rival
                  </label>
                  <LinkModo interno={false} onCambiar={cambiarInterno} />
                </div>
                <Input
                  id="rival-convocatoria"
                  value={rivalEditado}
                  onChange={(e) => setRivalEditado(e.target.value)}
                  placeholder="Contra quién juegan"
                />
              </div>
            )}
          </div>
        )}
        <p className="mb-3 text-xs text-zinc-500">
          {soloUno
            ? `Marcá a quién convocás. Para sacar a alguien tocá la ✕ (o de nuevo ${botonSolo}).`
            : "Marcá quién juega y en qué equipo. Para sacar a alguien tocá la ✕ (o de nuevo su equipo)."}{" "}
          Podés sumar o sacar gente hasta antes de cargar el resultado.
        </p>
        <div className="flex flex-col gap-2">
          {jugadores.map((jugador) => {
            const equipo = asignaciones[jugador.id];
            const bloqueo = bloqueoPorJugador.get(jugador.id);
            const ocupado = ocupadoPorJugador.get(jugador.id);
            const exMiembro = exMiembros.has(jugador.id);
            // Uno que se fue del grupo no se puede volver a convocar: una vez sacado, no se lista.
            if (exMiembro && !equipo) return null;
            return (
              <div
                key={jugador.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-border bg-white/5 px-3.5 py-2.5"
              >
                {/* Al menos este ancho para el nombre: si los botones no entran al lado, bajan a otra línea. */}
                <div className="flex min-w-[7.5rem] flex-1 items-center gap-3">
                  <Avatar src={jugador.foto_url} alt={jugador.apodo} size={28} />
                  <div className="min-w-0">
                    <span className="block truncate text-sm text-zinc-200">
                      {jugador.nombre} {jugador.apellido}{" "}
                      <span className="text-zinc-500">({jugador.apodo})</span>
                    </span>
                    {bloqueo && (
                      <p className="truncate text-xs text-gold-400">
                        ⚠ Dijo que no puede: {describirBloqueo(bloqueo)}
                        {bloqueo.nota ? ` (${bloqueo.nota})` : ""}
                      </p>
                    )}
                    {ocupado && <p className="truncate text-xs text-gold-400">⚠ {textoOcupado(ocupado)}</p>}
                    {exMiembro && <p className="truncate text-xs text-danger-400">Ya no está en el grupo</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {!exMiembro && (
                    <button
                      type="button"
                      onClick={() => elegir(jugador.id, 1)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition ${
                        equipo === 1
                          ? "border-primary-500/40 bg-primary-500/10 text-primary-400"
                          : "border-border text-zinc-400 hover:text-white"
                      }`}
                    >
                      {soloUno ? botonSolo : (etiquetas?.[0] ?? "Eq. 1")}
                    </button>
                  )}
                  {!soloUno && !exMiembro && (
                    <button
                      type="button"
                      onClick={() => elegir(jugador.id, 2)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition ${
                        equipo === 2
                          ? "border-gold-500/40 bg-gold-500/10 text-gold-400"
                          : "border-border text-zinc-400 hover:text-white"
                      }`}
                    >
                      {etiquetas?.[1] ?? "Eq. 2"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => sacar(jugador.id)}
                    aria-label={`Sacar a ${jugador.apodo} de la convocatoria`}
                    className={`flex w-7 items-center justify-center rounded-lg border border-border text-zinc-500 transition hover:border-danger-500/40 hover:text-danger-400 ${
                      equipo ? "" : "invisible"
                    }`}
                  >
                    <IconClose className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button type="button" onClick={handleGuardar} disabled={saving} className="flex-1">
              {saving ? "Guardando..." : `Guardar convocatoria (${cantidad})`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={cancelarEdicion}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
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
        </div>
      </Card>
    </div>
  );
}

/** El link para pasar el partido a "entre nosotros" o a "contra otro equipo". */
function LinkModo({ interno, onCambiar }: { interno: boolean; onCambiar: (interno: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCambiar(!interno)}
      className="shrink-0 text-xs font-semibold text-primary-400 hover:text-primary-300"
    >
      {interno ? "¿Contra otro equipo?" : "¿Juegan entre ustedes?"}
    </button>
  );
}
