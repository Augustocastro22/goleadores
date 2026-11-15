"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { IconDownload, IconTrash } from "@/components/icons";
import {
  armarSlots,
  FORMACIONES_PRESET,
  FUTBOL_OPCIONES,
  futbolPara,
  ordenEnCancha,
  parseFormacion,
  repartir,
  type Equipo,
  type Slot,
} from "@/lib/cancha";
import { exito, tap } from "@/lib/haptics";
import { MAX_NOMBRE_INVITADO, type FormacionGuardada } from "@/lib/formacion";
import { borrarFormacion, guardarFormacion } from "@/lib/actions/formacion";
import LineasCancha from "./LineasCancha";
import { exportarCancha } from "./exportar";
import { Pelotita } from "@/components/Compartir";

export interface EquipoCancha {
  nombre: string;
  jugadores: Profile[];
}

type Seleccion = { jugadorId: string; slotId: string | null };

type Arrastre =
  | { tipo: "banco"; jugadorId: string; pointerId: number; x0: number; y0: number; x: number; y: number }
  | { tipo: "cancha"; slotId: string; pointerId: number; movio: boolean };

const UMBRAL_ARRASTRE = 8;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Colores de cada equipo: verde el primero (abajo), dorado el segundo (arriba). */
export const COLOR_EQUIPO: Record<Equipo, { marco: string; texto: string }> = {
  1: { marco: "bg-primary-400", texto: "text-primary-400" },
  2: { marco: "bg-gold-400", texto: "text-gold-400" },
};

/**
 * La cancha para armar la formación: uno o dos equipos (entre ellos, cada uno
 * en su mitad). Se elige cuántos juegan y la formación (la misma para los dos),
 * y los jugadores se ubican arrastrándolos o tocando jugador y posición. Al
 * cambiar de formación, cada uno va a su nuevo lugar con una animación (las
 * fichas son por jugador, no por posición). Al final se comparte como imagen.
 *
 * En un partido, el admin la puede guardar (con invitados con nombre en los
 * lugares libres) y avisar a los convocados; guardada, los demás la ven fija.
 */
