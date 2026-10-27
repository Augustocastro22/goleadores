import type { OpcionImagen } from "@/components/Compartir";
import { COLOR_BASE, DISENOS } from "./temas";

/*
 * Las opciones que tienen en común todas las imágenes para compartir: el
 * color y el diseño del fondo, y cómo se nombra a los jugadores. Se muestran
 * en la hoja de compartir (src/components/Compartir.tsx) y las lee
 * /api/compartir.
 */

/** El color del equipo, con la paleta del celular; se recuerda para la próxima. */
export const OPCION_COLOR: OpcionImagen = {
  param: "color",
  items: [],
  recordar: true,
  modo: "paleta",
  paletaInicial: COLOR_BASE,
};

/** Cuatro diseños que toman ese color. */
export const OPCION_DISENO: OpcionImagen = {
  param: "diseno",
  items: DISENOS.map((d) => ({ id: d.id, label: d.nombre })),
  recordar: true,
  modo: "chips",
};

export const OPCION_NOMBRES: OpcionImagen = {
  param: "nombres",
  items: [
    { id: "apodos", label: "Apodos" },
    { id: "completos", label: "Nombres" },
  ],
  recordar: true,
  modo: "ajuste",
  titulo: "Cómo salen los jugadores",
};
