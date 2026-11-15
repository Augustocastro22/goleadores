"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bloqueo, Profile, Respuesta } from "@/lib/types";
import { bloqueaFecha } from "@/lib/disponibilidad";
import AvisosConvocado, { type Ocupado } from "@/components/AvisosConvocado";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { actualizarConvocados, corregirJugaron } from "@/lib/actions/partidos";
import { sortearEquipos } from "@/lib/sorteo";
import { MIN_PARTIDOS, nivelDe as nivelDeJugador, puntajeEquipos, sortearParejos, type Niveles } from "@/lib/nivel";
import { guardarNivelManual } from "@/lib/actions/admin";
import { IconClose } from "@/components/icons";
import { RespuestaAdmin, ResumenRespuestas } from "./Confirmacion";
import NombresEquipos from "@/components/NombresEquipos";
import { Input } from "@/components/ui/Input";

type Equipo = 1 | 2;

export type { Ocupado };

export default function ConvocadosEditor({
  partidoId,
  jugadores,
  equipo1IdsInit,
  equipo2IdsInit,
  partidoFecha,
  partidoHora,
  bloqueos,
  respuestas,
  pendientesSoloLectura = false,
  niveles,
  grupoId,
  unSoloEquipo = false,
  ocupados = [],
  exMiembroIds = [],
  rival,
  nombresEquipos,
  mostrarResumen = true,
  cambioDeModo,
  modo = "convocatoria",
}: {
  /**
   * "convocatoria": antes del resultado. "jugaron": con el resultado cargado,
   * para corregir quiénes jugaron (mientras la votación esté abierta).
   */
  modo?: "convocatoria" | "jugaron";
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
  /** "Sin responder" sin selector: se define en la tarjeta de los que no respondieron. */
  pendientesSoloLectura?: boolean;
  /**
   * Nivel de 0 a 100 de cada jugador con historial suficiente, y lo que vale
   * el resto (ver lib/nivel.ts): para "Equipos parejos" y el puntaje de cada
   * equipo. Sin esto (nadie con historial), solo el sorteo al azar.
   */
  niveles?: Niveles;
  /** Para guardar el nivel a mano de los que no tienen historial. */
  grupoId?: string;
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
  const jugaron = modo === "jugaron";
  // Con confirmación todavía tienen que decir si van: "Convocado"; sin, ya juegan.
  const botonSolo = jugaron ? "Jugó" : respuestas ? "Convocado" : "Juega";
  // Entre ellos, convocados pero con los equipos todavía sin armar (todos en el primero).
  const sinArmar = !jugaron && !!nombresEquipos && equipo2IdsInit.length === 0 && equipo1IdsInit.length > 0;
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

  /** Los que entran al sorteo y al puntaje: no dijeron que no juegan y siguen en el grupo. */
  const cuenta = (id: string) => respuestas?.[id] !== "no_juega" && !exMiembros.has(id);

  /** Reparte en los dos equipos a los convocados que cuentan: al azar o, con `parejos`, por nivel. */
  function sortear(parejos = false) {
    setMessage(null);
    setAsignaciones((prev) => {
      const ids = Object.keys(prev).filter(cuenta);
      return { ...prev, ...(parejos && conNiveles ? sortearParejos(ids, nivelDe) : sortearEquipos(ids)) };
    });
  }

  // Con alguien medido o con nivel a mano se puede emparejar; si no, todos valdrían lo mismo.
  const conNiveles =
    !!niveles && Object.keys(niveles.medidos).length + Object.keys(niveles.manuales).length > 0;
  const nivelDe = (id: string) => (niveles ? nivelDeJugador(niveles, id) : 0);
  /** Promedio de cada equipo y cuántos de los que cuentan valen el promedio (sin historial ni nivel a mano). */
  function puntaje(asig: Record<string, Equipo>) {
    const contados = Object.fromEntries(Object.entries(asig).filter(([id]) => cuenta(id)));
    return {
      equipos: puntajeEquipos(contados, nivelDe),
      sinNivel: Object.keys(contados).filter(
        (id) => niveles && !(id in niveles.medidos) && !(id in niveles.manuales)
      ).length,
      hayDos: Object.values(contados).includes(1) && Object.values(contados).includes(2),
    };
  }

  const [guardandoNivel, setGuardandoNivel] = useState<string | null>(null);
  async function cambiarNivel(jugadorId: string, nivel: number | null) {
    if (!grupoId) return;
    setMessage(null);
    setGuardandoNivel(jugadorId);
    const result = await guardarNivelManual({ grupoId, jugadorId, nivel, partidoId });
    setGuardandoNivel(null);
    if (result.error) setMessage({ type: "error", text: result.error });
    else router.refresh();
  }

  async function handleGuardar() {
    const participantes = Object.entries(asignaciones).map(([jugadorId, equipo]) => ({ jugadorId, equipo }));
    if (jugaron) {
      const sacados = [...equipo1IdsInit, ...equipo2IdsInit].filter((id) => !asignaciones[id]);
      if (
        sacados.length > 0 &&
        !window.confirm(
          `A ${sacados.length === 1 ? "quien sacás" : `los ${sacados.length} que sacás`} se le borran los goles y los votos de este partido. ¿Seguir?`
        )
      ) {
        return;
      }
    }
    setSaving(true);
    setMessage(null);
    const result = jugaron
      ? await corregirJugaron({ partidoId, participantes })
      : await actualizarConvocados({
          partidoId,
          participantes,
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
      setMessage({ type: "ok", text: jugaron ? "Listo: se corrigió quiénes jugaron." : "Convocatoria guardada." });
      setEditando(false);
      router.refresh();
    }
  }

  // Con el resultado cargado no se repite la lista (está en los goles): solo la opción de corregirla.
  if (jugaron && !editando) {
    return (
      <Card className="flex flex-col gap-2 px-4 py-3">
        <p className="text-sm text-zinc-400">¿Faltó alguien que estaba anotado, o jugó alguien que no?</p>
        <button
          type="button"
          onClick={empezarEdicion}
          className="self-start text-sm font-semibold text-primary-400 hover:text-primary-300"
        >
          Corregir quiénes jugaron
        </button>
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
        {sinArmar && (
          <Card className="mb-3 flex flex-col gap-2 border-gold-500/20 px-4 py-3">
            <p className="text-sm text-zinc-300">
              Los equipos todavía no están armados. Armalos (o sortealos) cuando sepas quiénes van: hay que
              tenerlos antes de cargar el resultado.
            </p>
            <button
              type="button"
              onClick={empezarEdicion}
              className="self-start text-sm font-semibold text-primary-400 hover:text-primary-300"
            >
              Armar equipos
            </button>
          </Card>
        )}
        {conNiveles && equiposActuales.length > 1 && (
          <div className="mb-2">
            <PuntajeLinea
              {...puntaje(asignacionesIniciales)}
              nombres={[equiposActuales[0].titulo, equiposActuales[1].titulo]}
            />
          </div>
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
                        <AvisosConvocado bloqueo={bloqueo} ocupado={ocupado} />
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
                          pendienteSoloLectura={pendientesSoloLectura}
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
      <h2 className="mb-3 text-lg font-bold text-white">{jugaron ? "Quiénes jugaron" : "Convocatoria"}</h2>
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
          {jugaron
            ? soloUno
              ? "Marcá quiénes jugaron. A quien saques se le borran sus goles y sus votos de este partido; quien sumes puede votar."
              : "Marcá en qué equipo jugó cada uno. A quien saques se le borran sus goles y sus votos de este partido; quien sumes puede votar."
            : soloUno
              ? `Marcá a quién convocás. Para sacar a alguien tocá la ✕ (o de nuevo ${botonSolo}).`
              : "Marcá quién juega y en qué equipo. Para sacar a alguien tocá la ✕ (o de nuevo su equipo)."}
          {!jugaron && sinArmar && " Los equipos todavía no están armados: sortealos o elegí el equipo de cada uno."}
        </p>
        {!soloUno && !jugaron && (
          <div className="mb-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => sortear()}
                disabled={cantidad < 2}
                className="flex-1 rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-2 text-sm font-semibold text-gold-400 transition hover:bg-gold-500/20 disabled:opacity-40"
              >
                Sortear equipos
              </button>
              {conNiveles && (
                <button
                  type="button"
                  onClick={() => sortear(true)}
                  disabled={cantidad < 2}
                  className="flex-1 rounded-xl border border-primary-500/30 bg-primary-500/10 px-4 py-2 text-sm font-semibold text-primary-400 transition hover:bg-primary-500/20 disabled:opacity-40"
                >
                  Equipos parejos
                </button>
              )}
            </div>
            {conNiveles && (
              <PuntajeLinea
                {...puntaje(asignaciones)}
                nombres={[etiquetas?.[0] ?? "Eq. 1", etiquetas?.[1] ?? "Eq. 2"]}
                explicar
              />
            )}
          </div>
        )}
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
                    <AvisosConvocado bloqueo={bloqueo} ocupado={ocupado} />
                    {exMiembro && <p className="truncate text-xs text-danger-400">Ya no está en el grupo</p>}
                    {niveles && !soloUno && !jugaron && !exMiembro && (
                      <NivelJugador
                        apodo={jugador.apodo}
                        medido={niveles.medidos[jugador.id]}
                        manual={niveles.manuales[jugador.id]}
                        guardando={guardandoNivel === jugador.id}
                        onCambiar={grupoId ? (n) => cambiarNivel(jugador.id, n) : undefined}
                      />
                    )}
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
              {saving ? "Guardando..." : jugaron ? `Guardar (${cantidad})` : `Guardar convocatoria (${cantidad})`}
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

const decimal = (n: number) => n.toFixed(1).replace(".", ",");

/** "Nivel: Equipo A 6,4 · Equipo B 6,3", el promedio de cada uno (ver lib/nivel.ts). */
function PuntajeLinea({
  equipos,
  sinNivel,
  hayDos,
  nombres,
  explicar = false,
}: {
  equipos: [number, number];
  sinNivel: number;
  hayDos: boolean;
  nombres: [string, string];
  explicar?: boolean;
}) {
  const explicacion = `Cada uno tiene un nivel del 1 al 10 según su % de puntos y sus goles por partido; con menos de ${MIN_PARTIDOS} partidos, el que le pongas a mano.`;
  if (!hayDos) {
    return explicar ? <p className="text-xs text-zinc-500">{explicacion}</p> : null;
  }
  return (
    <div className="text-xs text-zinc-500">
      <p>
        Nivel: <span className="font-semibold text-primary-400">{nombres[0]} {decimal(equipos[0])}</span> ·{" "}
        <span className="font-semibold text-gold-400">{nombres[1]} {decimal(equipos[1])}</span>
      </p>
      {(explicar || sinNivel > 0) && (
        <p>
          {explicar && `${explicacion} `}
          {sinNivel > 0 &&
            `${sinNivel === 1 ? "1 no tiene" : `${sinNivel} no tienen`} nivel todavía: ${
              sinNivel === 1 ? "cuenta" : "cuentan"
            } como el promedio.`}
        </p>
      )}
    </div>
  );
}

/**
 * El nivel de un jugador al editar. Medido con su historial: solo se lee. Sin
 * historial suficiente: el admin elige uno del 1 al 10 (se guarda para los
 * próximos partidos).
 */
function NivelJugador({
  apodo,
  medido,
  manual,
  guardando,
  onCambiar,
}: {
  apodo: string;
  medido?: number;
  manual?: number;
  guardando: boolean;
  onCambiar?: (nivel: number | null) => void;
}) {
  if (medido !== undefined) {
    return <p className="text-xs text-zinc-500">Nivel {decimal(medido)}</p>;
  }
  return (
    <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-zinc-500">
      <span>Nivel</span>
      <select
        value={manual ?? ""}
        disabled={guardando || !onCambiar}
        aria-label={`Nivel de ${apodo}`}
        onChange={(e) => onCambiar?.(e.target.value ? Number(e.target.value) : null)}
        className={`field-sizing-content cursor-pointer rounded-md border bg-transparent px-1.5 py-0.5 text-xs font-semibold outline-none disabled:opacity-50 ${
          manual ? "border-primary-500/30 text-primary-400" : "border-gold-500/30 text-gold-400"
        }`}
      >
        <option value="" className="bg-surface text-white">
          ?
        </option>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n} className="bg-surface text-white">
            {n}
          </option>
        ))}
      </select>
      {guardando && <span>Guardando…</span>}
    </label>
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
