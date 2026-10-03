import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/*
 * Imagen de la vista previa cuando se comparte un link de la app (WhatsApp,
 * Telegram, etc.). Se ve sin sesión: ver NO_AUTH_REQUIRED_PATHS en
 * src/lib/supabase/middleware.ts.
 */

export const alt = "Goleadores";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/icons/icon-512.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "0 96px",
          background: "#08090c",
          color: "white",
        }}
      >
        {/* El ícono ya trae su fondo oscuro: se recorta para que solo quede la pelota. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
        <img src={logoSrc} width={340} height={340} alt="" style={{ margin: -40 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3 }}>Goleadores</div>
          <div style={{ fontSize: 40, color: "#a1a1aa", lineHeight: 1.3, maxWidth: 620 }}>
            Los partidos con tus amigos: goles, votaciones y estadísticas.
          </div>
          <div style={{ fontSize: 34, color: "#34d399", fontWeight: 700 }}>goleadores.ar</div>
        </div>
      </div>
    ),
    size
  );
}