export default function ArmadorCancha({
  equipos,
  titulo,
  subtitulo,
  autoUbicar = false,
  archivo = "formacion",
  partidoId,
  guardada,
  previa,
  esAdmin = false,
}: {
  /** Uno (todo el plantel, o los convocados contra un rival) o dos (entre ellos). */
  equipos: EquipoCancha[];
  /** Para la imagen: "Blancos vs Negros". */
  titulo?: string;
  /** Para la imagen: "Sábado 21/11 · 21:00 · Once Unidos". */
  subtitulo?: string;
  /** Arrancar con todos ubicados (en un partido); si no, la cancha arranca vacía. */
  autoUbicar?: boolean;
  archivo?: string;
  /** En un partido: para guardar la formación (solo el admin). */
  partidoId?: string;
  /** La formación que guardó el admin: arranca con esa; los demás la ven fija. */
  guardada?: FormacionGuardada | null;
  /** Para el admin sin guardada: la del último partido, para repetir las posiciones (sin los invitados). */
  previa?: { formacion: FormacionGuardada; fecha: string } | null;
  esAdmin?: boolean;
}) {
  const router = useRouter();
  const dosEquipos = equipos.length === 2;
  const numeros: Equipo[] = dosEquipos ? [1, 2] : [1];
  const mitadDe = (e: Equipo) => (dosEquipos ? (e === 1 ? "abajo" : "arriba") : "completa");
  // El admin puede guardarla; los demás, si hay una guardada, la ven fija (sin mover nada).
  const puedeGuardar = !!partidoId && esAdmin;
  const fija = !!guardada && !puedeGuardar;
  // Sin nada guardado, la cancha se llena sola para mirar; el admin, que la arma de verdad, no:
  // arranca con las posiciones del partido anterior (si hay) o vacía, porque no sabemos dónde juega cada uno.
  const llenaSola = autoUbicar && !puedeGuardar;
  const base = guardada ?? (puedeGuardar ? (previa?.formacion ?? null) : null);
  const [usandoPrevia, setUsandoPrevia] = useState(!guardada && puedeGuardar && !!previa);

  const [futbol, setFutbol] = useState(() =>
    base?.futbol ?? (autoUbicar ? futbolPara(Math.max(...equipos.map((e) => e.jugadores.length))) : 5)
  );
  const [formacion, setFormacion] = useState(() => base?.formacion ?? FORMACIONES_PRESET[futbol][0]);
  // Invitados (gente que no es del grupo): el admin les pone un nombre en un lugar libre.
  const [invitados, setInvitados] = useState<Record<string, { nombre: string; equipo: Equipo }>>(() => {
    const inv: Record<string, { nombre: string; equipo: Equipo }> = {};
    for (const [slot, lugar] of Object.entries(guardada?.lugares ?? {})) {
      if ("invitado" in lugar) inv[`inv:${slot}`] = { nombre: lugar.invitado, equipo: slot.startsWith("e2-") ? 2 : 1 };
    }
    return inv;
  });
  const [nuevoInvitado, setNuevoInvitado] = useState<{ slotId: string; nombre: string } | null>(null);
  const [avisar, setAvisar] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  // Una guardada con una formación que no está entre las de siempre arranca en "Otra".
  const baseCustom = !!base && !FORMACIONES_PRESET[base.futbol]?.includes(base.formacion);
  const [customInput, setCustomInput] = useState(baseCustom ? base!.formacion : "");
  const [usandoCustom, setUsandoCustom] = useState(baseCustom);
  const [customError, setCustomError] = useState<string | null>(null);
  const [posiciones, setPosiciones] = useState<Record<string, { xPct: number; yPct: number }>>(() =>
    Object.fromEntries(Object.entries(base?.posiciones ?? {}).map(([s, p]) => [s, { xPct: p.x, yPct: p.y }]))
  );
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [exportando, setExportando] = useState(false);

  const canchaRef = useRef<HTMLDivElement>(null);
  const recienArrastro = useRef(false);

  const lineas = useMemo(() => parseFormacion(formacion) ?? [futbol - 1], [formacion, futbol]);
  const slotsDe = (ls: number[]) => numeros.flatMap((e) => armarSlots(ls, e, mitadDe(e)));
  const slotsBase = useMemo(() => slotsDe(lineas), [lineas, dosEquipos]); // eslint-disable-line react-hooks/exhaustive-deps
  const slots = useMemo(() => slotsBase.map((s) => ({ ...s, ...(posiciones[s.id] ?? {}) })), [slotsBase, posiciones]);

  // Los jugadores y los invitados (estos, como un perfil sin foto con su nombre).
  const jugadorPorId = useMemo(() => {
    const m = new Map<string, Profile>(equipos.flatMap((e) => e.jugadores).map((j) => [j.id, j]));
    for (const [id, inv] of Object.entries(invitados)) {
      m.set(id, { id, nombre: inv.nombre, apellido: "", apodo: inv.nombre, foto_url: null, created_at: "" });
    }
    return m;
  }, [equipos, invitados]);
  const equipoDe = useMemo(() => {
    const m = new Map<string, Equipo>();
    equipos.forEach((e, i) => e.jugadores.forEach((j) => m.set(j.id, (i + 1) as Equipo)));
    for (const [id, inv] of Object.entries(invitados)) m.set(id, inv.equipo);
    return m;
  }, [equipos, invitados]);

  const ubicarTodos = (ls: number[], ordenes?: Partial<Record<Equipo, string[]>>) => {
    const asign: Record<string, string> = {};
    for (const e of numeros) {
      const orden = ordenes?.[e] ?? equipos[e - 1].jugadores.map((j) => j.id);
      Object.assign(asign, repartir(orden, armarSlots(ls, e, mitadDe(e))));
    }
    return asign;
  };
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>(() => {
    if (base) {
      // La guardada (o la del partido anterior): los que siguen convocados, en una posición de su
      // equipo, y los invitados (solo los de la guardada, con un id propio).
      const equipoDeJugador = new Map<string, Equipo>();
      equipos.forEach((e, i) => e.jugadores.forEach((j) => equipoDeJugador.set(j.id, (i + 1) as Equipo)));
      const asign: Record<string, string> = {};
      for (const [slot, lugar] of Object.entries(base.lugares)) {
        if ("jugador" in lugar) {
          const e = equipoDeJugador.get(lugar.jugador);
          if (e && slot.startsWith(`e${e}-`)) asign[slot] = lugar.jugador;
        }
        if ("invitado" in lugar && guardada) asign[slot] = `inv:${slot}`;
      }
      return asign;
    }
    return llenaSola ? ubicarTodos(parseFormacion(FORMACIONES_PRESET[futbol][0]) ?? [futbol - 1]) : {};
  });

  const enCancha = useMemo(() => new Set(Object.values(asignaciones)), [asignaciones]);
  // Convocados que no están en la formación guardada (se sumaron después): en la vista fija, se nombran.
  const sinUbicar = equipos.flatMap((e) => e.jugadores).filter((j) => !enCancha.has(j.id));

  /**
   * Cambia la formación conservando a los que ya estaban, en el mismo orden
   * (arquero, defensa… ataque): cada uno se desliza a su nuevo lugar. Con
   * llenaSola, los lugares nuevos se llenan con los que estaban afuera.
   */
  function reubicar(nuevasLineas: number[]) {
    const ordenes: Partial<Record<Equipo, string[]>> = {};
    for (const e of numeros) {
      const actual = ordenEnCancha(asignaciones, slotsBase.filter((s) => s.equipo === e));
      const afuera = llenaSola
        ? equipos[e - 1].jugadores.map((j) => j.id).filter((id) => !actual.includes(id))
        : [];
      ordenes[e] = [...actual, ...afuera];
    }
    setAsignaciones(ubicarTodos(nuevasLineas, ordenes));
    setPosiciones({});
    setSeleccion(null);
  }

  function elegirFutbol(n: number) {
    setFutbol(n);
    const preset = FORMACIONES_PRESET[n][0];
    setFormacion(preset);
    setUsandoCustom(false);
    setCustomError(null);
    reubicar(parseFormacion(preset)!);
  }

  function elegirFormacion(f: string) {
    setFormacion(f);
    setUsandoCustom(false);
    setCustomError(null);
    reubicar(parseFormacion(f)!);
  }

  function aplicarCustom() {
    const parsed = parseFormacion(customInput);
    if (!parsed) return setCustomError("Escribí números separados por guion, por ejemplo 2-2.");
    const suma = parsed.reduce((a, b) => a + b, 0);
    if (suma !== futbol - 1) {
      return setCustomError(`Tiene que sumar ${futbol - 1} (sin contar el arquero). Sumaste ${suma}.`);
    }
    setCustomError(null);
    setFormacion(customInput);
    reubicar(parsed);
  }

  /** Mezcla quién va en cada posición, dentro de cada equipo. */
  function mezclar() {
    const ordenes: Partial<Record<Equipo, string[]>> = {};
    for (const e of numeros) {
      const ids = equipos[e - 1].jugadores.map((j) => j.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      ordenes[e] = ids;
    }
    tap();
    setAsignaciones(ubicarTodos(lineas, ordenes));
    setPosiciones({});
    setSeleccion(null);
  }

  /** Pone a un jugador en una posición (de su equipo); si estaba ocupada, intercambian. */
  function mover(jugadorId: string, desde: string | null, hacia: string) {
    const destino = slots.find((s) => s.id === hacia);
    if (!destino || destino.equipo !== (equipoDe.get(jugadorId) ?? 1) || desde === hacia) {
      setSeleccion(null);
      return;
    }
    setAsignaciones((prev) => {
      const next = { ...prev };
      const ocupante = next[hacia];
      if (desde) {
        if (ocupante) next[desde] = ocupante;
        else delete next[desde];
      }
      next[hacia] = jugadorId;
      return next;
    });
    tap();
    setSeleccion(null);
  }

  function sacar(slotId: string) {
    setAsignaciones((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
    setSeleccion(null);
  }

  function tocarPosicion(slotId: string) {
    if (recienArrastro.current || fija) return;
    if (seleccion) {
      if (seleccion.slotId === slotId) return setSeleccion(null);
      return mover(seleccion.jugadorId, seleccion.slotId, slotId);
    }
    const ocupante = asignaciones[slotId];
    if (ocupante) setSeleccion({ jugadorId: ocupante, slotId });
    // Un lugar libre: el admin le puede poner un invitado (alguien que no es del grupo).
    else if (puedeGuardar) setNuevoInvitado({ slotId, nombre: "" });
  }

  function agregarInvitado() {
    if (!nuevoInvitado) return;
    const nombre = nuevoInvitado.nombre.trim().slice(0, MAX_NOMBRE_INVITADO);
    const slot = slots.find((s) => s.id === nuevoInvitado.slotId);
    if (!nombre || !slot) return setNuevoInvitado(null);
    const id = `inv:${nuevoInvitado.slotId}:${Date.now()}`;
    setInvitados((prev) => ({ ...prev, [id]: { nombre, equipo: slot.equipo } }));
    setAsignaciones((prev) => ({ ...prev, [slot.id]: id }));
    setNuevoInvitado(null);
    tap();
  }

  /** La formación como se guarda: quién va en cada posición (jugador o invitado) y lo movido a mano. */
  function comoGuardada(): FormacionGuardada {
    const lugares: FormacionGuardada["lugares"] = {};
    for (const [slot, id] of Object.entries(asignaciones)) {
      lugares[slot] = invitados[id] ? { invitado: invitados[id].nombre } : { jugador: id };
    }
    const movidas = Object.fromEntries(Object.entries(posiciones).map(([s, p]) => [s, { x: p.xPct, y: p.yPct }]));
    return { futbol, formacion: lineas.join("-"), lugares, posiciones: movidas };
  }

  async function guardar() {
    if (!partidoId) return;
    setGuardando(true);
    setMensaje(null);
    const r = await guardarFormacion({ partidoId, formacion: comoGuardada(), avisar });
    setGuardando(false);
    if ("error" in r && r.error) {
      setMensaje({ tipo: "error", texto: r.error });
      return;
    }
    exito();
    setMensaje({ tipo: "ok", texto: avisar ? "Formación guardada. Les avisamos a los convocados." : "Formación guardada." });
    router.refresh();
  }

  /** Saca a todos de la cancha (y los invitados) para ubicarlos de cero. */
  function vaciar() {
    setAsignaciones({});
    setInvitados({});
    setPosiciones({});
    setSeleccion(null);
    setUsandoPrevia(false);
  }

  async function borrarGuardada() {
    if (!partidoId || !window.confirm("Se borra la formación guardada: los jugadores ya no la van a ver. ¿Seguir?")) return;
    setGuardando(true);
    const r = await borrarFormacion(partidoId);
    setGuardando(false);
    if ("error" in r && r.error) return setMensaje({ tipo: "error", texto: r.error });
    vaciar();
    setMensaje({ tipo: "ok", texto: "Listo: se borró la formación guardada." });
    router.refresh();
  }

  function tocarBanco(jugadorId: string) {
    if (recienArrastro.current) return;
    setSeleccion((prev) => (prev?.jugadorId === jugadorId && !prev.slotId ? null : { jugadorId, slotId: null }));
  }

  function marcarArrastre() {
    recienArrastro.current = true;
    setTimeout(() => (recienArrastro.current = false), 0);
  }

  function alMover(e: React.PointerEvent) {
    if (!arrastre || e.pointerId !== arrastre.pointerId) return;
    if (arrastre.tipo === "banco") {
      setArrastre({ ...arrastre, x: e.clientX, y: e.clientY });
      return;
    }
    const rect = canchaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xPct = clamp(((e.clientX - rect.left) / rect.width) * 100, 5, 95);
    const yPct = clamp(((e.clientY - rect.top) / rect.height) * 100, 5, 95);
    setPosiciones((prev) => ({ ...prev, [arrastre.slotId]: { xPct, yPct } }));
    if (!arrastre.movio) setArrastre({ ...arrastre, movio: true });
  }

  function alSoltar(e: React.PointerEvent) {
    if (!arrastre || e.pointerId !== arrastre.pointerId) return;
    if (arrastre.tipo === "banco") {
      if (Math.hypot(e.clientX - arrastre.x0, e.clientY - arrastre.y0) > UMBRAL_ARRASTRE) {
        marcarArrastre();
        const slotEl = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-slot-id]");
        if (slotEl) mover(arrastre.jugadorId, null, slotEl.dataset.slotId!);
      }
    } else if (arrastre.movio) {
      marcarArrastre();
    }
    setArrastre(null);
  }

  async function compartir() {
    if (exportando) return;
    setExportando(true);
    try {
      await exportarCancha({
        slots,
        asignaciones,
        jugadorPorId,
        titulo: titulo ?? `Fútbol ${futbol} · ${lineas.join("-")}`,
        subtitulo: subtitulo ?? (titulo ? `Fútbol ${futbol} · ${lineas.join("-")}` : undefined),
        nombresEquipos: dosEquipos ? [equipos[0].nombre, equipos[1].nombre] : undefined,
        archivo,
      });
    } finally {
      setExportando(false);
    }
  }

  const arrastrado = arrastre?.tipo === "banco" ? jugadorPorId.get(arrastre.jugadorId) : undefined;
  const slotArrastrado = arrastre?.tipo === "cancha" ? arrastre.slotId : null;
  const tamanio = dosEquipos && futbol >= 8 ? 32 : dosEquipos ? 36 : 42;
  const chip = (activo: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
      activo
        ? "border-primary-500/40 bg-primary-500/15 text-primary-400"
        : "border-border bg-white/5 text-zinc-400 hover:text-white"
    }`;

  return (
    <div onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={() => setArrastre(null)} className="flex flex-col gap-4">
      {/* El admin arranca con las posiciones del partido anterior: los que vuelven, en el mismo lugar. */}
      {usandoPrevia && previa && (
        <Card className="flex items-center justify-between gap-3 border-gold-500/20 px-4 py-3">
          <p className="text-sm text-zinc-300">
            Repetimos las posiciones del partido del{" "}
            <span className="font-semibold text-white">{previa.fecha.slice(8, 10)}/{Number(previa.fecha.slice(5, 7))}</span>
            {sinUbicar.length > 0 ? ". Los que no jugaron ese partido están abajo, por ubicar." : "."}
          </p>
          <button
            type="button"
            onClick={vaciar}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white"
          >
            Empezar vacía
          </button>
        </Card>
      )}
      {puedeGuardar && !guardada && !usandoPrevia && enCancha.size === 0 && (
        <Card className="px-4 py-3 text-sm text-zinc-300">
          Ubicá a cada uno en su posición: tocá a un jugador de abajo y después el lugar donde juega.
        </Card>
      )}
      {fija && guardada && (
        <Card className="flex items-center gap-3 border-primary-500/25 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-sm font-extrabold text-primary-400">
            {guardada.futbol}
          </span>
          <p className="text-sm text-zinc-300">
            Formación armada por el admin:{" "}
            <span className="font-semibold text-white">
              fútbol {guardada.futbol}, {guardada.formacion}
            </span>
            .
            {sinUbicar.length > 0 && (
              <span className="mt-1 block text-xs text-zinc-500">
                También {sinUbicar.length === 1 ? "está convocado" : "están convocados"}: {sinUbicar.map((j) => j.apodo).join(", ")}.
              </span>
            )}
          </p>
        </Card>
      )}
      {!fija && (
      <Card className="flex flex-col gap-3 p-4">
        {puedeGuardar && <p className="-mb-1 text-sm font-semibold text-white">¿De cuánto se juega?</p>}
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {FUTBOL_OPCIONES.map((n) => (
            <button key={n} type="button" onClick={() => elegirFutbol(n)} className={chip(futbol === n)}>
              Fútbol {n}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FORMACIONES_PRESET[futbol].map((f) => (
            <button key={f} type="button" onClick={() => elegirFormacion(f)} className={chip(!usandoCustom && formacion === f)}>
              {f}
            </button>
          ))}
          <button type="button" onClick={() => setUsandoCustom(true)} className={chip(usandoCustom)}>
            Otra
          </button>
          {autoUbicar && (
            <button
              type="button"
              onClick={mezclar}
              className="ml-auto rounded-lg border border-gold-500/30 bg-gold-500/10 px-3 py-1.5 text-sm font-semibold text-gold-400 transition hover:bg-gold-500/20"
            >
              Mezclar
            </button>
          )}
        </div>
        {usandoCustom && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={futbol - 1 === 4 ? "2-2" : "3-2-1"}
              className="w-full rounded-xl border border-border bg-white/5 px-3.5 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20 sm:w-40"
            />
            <Button type="button" size="sm" onClick={aplicarCustom}>
              Aplicar
            </Button>
            {customError && <p className="text-xs text-danger-400">{customError}</p>}
          </div>
        )}
      </Card>
      )}

      <div>
        {dosEquipos && (
          <p className="mb-1.5 text-center text-xs font-semibold tracking-wide uppercase">
            <span className={COLOR_EQUIPO[2].texto}>{equipos[1].nombre}</span>
          </p>
        )}
        <div
          ref={canchaRef}
          className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 shadow-xl shadow-black/40"
          style={{
            aspectRatio: "5 / 7",
            // Pasto cortado en franjas, como en la tele.
            background: "repeating-linear-gradient(180deg, #1d7a3e 0 7.142857%, #18703a 7.142857% 14.285714%)",
          }}
        >
          <LineasCancha />
          {/* Las posiciones vacías: se tocan o se les suelta un jugador encima. */}
          {slots
            .filter((s) => !asignaciones[s.id])
            .map((s) => (
              <button
                key={s.id}
                type="button"
                data-slot-id={s.id}
                onClick={() => tocarPosicion(s.id)}
                disabled={fija}
                aria-label={
                  s.arquero ? "Arquero (vacío)" : puedeGuardar ? "Posición libre: tocá para poner un invitado" : "Posición vacía"
                }
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed text-[10px] font-bold transition ${
                  nuevoInvitado?.slotId === s.id || (seleccion && (equipoDe.get(seleccion.jugadorId) ?? 1) === s.equipo)
                    ? "animate-pulse border-white bg-white/25 text-white"
                    : "border-white/45 bg-black/15 text-white/70"
                }`}
                style={{ left: `${s.xPct}%`, top: `${s.yPct}%`, width: tamanio, height: tamanio }}
              >
                {s.arquero ? "ARQ" : "+"}
              </button>
            ))}
          {/* Los jugadores: una ficha por jugador, que se desliza a su lugar al cambiar la formación. */}
          {slots
            .filter((s) => asignaciones[s.id])
            .map((s) => {
              const jugador = jugadorPorId.get(asignaciones[s.id]);
              if (!jugador) return null;
              const equipo = s.equipo;
              const elegido = seleccion?.slotId === s.id;
              return (
                <div
                  key={jugador.id}
                  data-slot-id={s.id}
                  onClick={() => tocarPosicion(s.id)}
                  onPointerDown={(e) => {
                    if (fija) return;
                    (e.target as Element).setPointerCapture(e.pointerId);
                    setArrastre({ tipo: "cancha", slotId: s.id, pointerId: e.pointerId, movio: false });
                  }}
                  className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 ${
                    fija ? "" : "cursor-grab active:cursor-grabbing"
                  }`}
                  style={{
                    left: `${s.xPct}%`,
                    top: `${s.yPct}%`,
                    touchAction: "none",
                    zIndex: elegido || slotArrastrado === s.id ? 10 : 1,
                    transition:
                      slotArrastrado === s.id ? "none" : "left 420ms var(--ease-pop), top 420ms var(--ease-pop)",
                  }}
                >
                  {/* El marco del color del equipo (verde abajo, dorado arriba); blanco si está elegido. */}
                  <span
                    className={`rounded-full p-[2.5px] shadow-lg shadow-black/40 transition ${
                      elegido ? "scale-110 bg-white" : invitados[jugador.id] ? "bg-zinc-300" : COLOR_EQUIPO[equipo].marco
                    }`}
                    title={invitados[jugador.id] ? "Invitado" : undefined}
                  >
                    <Avatar src={jugador.foto_url} alt={jugador.apodo} size={tamanio} className="ring-0" />
                  </span>
                  <span className="max-w-[76px] truncate rounded-md bg-black/70 px-1.5 py-px text-[10px] font-semibold text-white">
                    {jugador.apodo}
                  </span>
                </div>
              );
            })}
        </div>
        {dosEquipos && (
          <p className="mt-1.5 text-center text-xs font-semibold tracking-wide uppercase">
            <span className={COLOR_EQUIPO[1].texto}>{equipos[0].nombre}</span>
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-3 px-1">
          <p className={`text-xs ${seleccion ? "text-primary-400" : "text-zinc-500"}`}>
            {fija
              ? "Así forman en este partido."
              : seleccion
                ? "Tocá la posición donde lo querés (si está ocupada, cambian de lugar)."
                : puedeGuardar
                  ? "Arrastrá o tocá para mover. En un lugar libre (+) podés poner un invitado."
                  : "Arrastrá a cualquiera para moverlo, o tocalo y después tocá dónde va."}
          </p>
          {seleccion?.slotId && (
            <button type="button" onClick={() => sacar(seleccion.slotId!)} className="shrink-0 text-xs font-medium text-zinc-400 hover:text-white">
              Sacar
            </button>
          )}
        </div>
      </div>

      {/* El nombre de un invitado para el lugar libre que tocó el admin. */}
      {nuevoInvitado && (
        <Card className="entrada flex flex-col gap-2 border-white/20 p-4">
          <p className="text-sm font-semibold text-white">Invitado en este lugar</p>
          <p className="-mt-1 text-xs text-zinc-500">Alguien que no es del grupo: solo para que se vea en la cancha.</p>
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={nuevoInvitado.nombre}
              maxLength={MAX_NOMBRE_INVITADO}
              onChange={(e) => setNuevoInvitado({ ...nuevoInvitado, nombre: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && agregarInvitado()}
              placeholder="Nombre (por ejemplo, Primo de Juan)"
              className="min-w-0 flex-1 rounded-xl border border-border bg-white/5 px-3.5 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
            />
            <Button type="button" size="sm" onClick={agregarInvitado} disabled={!nuevoInvitado.nombre.trim()}>
              Poner
            </Button>
          </div>
          <button type="button" onClick={() => setNuevoInvitado(null)} className="self-start text-xs text-zinc-500 hover:text-white">
            Cancelar
          </button>
        </Card>
      )}

      {/* El admin guarda la formación (opcional): desde ahí todos la ven igual. */}
      {puedeGuardar && (
        <Card className="flex flex-col gap-3 p-4">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={avisar}
              onChange={(e) => setAvisar(e.target.checked)}
              className="h-4 w-4 accent-primary-500"
            />
            Avisar a los convocados
          </label>
          <Button type="button" onClick={guardar} disabled={guardando} className="w-full">
            {guardando && <Pelotita />} {guardando ? "Guardando…" : guardada ? "Guardar cambios" : "Guardar formación"}
          </Button>
          {guardada && (
            <button
              type="button"
              onClick={borrarGuardada}
              disabled={guardando}
              className="self-center text-xs font-medium text-zinc-500 hover:text-danger-400"
            >
              Borrar la formación guardada
            </button>
          )}
          {mensaje && (
            <p
              className={`rounded-xl border px-3.5 py-2.5 text-sm ${
                mensaje.tipo === "ok"
                  ? "border-primary-500/20 bg-primary-500/10 text-primary-400"
                  : "border-danger-500/20 bg-danger-500/10 text-danger-400"
              }`}
            >
              {mensaje.texto}
            </p>
          )}
          {!guardada && (
            <p className="text-center text-[11px] text-zinc-500">
              Hasta que la guardes, los jugadores ven La cancha armada sola, sin posiciones.
            </p>
          )}
        </Card>
      )}

      {/* Los que no están en la cancha, por equipo. */}
      {(fija ? [] : numeros).map((e) => {
        const afuera = equipos[e - 1].jugadores.filter((j) => !enCancha.has(j.id));
        if (afuera.length === 0 && (llenaSola || dosEquipos)) return null;
        const equipoNombre = dosEquipos ? ` · ${equipos[e - 1].nombre}` : "";
        return (
          <Card key={e} className="p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className={`text-xs font-semibold tracking-wide uppercase ${dosEquipos ? COLOR_EQUIPO[e].texto : "text-zinc-400"}`}>
                {llenaSola ? `Suplentes${equipoNombre}` : puedeGuardar ? `Por ubicar${equipoNombre}` : "Plantel"}
              </p>
              {!llenaSola && enCancha.size > 0 && e === numeros[0] && (
                <button
                  type="button"
                  onClick={vaciar}
                  className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-danger-400"
                >
                  <IconTrash className="h-3.5 w-3.5" /> Vaciar cancha
                </button>
              )}
            </div>
            {afuera.length === 0 ? (
              <p className="py-1 text-sm text-zinc-500">Todos en la cancha.</p>
            ) : (
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {afuera.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => tocarBanco(j.id)}
                    onPointerDown={(ev) => {
                      (ev.target as Element).setPointerCapture(ev.pointerId);
                      setArrastre({ tipo: "banco", jugadorId: j.id, pointerId: ev.pointerId, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY });
                    }}
                    style={{ touchAction: "pan-x" }}
                    className={`entrada flex shrink-0 flex-col items-center gap-1 rounded-xl border px-2 py-2 transition select-none ${
                      seleccion?.jugadorId === j.id && !seleccion.slotId
                        ? "border-primary-500/50 bg-primary-500/10"
                        : "border-transparent hover:border-border"
                    }`}
                  >
                    <Avatar src={j.foto_url} alt={j.apodo} size={44} />
                    <span className="max-w-[64px] truncate text-[11px] text-zinc-300">{j.apodo}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      <Button type="button" onClick={compartir} disabled={exportando} className="w-full">
        {exportando ? <Pelotita /> : <IconDownload className="h-4 w-4" />} {exportando ? "Armando la imagen…" : "Compartir imagen"}
      </Button>

      {arrastrado && arrastre?.tipo === "banco" && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
          style={{ left: arrastre.x, top: arrastre.y }}
        >
          <Avatar src={arrastrado.foto_url} alt={arrastrado.apodo} size={48} className="scale-110 opacity-90 ring-2 ring-primary-400" />
        </div>
      )}
    </div>
  );
}

export type { Slot };
