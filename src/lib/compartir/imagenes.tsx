import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { TEMA_BASE, type Tema } from "./temas";

/*
 * Imágenes para compartir (WhatsApp, historias, publicaciones): la tabla de
 * goleadores (en podio o en lista; los partidos están en imagen-partido.tsx).
 * Dos formatos: historia (vertical, 1080×1920) y cuadrado (1080×1080). Las
 * arma /api/compartir. En historia el contenido queda a 270 px de arriba y de
 * abajo: Instagram tapa ahí la barra del perfil y la de responder.
 */

export type Formato = "historia" | "cuadrado";
export type EstiloRanking = "podio" | "lista";
/** Cómo se nombra a cada jugador: por apodo o con nombre y apellido. */
export type NombresJugador = "apodos" | "completos";

export const TAMANIOS: Record<Formato, { width: number; height: number }> = {
  historia: { width: 1080, height: 1920 },
  cuadrado: { width: 1080, height: 1080 },
};

export const GRIS = "#a1a1aa";
export const GRIS_OSCURO = "#52525b";
/** Lo que se apoya sobre cualquier fondo: tarjetas y renglones translúcidos. */
export const SUPERFICIE = "rgba(255,255,255,0.06)";
export const BORDE = "rgba(255,255,255,0.10)";

/** Anton (OFL, Google Fonts): la tipografía condensada y pesada de los afiches. */
export async function fuentesAfiche() {
  const archivo = await readFile(join(process.cwd(), "src/lib/compartir/fonts/Anton-Regular.ttf"));
  const data = archivo.buffer.slice(archivo.byteOffset, archivo.byteOffset + archivo.byteLength) as ArrayBuffer;
  return [{ name: "Anton", data, weight: 400 as const, style: "normal" as const }];
}

