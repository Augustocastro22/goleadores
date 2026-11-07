import type { Profile } from "@/lib/types";
import type { Slot } from "@/lib/cancha";

/**
 * La cancha como imagen de historia (1080×1920): título arriba, la cancha
 * con las franjas de pasto y los jugadores, y la marca abajo. En el celular
 * abre el menú de compartir (WhatsApp, Instagram…); si no se puede, la descarga.
 */
const W = 1080;
const H = 1920;
const COLORES = { 1: "#34d399", 2: "#fbbf24" } as const;

function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function rectRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** La cancha en (x, y, w, h): franjas y líneas de cal (mismas proporciones que LineasCancha). */
function dibujarCancha(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  rectRedondeado(ctx, x, y, w, h, 36);
  ctx.clip();
  const franjas = 14;
  for (let i = 0; i < franjas; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#1d7a3e" : "#18703a";
    ctx.fillRect(x, y + (h / franjas) * i, w, h / franjas + 1);
  }
  const sx = w / 100;
  const sy = h / 140;
  const px = (v: number) => x + v * sx;
  const py = (v: number) => y + v * sy;
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 5;
  ctx.strokeRect(px(4), py(4), 92 * sx, 132 * sy);
  ctx.beginPath();
  ctx.moveTo(px(4), py(70));
  ctx.lineTo(px(96), py(70));
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(px(50), py(70), 11 * sx, 11 * sx, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (const abajo of [false, true]) {
    const yy = (v: number) => (abajo ? py(140 - v) : py(v));
    ctx.strokeRect(px(24), abajo ? yy(24) : yy(4), 52 * sx, 20 * sy);
    ctx.strokeRect(px(37), abajo ? yy(11) : yy(4), 26 * sx, 7 * sy);
    ctx.beginPath();
    ctx.ellipse(px(50), yy(24), 9 * sx, 9 * sx * 0.75, 0, abajo ? Math.PI : 0, abajo ? Math.PI * 2 : Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

export async function exportarCancha({
  slots,
  asignaciones,
  jugadorPorId,
  titulo,
  subtitulo,
  nombresEquipos,
  archivo,
}: {
  slots: Slot[];
  asignaciones: Record<string, string>;
  jugadorPorId: Map<string, Profile>;
  titulo: string;
  subtitulo?: string;
  nombresEquipos?: [string, string];
  archivo: string;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const fotos = new Map<string, HTMLImageElement>();
  await Promise.all(
    Object.values(asignaciones).map(async (id) => {
      const url = jugadorPorId.get(id)?.foto_url;
      const img = url ? await cargarImagen(url) : null;
      if (img) fotos.set(id, img);
    })
  );

  // Fondo.
  ctx.fillStyle = "#08090c";
  ctx.fillRect(0, 0, W, H);
  const brillo = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 900);
  brillo.addColorStop(0, "rgba(16,185,129,0.22)");
  brillo.addColorStop(1, "rgba(16,185,129,0)");
  ctx.fillStyle = brillo;
  ctx.fillRect(0, 0, W, H);

  const fuente = getComputedStyle(document.body).fontFamily || "sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Título.
  if (subtitulo) {
    ctx.fillStyle = "#34d399";
    ctx.font = `600 34px ${fuente}`;
    ctx.fillText(subtitulo.toUpperCase(), W / 2, 150);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 76px ${fuente}`;
  ctx.fillText(titulo, W / 2, 240, W - 120);

  // Cancha.
  const cx = 70;
  const cw = W - 140;
  const ch = Math.min(cw * 1.4, 1460);
  const cy = 300 + (nombresEquipos ? 40 : 0);
  dibujarCancha(ctx, cx, cy, cw, ch);

  if (nombresEquipos) {
    ctx.font = `700 34px ${fuente}`;
    ctx.fillStyle = COLORES[2];
    ctx.fillText(nombresEquipos[1].toUpperCase(), W / 2, cy - 18);
    ctx.fillStyle = COLORES[1];
    ctx.fillText(nombresEquipos[0].toUpperCase(), W / 2, cy + ch + 52);
  }

  // Jugadores.
  const radio = slots.length > 16 ? 44 : 56;
  for (const slot of slots) {
    const id = asignaciones[slot.id];
    const jugador = id ? jugadorPorId.get(id) : undefined;
    if (!jugador) continue;
    const x = cx + (slot.xPct / 100) * cw;
    const y = cy + (slot.yPct / 100) * ch;
    const color = COLORES[slot.equipo];

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(x, y, radio + 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    const foto = fotos.get(jugador.id);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radio, 0, Math.PI * 2);
    ctx.clip();
    if (foto) {
      ctx.drawImage(foto, x - radio, y - radio, radio * 2, radio * 2);
    } else {
      ctx.fillStyle = "#0f2a1f";
      ctx.fillRect(x - radio, y - radio, radio * 2, radio * 2);
      ctx.fillStyle = color;
      ctx.font = `800 ${radio}px ${fuente}`;
      ctx.textBaseline = "middle";
      ctx.fillText(jugador.apodo.slice(0, 1).toUpperCase(), x, y + 2);
    }
    ctx.restore();

    ctx.font = `700 28px ${fuente}`;
    ctx.textBaseline = "middle";
    const ancho = Math.min(ctx.measureText(jugador.apodo).width, 220) + 28;
    rectRedondeado(ctx, x - ancho / 2, y + radio + 12, ancho, 42, 12);
    ctx.fillStyle = "rgba(8,9,12,0.8)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(jugador.apodo, x, y + radio + 34, 220);
    ctx.textBaseline = "alphabetic";
  }

  ctx.fillStyle = "rgba(110,231,183,0.85)";
  ctx.font = `600 32px ${fuente}`;
  ctx.fillText("goleadores.ar", W / 2, H - 70);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const file = new File([blob], `${archivo}.png`, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titulo });
      return;
    } catch (e) {
      // Cerró el menú de compartir: no se descarga.
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
