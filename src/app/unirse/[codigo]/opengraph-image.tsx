import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getGrupoDeInvitacion } from "@/lib/invitacion";

/*
 * Vista previa de un link de invitación: el escudo y el nombre del grupo al
 * que invitan. Sin escudo va la pelota de la app; con un link inválido, la
 * misma imagen que el resto de la app.
 */

export const alt = "Invitación a un grupo de Goleadores";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** El escudo como data URL (si falla la descarga, null y va la pelota). */
async function escudo(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") ?? "image/png";
    return `data:${tipo};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const grupo = await getGrupoDeInvitacion(codigo);

  const icono = await readFile(join(process.cwd(), "public/icons/icon-512.png"));
  const iconoSrc = `data:image/png;base64,${icono.toString("base64")}`;
  const escudoSrc = await escudo(grupo?.logoUrl ?? null);

  const nombre = grupo?.nombre ?? "Goleadores";
  const tamanioNombre = nombre.length > 22 ? 64 : nombre.length > 14 ? 80 : 96;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 96px",
          background: "#08090c",
          color: "white",
        }}
      >
        {escudoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image
          <img src={escudoSrc} width={300} height={300} alt="" style={{ borderRadius: 48 }} />
        ) : (
          // El ícono ya trae su fondo oscuro: se recorta para que solo quede la pelota.
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image
          <img src={iconoSrc} width={340} height={340} alt="" style={{ margin: -40 }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
          {grupo && <div style={{ fontSize: 40, color: "#a1a1aa" }}>Te invitaron a</div>}
          <div style={{ fontSize: tamanioNombre, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>
            {nombre}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 34, fontWeight: 700 }}>
            <span style={{ color: "white" }}>Goleadores</span>
            <span style={{ color: "#52525b" }}>·</span>
            <span style={{ color: "#34d399" }}>goleadores.ar</span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
