import type { CSSProperties, ReactNode } from "react";

/*
 * Fondos para las imágenes de afiche (partidos y tabla de goleadores). El
 * grupo elige un color (el de su camiseta, con la paleta) y un diseño; el
 * fondo y los detalles salen de ese color. Las decoraciones son capas
 * absolutas detrás del contenido.
 */

export type DisenoId = "cancha" | "marco" | "franjas" | "rayos";

export const DISENOS: { id: DisenoId; nombre: string }[] = [
  { id: "cancha", nombre: "Cancha" },
  { id: "marco", nombre: "Marco" },
  { id: "franjas", nombre: "Franjas" },
  { id: "rayos", nombre: "Rayos" },
];

/** El verde de siempre. */
export const COLOR_BASE = "34d399";

export interface Tema {
  /** Color de títulos, subtítulos y detalles. */
  acento: string;
  /** El fondo de base (degradé). */
  fondo: string;
  /** La decoración, a tamaño completo de la imagen. */
  decoracion: (ancho: number, alto: number) => ReactNode;
}

const capa: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  display: "flex",
  overflow: "hidden",
};

/** Un marco fino alrededor, a `margen` del borde. */
function marco(margen: number, color: string, grosor: number, radio: number): ReactNode {
  return (
    <div
      style={{
        position: "absolute",
        top: margen,
        left: margen,
        right: margen,
        bottom: margen,
        border: `${grosor}px solid ${color}`,
        borderRadius: radio,
      }}
    />
  );
}

/** Una franja inclinada (rotada alrededor de su centro). */
function franja(left: number, top: number, ancho: number, alto: number, grados: number, fondo: string): ReactNode {
  return (
    <div
      style={{ position: "absolute", left, top, width: ancho, height: alto, background: fondo, transform: `rotate(${grados}deg)` }}
    />
  );
}

/** Una capa de fondo a todo el tamaño con una imagen (degradé o franjas) encima. */
function capaImagen(w: number, h: number, imagen: string): ReactNode {
  return <div style={{ position: "absolute", top: 0, left: 0, width: w, height: h, backgroundImage: imagen }} />;
}

/** Un destello inclinado que se desvanece en las puntas. */
const destello = (rgba: (a: number) => string, a: number) =>
  `linear-gradient(90deg, ${rgba(0)} 0%, ${rgba(a)} 50%, ${rgba(0)} 100%)`;

/** Un color elegido a mano: 6 dígitos hexadecimales, sin "#". */
export const esColorPropio = (valor: string | null): valor is string => !!valor && /^[0-9a-f]{6}$/i.test(valor);

function hslAHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const canal = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${canal(0)}${canal(8)}${canal(4)}`;
}

function hexAHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

/**
 * El fondo para un color y un diseño: el mismo tono, oscuro, con la decoración
 * del diseño. El acento se lleva a un claro parecido para que el texto se lea
 * sobre el fondo oscuro aunque elijan un color muy oscuro (o gris).
 */
export function crearTema(diseno: DisenoId, hex: string): Tema {
  const { h, s, l } = hexAHsl(hex);
  const gris = s < 12;
  const acento = hslAHex(h, gris ? 0 : Math.max(s, 60), gris ? 82 : Math.min(Math.max(l, 56), 66));
  const oscuro = hslAHex(h, gris ? 0 : Math.max(Math.min(s, 70), 40), 14);
  const negro = hslAHex(h, gris ? 0 : 40, 5);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(acento.slice(i, i + 2), 16));
  const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;
  const fondo = `linear-gradient(160deg, ${oscuro} 0%, ${negro} 100%)`;
  const brilloArriba = `radial-gradient(circle at 50% 0%, ${rgba(0.3)} 0%, ${rgba(0)} 55%)`;

  const decoraciones: Record<DisenoId, (w: number, h: number) => ReactNode> = {
    // La cancha: césped en franjas, círculo central y línea de mitad de cancha.
    cancha: (w, alto) => (
      <div style={capa}>
        {capaImagen(
          w,
          alto,
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 90px, rgba(255,255,255,0) 90px, rgba(255,255,255,0) 180px)"
        )}
        {capaImagen(w, alto, brilloArriba)}
        <div style={{ position: "absolute", left: 0, top: alto / 2 - 2, width: w, height: 4, background: "rgba(255,255,255,0.07)" }} />
        <div
          style={{
            position: "absolute",
            left: (w - 700) / 2,
            top: (alto - 700) / 2,
            width: 700,
            height: 700,
            borderRadius: 700,
            border: "4px solid rgba(255,255,255,0.07)",
          }}
        />
        {marco(34, rgba(0.38), 3, 34)}
      </div>
    ),
    // Marco doble con líneas finas y destellos en las esquinas.
    marco: (w, alto) => (
      <div style={capa}>
        {capaImagen(
          w,
          alto,
          `repeating-linear-gradient(135deg, ${rgba(0.07)} 0px, ${rgba(0.07)} 2px, ${rgba(0)} 2px, ${rgba(0)} 24px)`
        )}
        {franja(w - 260, -60, 520, 46, 45, destello(rgba, 0.55))}
        {franja(-260, alto - 20, 520, 46, 45, destello(rgba, 0.55))}
        {marco(34, rgba(0.6), 4, 12)}
        {marco(56, rgba(0.25), 2, 8)}
      </div>
    ),
    // Franjas diagonales y un brillo abajo.
    franjas: (w, alto) => (
      <div style={capa}>
        {franja(-120, -alto * 0.2, 240, alto * 1.6, 28, rgba(0.07))}
        {franja(w * 0.3, -alto * 0.2, 120, alto * 1.6, 28, rgba(0.05))}
        {franja(w * 0.62, -alto * 0.2, 300, alto * 1.6, 28, rgba(0.08))}
        {capaImagen(w, alto, `radial-gradient(circle at 50% 100%, ${rgba(0.28)} 0%, ${rgba(0)} 55%)`)}
        {marco(34, rgba(0.4), 3, 34)}
      </div>
    ),
    // Rayos cruzados en dos esquinas y brillo arriba.
    rayos: (w, alto) => (
      <div style={capa}>
        {capaImagen(w, alto, brilloArriba)}
        {franja(-200, alto * 0.08, 640, 10, -35, destello(rgba, 0.9))}
        {franja(-160, alto * 0.08 + 36, 480, 5, -35, destello(rgba, 0.6))}
        {franja(w - 440, alto * 0.9, 640, 10, -35, destello(rgba, 0.9))}
        {franja(w - 320, alto * 0.9 + 36, 480, 5, -35, destello(rgba, 0.6))}
        {marco(34, rgba(0.4), 3, 34)}
      </div>
    ),
  };

  return { acento, fondo, decoracion: decoraciones[diseno] };
}

/** Lo que llega en la URL (diseño y color): si algo no es válido, la cancha en verde de siempre. */
export function leerTema(diseno: string | null, color: string | null): Tema {
  const id = DISENOS.find((d) => d.id === diseno)?.id ?? "cancha";
  return crearTema(id, esColorPropio(color) ? color : COLOR_BASE);
}

/** El tema de siempre, para cuando no se elige nada. */
export const TEMA_BASE: Tema = crearTema("cancha", COLOR_BASE);
