"use client";

import { useMemo, useRef, useState } from "react";
import type { Profile } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { IconDownload, IconTrash } from "@/components/icons";

const FUTBOL_OPCIONES = [5, 6, 7, 8, 9] as const;

const FORMACIONES_PRESET: Record<number, string[]> = {
  5: ["2-2", "3-1", "1-2-1"],
  6: ["2-2-1", "1-3-1", "3-2"],
  7: ["3-2-1", "2-3-1", "2-2-2"],
  8: ["3-3-1", "2-3-2", "3-2-2"],
  9: ["3-3-2", "4-3-1", "3-4-1"],
};

interface Slot {
  id: string;
  xPct: number;
  yPct: number;
  role: "GK" | "LINE";
}

type Seleccion =
  | { origen: "roster"; jugadorId: string }
  | { origen: "slot"; jugadorId: string; slotId: string };

type DragState =
  | { kind: "roster"; jugadorId: string; pointerId: number; startX: number; startY: number; x: number; y: number }
  | { kind: "slot"; slotId: string; pointerId: number; moved: boolean };

const DRAG_THRESHOLD = 8;
const POS_MIN = 5;
const POS_MAX = 95;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function parseFormacion(input: string): number[] | null {
  const partes = input
    .split(/[^0-9]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(Number);
  if (partes.length === 0 || partes.some((n) => !Number.isInteger(n) || n <= 0)) return null;
  return partes;
}

function evenlySpacedX(count: number): number[] {
  const xMin = 12;
  const xMax = 88;
  const width = xMax - xMin;
  return Array.from({ length: count }, (_, i) => xMin + (i + 0.5) * (width / count));
}

function buildSlots(lineas: number[]): Slot[] {
  const slots: Slot[] = [{ id: "gk", xPct: 50, yPct: 92, role: "GK" }];
  const yBottom = 76;
  const yTop = 14;
  const numLineas = lineas.length;

  lineas.forEach((cantidad, lineaIdx) => {
    const t = numLineas === 1 ? 0 : lineaIdx / (numLineas - 1);
    const y = yBottom - t * (yBottom - yTop);
    evenlySpacedX(cantidad).forEach((x, i) => {
      slots.push({ id: `l${lineaIdx}-${i}`, xPct: x, yPct: y, role: "LINE" });
    });
  });

  return slots;
}

const CANVAS_W = 900;
const CANVAS_H = 1260;

function dibujarCancha(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#1e7a3d";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const franjas = 12;
  for (let i = 0; i < franjas; i++) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fillRect(0, (CANVAS_H / franjas) * i, CANVAS_W, CANVAS_H / franjas);
  }

  const margin = 36;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 4;
  ctx.strokeRect(margin, margin, CANVAS_W - margin * 2, CANVAS_H - margin * 2);

  ctx.beginPath();
  ctx.moveTo(margin, CANVAS_H / 2);
  ctx.lineTo(CANVAS_W - margin, CANVAS_H / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, CANVAS_H / 2, 90, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, CANVAS_H / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();

  const boxW = 360;
  const boxH = 130;
  const smallW = 190;
  const smallH = 55;
  // Área arriba (rival)
  ctx.strokeRect(CANVAS_W / 2 - boxW / 2, margin, boxW, boxH);
  ctx.strokeRect(CANVAS_W / 2 - smallW / 2, margin, smallW, smallH);
  // Área abajo (nuestra)
  ctx.strokeRect(CANVAS_W / 2 - boxW / 2, CANVAS_H - margin - boxH, boxW, boxH);
  ctx.strokeRect(CANVAS_W / 2 - smallW / 2, CANVAS_H - margin - smallH, smallW, smallH);
}

function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default function FormacionBuilder({ jugadores }: { jugadores: Profile[] }) {
  const [futbol, setFutbol] = useState<number>(5);
  const [formacionStr, setFormacionStr] = useState<string>(FORMACIONES_PRESET[5][0]);
  const [customInput, setCustomInput] = useState("");
  const [usandoCustom, setUsandoCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [posiciones, setPosiciones] = useState<Record<string, { xPct: number; yPct: number }>>({});
  const [seleccionado, setSeleccionado] = useState<Seleccion | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  const pitchRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const justDraggedRef = useRef(false);

  function marcarJustDragged() {
    justDraggedRef.current = true;
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);
  }

  const outfield = futbol - 1;

  const lineas = useMemo(() => {
    const parsed = parseFormacion(formacionStr);
    return parsed ?? [outfield];
  }, [formacionStr, outfield]);

  const slotsBase = useMemo(() => buildSlots(lineas), [lineas]);

  const slots = useMemo(
    () => slotsBase.map((s) => ({ ...s, ...(posiciones[s.id] ?? {}) })),
    [slotsBase, posiciones]
  );

  const jugadorPorId = useMemo(() => {
    const map = new Map<string, Profile>();
    jugadores.forEach((j) => map.set(j.id, j));
    return map;
  }, [jugadores]);

  const asignadosIds = useMemo(() => new Set(Object.values(asignaciones)), [asignaciones]);
  const disponibles = jugadores.filter((j) => !asignadosIds.has(j.id));

  function elegirFutbol(n: number) {
    setFutbol(n);
    const preset = FORMACIONES_PRESET[n][0];
    setFormacionStr(preset);
    setUsandoCustom(false);
    setCustomError(null);
    setAsignaciones({});
    setPosiciones({});
    setSeleccionado(null);
  }

  function elegirFormacion(f: string) {
    setFormacionStr(f);
    setUsandoCustom(false);
    setCustomError(null);
    setAsignaciones({});
    setPosiciones({});
    setSeleccionado(null);
  }

  function aplicarCustom() {
    const parsed = parseFormacion(customInput);
    if (!parsed) {
      setCustomError("Escribí números separados por guion, ej: 2-2");
      return;
    }
    const suma = parsed.reduce((a, b) => a + b, 0);
    if (suma !== outfield) {
      setCustomError(`Tiene que sumar ${outfield} (sin contar el arquero). Sumaste ${suma}.`);
      return;
    }
    setCustomError(null);
    setFormacionStr(customInput);
    setAsignaciones({});
    setPosiciones({});
    setSeleccionado(null);
  }

  function moverJugador(jugadorId: string, origenSlotId: string | null, destinoSlotId: string) {
    if (origenSlotId === destinoSlotId) {
      setSeleccionado(null);
      return;
    }
    setAsignaciones((prev) => {
      const next = { ...prev };
      const ocupanteDestino = next[destinoSlotId];
      if (origenSlotId) {
        if (ocupanteDestino) {
          next[origenSlotId] = ocupanteDestino;
        } else {
          delete next[origenSlotId];
        }
      }
      next[destinoSlotId] = jugadorId;
      return next;
    });
    setSeleccionado(null);
  }

  function sacarDeCancha(slotId: string) {
    setAsignaciones((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
    setSeleccionado(null);
  }

  function limpiarCancha() {
    setAsignaciones({});
    setSeleccionado(null);
  }

  function restablecerPosiciones() {
    setPosiciones({});
  }

  function handleChipClick(jugadorId: string) {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    setSeleccionado((prev) =>
      prev && prev.origen === "roster" && prev.jugadorId === jugadorId
        ? null
        : { origen: "roster", jugadorId }
    );
  }

  function handleSlotClick(slotId: string) {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    const ocupante = asignaciones[slotId];

    if (seleccionado) {
      if (seleccionado.origen === "slot" && seleccionado.slotId === slotId) {
        setSeleccionado(null);
        return;
      }
      moverJugador(
        seleccionado.jugadorId,
        seleccionado.origen === "slot" ? seleccionado.slotId : null,
        slotId
      );
      return;
    }

    if (ocupante) {
      setSeleccionado({ origen: "slot", jugadorId: ocupante, slotId });
    }
  }

  function iniciarDragRoster(e: React.PointerEvent, jugadorId: string) {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({
      kind: "roster",
      jugadorId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
    });
  }

  function iniciarDragSlot(e: React.PointerEvent, slotId: string) {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ kind: "slot", slotId, pointerId: e.pointerId, moved: false });
  }

  function handleWrapperPointerMove(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;

    if (drag.kind === "roster") {
      setDrag((d) => (d && d.kind === "roster" ? { ...d, x: e.clientX, y: e.clientY } : d));
      return;
    }

    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xPct = clamp(((e.clientX - rect.left) / rect.width) * 100, POS_MIN, POS_MAX);
    const yPct = clamp(((e.clientY - rect.top) / rect.height) * 100, POS_MIN, POS_MAX);
    setPosiciones((prev) => ({ ...prev, [drag.slotId]: { xPct, yPct } }));
    if (!drag.moved) setDrag((d) => (d && d.kind === "slot" ? { ...d, moved: true } : d));
  }

  function handleWrapperPointerUp(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;

    if (drag.kind === "roster") {
      const distancia = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (distancia > DRAG_THRESHOLD) {
        marcarJustDragged();
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const slotEl = el?.closest<HTMLElement>("[data-slot-id]");
        if (slotEl) {
          moverJugador(drag.jugadorId, null, slotEl.dataset.slotId!);
        }
      }
    } else if (drag.moved) {
      marcarJustDragged();
    }

    setDrag(null);
  }

  async function descargarImagen() {
    const canvas = canvasRef.current;
    if (!canvas || descargando) return;
    setDescargando(true);

    try {
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imagenesPorSlot = new Map<string, HTMLImageElement>();
      await Promise.all(
        slots.map(async (slot) => {
          const jugadorId = asignaciones[slot.id];
          const jugador = jugadorId ? jugadorPorId.get(jugadorId) : undefined;
          if (!jugador?.foto_url) return;
          const img = await cargarImagen(jugador.foto_url);
          if (img) imagenesPorSlot.set(slot.id, img);
        })
      );

      dibujarCancha(ctx);

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, CANVAS_W, 70);
      ctx.fillStyle = "white";
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Fútbol ${futbol} · ${lineas.join("-")}`, CANVAS_W / 2, 47);

      slots.forEach((slot) => {
        const px = (slot.xPct / 100) * CANVAS_W;
        const py = (slot.yPct / 100) * CANVAS_H;
        const jugadorId = asignaciones[slot.id];
        const jugador = jugadorId ? jugadorPorId.get(jugadorId) : undefined;
        const foto = imagenesPorSlot.get(slot.id);
        const radius = 46;

        if (jugador && foto) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(foto, px - radius, py - radius, radius * 2, radius * 2);
          ctx.restore();
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.lineWidth = 4;
          ctx.strokeStyle = "white";
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fillStyle = jugador ? "#e11d48" : "rgba(255,255,255,0.15)";
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = "white";
          ctx.stroke();

          ctx.fillStyle = "white";
          ctx.font = "bold 34px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            jugador ? jugador.apodo.slice(0, 1).toUpperCase() : slot.role === "GK" ? "A" : "?",
            px,
            py + 2
          );
        }

        const label = jugador ? jugador.apodo : slot.role === "GK" ? "Arquero" : "";
        if (label) {
          ctx.font = "bold 22px sans-serif";
          ctx.textAlign = "center";
          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(px - textWidth / 2 - 8, py + radius + 8, textWidth + 16, 30);
          ctx.fillStyle = "white";
          ctx.textBaseline = "middle";
          ctx.fillText(label, px, py + radius + 23);
        }
      });

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("Goleadores ⚽", CANVAS_W - 24, CANVAS_H - 20);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `formacion-futbol${futbol}-${lineas.join("-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargando(false);
    }
  }

  const jugadorArrastrado = drag?.kind === "roster" ? jugadorPorId.get(drag.jugadorId) : undefined;
  const hayPosicionesCustom = Object.keys(posiciones).length > 0;

  return (
    <div
      onPointerMove={handleWrapperPointerMove}
      onPointerUp={handleWrapperPointerUp}
      onPointerCancel={() => setDrag(null)}
      className="flex flex-col gap-5"
    >
      <Card className="flex flex-col gap-4 p-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase">
            Cantidad de jugadores
          </p>
          <div className="flex flex-wrap gap-2">
            {FUTBOL_OPCIONES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => elegirFutbol(n)}
                className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition ${
                  futbol === n
                    ? "border-primary-500/40 bg-primary-500/15 text-primary-400"
                    : "border-border bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                Fútbol {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase">
            Formación ({outfield} + arquero)
          </p>
          <div className="flex flex-wrap gap-2">
            {FORMACIONES_PRESET[futbol].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => elegirFormacion(f)}
                className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition ${
                  !usandoCustom && formacionStr === f
                    ? "border-primary-500/40 bg-primary-500/15 text-primary-400"
                    : "border-border bg-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUsandoCustom(true)}
              className={`rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition ${
                usandoCustom
                  ? "border-primary-500/40 bg-primary-500/15 text-primary-400"
                  : "border-border bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              Personalizada
            </button>
          </div>
          {usandoCustom && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={`ej: ${outfield === 4 ? "2-2" : "3-2-1"}`}
                className="w-full rounded-xl border border-border bg-white/5 px-3.5 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20 sm:w-40"
              />
              <Button type="button" size="sm" onClick={aplicarCustom}>
                Aplicar
              </Button>
              {customError && <p className="text-xs text-danger-400">{customError}</p>}
            </div>
          )}
        </div>
      </Card>

      <div>
        <div
          ref={pitchRef}
          className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/30"
          style={{ aspectRatio: "5 / 7", background: "#1e7a3d" }}
        >
          <PitchLines />
          {slots.map((slot) => {
            const jugadorId = asignaciones[slot.id];
            const jugador = jugadorId ? jugadorPorId.get(jugadorId) : undefined;
            const seleccionadoAca =
              seleccionado?.origen === "slot" && seleccionado.slotId === slot.id;
            return (
              <div
                key={slot.id}
                data-slot-id={slot.id}
                onClick={() => handleSlotClick(slot.id)}
                onPointerDown={(e) => iniciarDragSlot(e, slot.id)}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center gap-1 active:cursor-grabbing"
                style={{
                  left: `${slot.xPct}%`,
                  top: `${slot.yPct}%`,
                  touchAction: "none",
                }}
              >
                {jugador ? (
                  <>
                    <Avatar
                      src={jugador.foto_url}
                      alt={jugador.apodo}
                      size={40}
                      className={`ring-2 select-none ${
                        seleccionadoAca ? "ring-primary-400" : "ring-white/60"
                      }`}
                    />
                    <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white">
                      {jugador.apodo}
                    </span>
                  </>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-white/50 bg-black/15 text-[10px] font-semibold text-white/70">
                    {slot.role === "GK" ? "ARQ" : "+"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between px-1">
          <p className="text-xs text-zinc-500">Arrastrá cada posición para acomodarla a tu gusto.</p>
          {hayPosicionesCustom && (
            <button
              type="button"
              onClick={restablecerPosiciones}
              className="text-xs font-medium text-zinc-500 hover:text-white"
            >
              Restablecer posiciones
            </button>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
            Plantel disponible{" "}
            {seleccionado ? "· tocá una posición para ubicarlo o moverlo" : ""}
          </p>
          <div className="flex items-center gap-3">
            {seleccionado?.origen === "slot" && (
              <button
                type="button"
                onClick={() => sacarDeCancha(seleccionado.slotId)}
                className="text-xs font-medium text-primary-400 hover:text-primary-300"
              >
                Sacar de la cancha
              </button>
            )}
            <button
              type="button"
              onClick={limpiarCancha}
              className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-danger-400"
            >
              <IconTrash className="h-3.5 w-3.5" /> Limpiar
            </button>
          </div>
        </div>
        {disponibles.length === 0 ? (
          <p className="py-2 text-sm text-zinc-500">Todos ubicados en la cancha.</p>
        ) : (
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {disponibles.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => handleChipClick(j.id)}
                onPointerDown={(e) => iniciarDragRoster(e, j.id)}
                style={{ touchAction: "pan-x" }}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-xl border px-2 py-2 transition select-none ${
                  seleccionado?.origen === "roster" && seleccionado.jugadorId === j.id
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

      <Button type="button" onClick={descargarImagen} disabled={descargando} className="w-full">
        <IconDownload className="h-4 w-4" /> {descargando ? "Generando imagen..." : "Descargar imagen"}
      </Button>

      <canvas ref={canvasRef} className="hidden" />

      {drag?.kind === "roster" && jugadorArrastrado && (
        <div
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
          style={{ left: drag.x, top: drag.y }}
        >
          <Avatar
            src={jugadorArrastrado.foto_url}
            alt={jugadorArrastrado.apodo}
            size={48}
            className="opacity-90 ring-2 ring-primary-400"
          />
        </div>
      )}
    </div>
  );
}

function PitchLines() {
  return (
    <svg
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <rect
        x="4"
        y="4"
        width="92"
        height="132"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="0.6"
      />
      <line x1="4" y1="70" x2="96" y2="70" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
      <circle cx="50" cy="70" r="10" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
      <circle cx="50" cy="70" r="0.6" fill="rgba(255,255,255,0.55)" />
      <rect
        x="26"
        y="4"
        width="48"
        height="16"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="0.6"
      />
      <rect
        x="26"
        y="120"
        width="48"
        height="16"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="0.6"
      />
    </svg>
  );
}