/** Una imagen (escudo, foto) como data URL; si no se puede bajar, null. */
export async function comoDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") ?? "image/png";
    return `data:${tipo};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export interface FilaRanking {
  puesto: number;
  apodo: string;
  /** Nombre y apellido. */
  nombre: string;
  fotoUrl: string | null;
  valor: number;
}

export interface Encabezado {
  grupoNombre: string;
  grupoLogoUrl: string | null;
  /** "Tabla de goleadores", "Victoria"... */
  titulo: string;
  /** Color del título (el acento del fondo, o uno sobrio). */
  color: string;
}

/** La foto redonda del jugador; sin foto, su inicial sobre el acento del fondo. */
export function Foto({ src, apodo, size, acento }: { src: string | null; apodo: string; size: number; acento: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image
    return <img src={src} width={size} height={size} alt="" style={{ borderRadius: size, objectFit: "cover" }} />;
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: `${acento}33`,
        color: acento,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.5,
      }}
    >
      {apodo.charAt(0).toUpperCase()}
    </div>
  );
}

/**
 * El afiche: el fondo del tema, escudo y nombre del grupo arriba, el título
 * grande, el contenido al medio y "goleadores.ar" abajo.
 */
export async function Lienzo({
  formato,
  encabezado,
  tema,
  children,
}: {
  formato: Formato;
  encabezado: Encabezado;
  tema: Tema;
  children: React.ReactNode;
}) {
  const escudo = await comoDataUrl(encabezado.grupoLogoUrl);
  const historia = formato === "historia";
  const { width, height } = TAMANIOS[formato];
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "Anton",
        background: tema.fondo,
        color: "white",
        padding: historia ? "270px 70px 270px" : "64px 72px 56px",
      }}
    >
      {tema.decoracion(width, height)}

      {escudo && (
        // eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image
        <img src={escudo} width={historia ? 110 : 90} height={historia ? 110 : 90} alt="" style={{ borderRadius: 28 }} />
      )}
      <div
        style={{
          display: "flex",
          marginTop: escudo ? (historia ? 24 : 12) : 0,
          fontSize: historia ? 34 : 26,
          letterSpacing: 6,
          color: GRIS,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {encabezado.grupoNombre}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: historia ? 14 : 8,
          fontSize: historia ? 104 : 78,
          letterSpacing: 1,
          color: encabezado.color,
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        {encabezado.titulo}
      </div>
      <div
        style={{
          display: "flex",
          width: historia ? 220 : 150,
          height: 6,
          borderRadius: 6,
          background: encabezado.color,
          marginTop: historia ? 26 : 16,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          width: "100%",
          justifyContent: "center",
          marginTop: historia ? 30 : 14,
          marginBottom: historia ? 30 : 10,
        }}
      >
        {children}
      </div>

      <div style={{ display: "flex", fontSize: historia ? 34 : 28, color: tema.acento }}>goleadores.ar</div>
    </div>
  );
}

/** Oro, plata y bronce, como los puestos de Estadísticas. */
const MEDALLAS = ["#fbbf24", "#d4d4d8", "#fb923c"];
const medalla = (puesto: number) => MEDALLAS[Math.min(puesto, 3) - 1];

/**
 * Podio con los tres primeros (el 1° al medio y más alto, el 2° a la
 * izquierda, el 3° a la derecha) y, abajo, el resto en lista; o todos en lista.
 */
export async function imagenRanking({
  formato,
  encabezado,
  filas,
  unidad,
  vacio,
  estilo = "podio",
  nombres = "apodos",
  tema = TEMA_BASE,
}: {
  formato: Formato;
  encabezado: Omit<Encabezado, "color">;
  filas: FilaRanking[];
  /** "goles", "veces": debajo del número de cada uno del podio. */
  unidad: string;
  vacio: string;
  /** "podio": los tres primeros arriba y el resto en lista; "lista": todos en lista. */
  estilo?: EstiloRanking;
  nombres?: NombresJugador;
  tema?: Tema;
}) {
  const historia = formato === "historia";
  const enLista = estilo === "lista";
  const etiqueta = (f: FilaRanking) => (nombres === "completos" && f.nombre ? f.nombre : f.apodo);
  const podio = enLista ? [] : filas.slice(0, 3);
  const resto = enLista ? filas.slice(0, historia ? 7 : 6) : filas.slice(3, historia ? 6 : 5);
  const [fotosPodio, fotosResto] = await Promise.all([
    Promise.all(podio.map((f) => comoDataUrl(f.fotoUrl))),
    Promise.all(resto.map((f) => comoDataUrl(f.fotoUrl))),
  ]);

  // Lugar en el podio: 0 = el del medio (1°), 1 = izquierda (2°), 2 = derecha (3°).
  const orden = [1, 0, 2].filter((i) => i < podio.length);
  const altoPedestal = historia ? [170, 120, 80] : [100, 70, 46];
  const fotoPodio = historia ? [170, 140, 140] : [104, 84, 84];
  const altoFila = enLista ? (historia ? 104 : 76) : historia ? 92 : 62;

  const columna = (i: number) => {
    const f = podio[i];
    const color = medalla(f.puesto);
    return (
      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: historia ? 300 : 300 }}>
        <div style={{ display: "flex", borderRadius: 999, border: `${historia ? 8 : 6}px solid ${color}` }}>
          <Foto src={fotosPodio[i]} apodo={f.apodo} size={fotoPodio[i]} acento={tema.acento} />
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: historia ? 50 : 34,
            lineHeight: 1.1,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {etiqueta(f)}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
          <span style={{ fontSize: historia ? 76 : 52, color }}>{f.valor}</span>
          <span style={{ fontSize: historia ? 28 : 22, color: GRIS, textTransform: "uppercase" }}>{unidad}</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            width: "100%",
            height: altoPedestal[i],
            marginTop: 10,
            paddingTop: historia ? 18 : 8,
            borderRadius: "24px 24px 0 0",
            background: SUPERFICIE,
            borderTop: `6px solid ${color}`,
            // Discreto: el orden ya lo dicen la altura y el color; el número aclara los empates.
            fontSize: historia ? 44 : 30,
            color: GRIS_OSCURO,
          }}
        >
          {f.puesto}
        </div>
      </div>
    );
  };

  return new ImageResponse(
    await Lienzo({
      formato,
      tema,
      encabezado: { ...encabezado, color: tema.acento },
      children:
        filas.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", fontSize: 40, color: GRIS }}>{vacio}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: historia ? 40 : 26 }}>
            {podio.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 16 }}>
                {orden.map(columna)}
              </div>
            )}
            {resto.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: historia ? 12 : 8 }}>
                {resto.map((f, i) => (
                  <div
                    key={`${f.apodo}-${i}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 22,
                      height: altoFila,
                      padding: "0 28px",
                      borderRadius: 22,
                      background: SUPERFICIE,
                      border: `2px solid ${BORDE}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        width: 50,
                        fontSize: historia ? 42 : 32,
                        color: enLista && f.puesto <= 3 ? medalla(f.puesto) : GRIS,
                      }}
                    >
                      {f.puesto}
                    </div>
                    <Foto src={fotosResto[i]} apodo={f.apodo} size={Math.round(altoFila * 0.68)} acento={tema.acento} />
                    <div style={{ display: "flex", flex: 1, fontSize: historia ? 44 : 34, textTransform: "uppercase" }}>
                      {etiqueta(f)}
                    </div>
                    <div style={{ display: "flex", fontSize: historia ? 54 : 42, color: tema.acento }}>{f.valor}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
    }),
    { ...TAMANIOS[formato], fonts: await fuentesAfiche() }
  );
}
