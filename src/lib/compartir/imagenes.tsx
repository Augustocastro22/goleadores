import { ImageResponse } from "next/og";

/*
 * Imágenes para compartir (WhatsApp, historias). Por ahora, la tabla de
 * goleadores. Dos formatos: historia (vertical,
 * 1080×1920) y cuadrado (1080×1080). Las arma /api/compartir.
 */

export type Formato = "historia" | "cuadrado";

export const TAMANIOS: Record<Formato, { width: number; height: number }> = {
  historia: { width: 1080, height: 1920 },
  cuadrado: { width: 1080, height: 1080 },
};

const FONDO = "#08090c";
const VERDE = "#34d399";
const GRIS = "#a1a1aa";
const GRIS_OSCURO = "#52525b";
const SUPERFICIE = "#131418";

/** Una imagen (escudo, foto) como data URL; si no se puede bajar, null. */
async function comoDataUrl(url: string | null): Promise<string | null> {
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
  nombre: string;
  fotoUrl: string | null;
  valor: number;
}

export interface Encabezado {
  grupoNombre: string;
  grupoLogoUrl: string | null;
  /** "Tabla de goleadores", "Mejor Jugador"... */
  titulo: string;
  /** Color del título (verde, dorado o rojo según la tabla). */
  color: string;
}

function Foto({ src, apodo, size }: { src: string | null; apodo: string; size: number }) {
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
        background: "#14352b",
        color: VERDE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        fontWeight: 700,
      }}
    >
      {apodo.charAt(0).toUpperCase()}
    </div>
  );
}

/** Escudo y nombre del grupo arriba, el título, el contenido y "goleadores.ar" abajo. */
async function Lienzo({
  formato,
  encabezado,
  children,
}: {
  formato: Formato;
  encabezado: Encabezado;
  children: React.ReactNode;
}) {
  const escudo = await comoDataUrl(encabezado.grupoLogoUrl);
  const historia = formato === "historia";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: FONDO,
        color: "white",
        padding: historia ? "120px 80px 100px" : "64px 72px 56px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        {/* Sin escudo va solo el nombre (el logo de la app se confundía con el grupo). */}
        {escudo && (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image
          <img src={escudo} width={historia ? 120 : 96} height={historia ? 120 : 96} alt="" style={{ borderRadius: 24 }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 760 }}>
          <div style={{ display: "flex", fontSize: historia ? 56 : 48, fontWeight: 800, letterSpacing: -1, lineHeight: 1.05 }}>
            {encabezado.grupoNombre}
          </div>
          <div style={{ display: "flex", fontSize: historia ? 40 : 34, fontWeight: 700, color: encabezado.color }}>{encabezado.titulo}</div>
        </div>
      </div>

      {/* En la historia el contenido va centrado en el alto: si no, queda medio vacía abajo. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: historia ? "center" : "flex-start",
          marginTop: historia ? 40 : 44,
          marginBottom: historia ? 40 : 0,
        }}
      >
        {children}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontSize: 32, fontWeight: 700 }}>
        <span>Goleadores</span>
        <span style={{ color: GRIS_OSCURO }}>·</span>
        <span style={{ color: VERDE }}>goleadores.ar</span>
      </div>
    </div>
  );
}

/** Oro, plata y bronce, como los puestos de Estadísticas. */
const MEDALLAS = ["#fbbf24", "#d4d4d8", "#fb923c"];
const medalla = (puesto: number) => MEDALLAS[Math.min(puesto, 3) - 1];

/**
 * Podio con los tres primeros (el 1° al medio y más alto, el 2° a la
 * izquierda, el 3° a la derecha) y, abajo, el resto en lista.
 */
export async function imagenRanking({
  formato,
  encabezado,
  filas,
  unidad,
  vacio,
}: {
  formato: Formato;
  encabezado: Encabezado;
  filas: FilaRanking[];
  /** "goles", "veces": debajo del número de cada uno del podio. */
  unidad: string;
  vacio: string;
}) {
  const historia = formato === "historia";
  const podio = filas.slice(0, 3);
  const resto = filas.slice(3, historia ? 10 : 5);
  const [fotosPodio, fotosResto] = await Promise.all([
    Promise.all(podio.map((f) => comoDataUrl(f.fotoUrl))),
    Promise.all(resto.map((f) => comoDataUrl(f.fotoUrl))),
  ]);

  // Lugar en el podio: 0 = el del medio (1°), 1 = izquierda (2°), 2 = derecha (3°).
  const orden = [1, 0, 2].filter((i) => i < podio.length);
  const altoPedestal = historia ? [230, 160, 110] : [130, 90, 60];
  const fotoPodio = historia ? [200, 160, 160] : [130, 104, 104];

  const columna = (i: number) => {
    const f = podio[i];
    const color = medalla(f.puesto);
    return (
      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: historia ? 290 : 280 }}>
        <div style={{ display: "flex", borderRadius: 999, border: `${historia ? 8 : 6}px solid ${color}` }}>
          <Foto src={fotosPodio[i]} apodo={f.apodo} size={fotoPodio[i]} />
        </div>
        <div style={{ display: "flex", marginTop: 16, fontSize: historia ? 44 : 36, fontWeight: 800, lineHeight: 1.1 }}>
          {f.apodo}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: historia ? 64 : 48, fontWeight: 800, color }}>{f.valor}</span>
          <span style={{ fontSize: historia ? 30 : 26, color: GRIS }}>{unidad}</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            width: "100%",
            height: altoPedestal[i],
            marginTop: 16,
            paddingTop: historia ? 18 : 10,
            borderRadius: "24px 24px 0 0",
            background: SUPERFICIE,
            borderTop: `6px solid ${color}`,
            fontSize: historia ? 64 : 44,
            fontWeight: 800,
            color,
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
      encabezado,
      children:
        filas.length === 0 ? (
          <div style={{ display: "flex", fontSize: 40, color: GRIS }}>{vacio}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: historia ? 40 : 24 }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 20 }}>
              {orden.map(columna)}
            </div>
            {resto.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: historia ? 14 : 10 }}>
                {resto.map((f, i) => (
                  <div
                    key={`${f.apodo}-${i}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 24,
                      height: historia ? 96 : 84,
                      padding: "0 28px",
                      borderRadius: 24,
                      background: SUPERFICIE,
                      border: "2px solid #1f2026",
                    }}
                  >
                    <div style={{ display: "flex", width: 44, fontSize: 34, fontWeight: 800, color: GRIS }}>{f.puesto}</div>
                    <Foto src={fotosResto[i]} apodo={f.apodo} size={historia ? 68 : 60} />
                    <div style={{ display: "flex", flex: 1, fontSize: historia ? 38 : 34, fontWeight: 700 }}>{f.apodo}</div>
                    <div style={{ display: "flex", fontSize: historia ? 46 : 40, fontWeight: 800 }}>{f.valor}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
    }),
    TAMANIOS[formato]
  );
}

