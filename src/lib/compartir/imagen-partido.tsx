import { ImageResponse } from "next/og";
import {
  BORDE,
  Foto,
  GRIS,
  GRIS_OSCURO,
  Lienzo,
  SUPERFICIE,
  TAMANIOS,
  comoDataUrl,
  fuentesAfiche,
  type Formato,
  type NombresJugador,
} from "./imagenes";
import { TEMA_BASE, type Tema } from "./temas";

/*
 * Imagen de un partido para compartir (ver imagenes.tsx y /api/compartir),
 * estilo afiche: el resultado con los goleadores (nombre y una pelota por
 * gol), o la lista de convocados. El título y el tono cambian según cómo
 * salió: victoria (el acento del fondo), empate, o derrota (sobrio, sin
 * remarcar quién ganó).
 */

export type VistaPartido = "resultado" | "convocados";

export interface JugadorPartido {
  apodo: string;
  /** Nombre y apellido. */
  nombre: string;
  fotoUrl: string | null;
  goles: number;
}

export interface DatosPartido {
  /** El nombre del grupo, o del primer equipo cuando juegan entre ellos. */
  nosotros: string;
  rival: string;
  /** null: todavía sin resultado (un desafío sin acordar). */
  golesNosotros: number | null;
  golesRival: number | null;
  /** "Jueves, 22 de octubre · 21:00hs" */
  fecha: string;
  lugar: string;
  equipo1: JugadorPartido[];
  /** Vacío cuando se juega contra un equipo de afuera. */
  equipo2: JugadorPartido[];
  /** Goles de cada lado que no son de ningún jugador del grupo (invitados). */
  otros1: number;
  otros2: number;
}

interface Columna {
  titulo: string | null;
  filas: JugadorPartido[];
  resto: number;
}

/** Más pelotas que estas no entran en la fila: pasan a "pelota + número". */
const MAX_PELOTAS = 5;
/** Con nombre y apellido el texto es más largo: va un poco más chico. */
const ESCALA_COMPLETOS = 0.8;

/** Una pelota dibujada (los emojis no se ven en estas imágenes). */
function Pelota({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="white" stroke="#18181b" strokeWidth="1.5" />
      <polygon points="12,7 16.6,10.3 14.8,15.7 9.2,15.7 7.4,10.3" fill="#18181b" />
      <path
        d="M12 7V2.5M16.6 10.3l4.4-1.4M14.8 15.7l2.7 3.8M9.2 15.7l-2.7 3.8M7.4 10.3L3 8.9"
        stroke="#18181b"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function Pelotas({ cantidad, size, acento }: { cantidad: number; size: number; acento: string }) {
  if (cantidad > MAX_PELOTAS) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Pelota size={size} />
        <span style={{ fontSize: size, color: acento }}>{cantidad}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {Array.from({ length: cantidad }, (_, i) => (
        <Pelota key={i} size={size} />
      ))}
    </div>
  );
}

export async function imagenPartido({
  formato,
  grupo,
  vista,
  partido,
  nombres = "apodos",
  tema = TEMA_BASE,
}: {
  formato: Formato;
  grupo: { nombre: string; logoUrl: string | null };
  vista: VistaPartido;
  partido: DatosPartido;
  nombres?: NombresJugador;
  tema?: Tema;
}) {
  const historia = formato === "historia";
  const resultado = vista === "resultado";
  const dosEquipos = partido.equipo2.length > 0;
  const hayMarcador = resultado && partido.golesNosotros != null && partido.golesRival != null;
  const acento = tema.acento;
  const completos = nombres === "completos";
  const etiqueta = (j: JugadorPartido) => (completos && j.nombre ? j.nombre : j.apodo);

  // Cómo salió: cambia el título y el color (la derrota no usa el acento festivo).
  let titulo = resultado ? "Resultado final" : "Lista de convocados";
  let colorTitulo = acento;
  if (hayMarcador) {
    const a = partido.golesNosotros as number;
    const b = partido.golesRival as number;
    if (a > b) titulo = "Victoria";
    else if (a === b) titulo = "Empate";
    else colorTitulo = "#e4e4e7";
  }

  // Resultado: solo los que hicieron goles, con los de invitados ("Otros") al final de cada lado.
  const goleadores = (lista: JugadorPartido[], otros: number) => {
    const filas = lista.filter((j) => j.goles > 0).sort((a, b) => b.goles - a.goles);
    return otros > 0 ? [...filas, { apodo: "Otros", nombre: "", fotoUrl: null, goles: otros }] : filas;
  };
  // Convocados: por orden alfabético.
  const alfabetico = (lista: JugadorPartido[]) =>
    [...lista].sort((a, b) => etiqueta(a).localeCompare(etiqueta(b), "es"));
  const lado1 = resultado ? goleadores(partido.equipo1, partido.otros1) : alfabetico(partido.equipo1);
  const lado2 = resultado ? goleadores(partido.equipo2, partido.otros2) : alfabetico(partido.equipo2);

  const porColumna = resultado ? (historia ? 8 : 4) : historia ? 12 : 7;
  const recortar = (filas: JugadorPartido[], max: number) => ({
    filas: filas.slice(0, max),
    resto: Math.max(0, filas.length - max),
  });

  let columnas: Columna[];
  if (!resultado && !dosEquipos) {
    // Un solo equipo: la lista se parte en dos columnas para que entren más.
    const total = recortar(lado1, porColumna * 2);
    const mitad = Math.ceil(total.filas.length / 2);
    columnas = [{ titulo: null, filas: total.filas.slice(0, mitad), resto: 0 }];
    if (total.filas.length > mitad) columnas.push({ titulo: null, filas: total.filas.slice(mitad), resto: total.resto });
    else columnas[0].resto = total.resto;
  } else {
    columnas = [{ titulo: partido.nosotros, ...recortar(lado1, porColumna) }];
    if (dosEquipos) columnas.push({ titulo: partido.rival, ...recortar(lado2, porColumna) });
  }
  // Si solo un lado hizo goles, va esa columna sola, centrada.
  if (resultado) columnas = columnas.filter((c) => c.filas.length > 0);

  // En historia la lista tiene que entrar entre las barras de Instagram: los renglones se achican si hay muchos.
  const maxFilas = Math.max(1, ...columnas.map((c) => c.filas.length));
  const altoFila = historia ? Math.min(96, Math.floor(640 / maxFilas)) : 56;
  const tamFoto = historia ? Math.round(altoFila * 0.66) : 42;
  const escala = completos ? ESCALA_COMPLETOS : 1;
  const tamNombre = (historia ? Math.min(52, Math.round(altoFila * 0.58)) : 38) * escala;
  const fotos = await Promise.all(columnas.map((c) => Promise.all(c.filas.map((j) => comoDataUrl(j.fotoUrl)))));

  const nombreEquipo = {
    display: "flex",
    flex: 1,
    fontSize: historia ? 64 : 42,
    lineHeight: 1.1,
    textTransform: "uppercase",
  } as const;

  const cabecera = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: historia ? 22 : 12 }}>
      {hayMarcador ? (
        <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 24 }}>
          <div style={{ ...nombreEquipo, justifyContent: "flex-end", textAlign: "right" }}>{partido.nosotros}</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: historia ? 24 : 16,
              fontSize: historia ? 250 : 150,
              lineHeight: 1,
            }}
          >
            <span>{partido.golesNosotros}</span>
            <span style={{ color: acento, fontSize: historia ? 150 : 96 }}>-</span>
            <span>{partido.golesRival}</span>
          </div>
          <div style={{ ...nombreEquipo, textAlign: "left" }}>{partido.rival}</div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            fontSize: historia ? 64 : 42,
            textTransform: "uppercase",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          {partido.nosotros} vs {partido.rival}
        </div>
      )}
      <div
        style={{
          display: "flex",
          fontSize: historia ? 34 : 26,
          color: GRIS,
          textTransform: "uppercase",
          letterSpacing: 2,
          textAlign: "center",
        }}
      >
        {partido.fecha} · {partido.lugar}
      </div>
    </div>
  );

  const subtitulo = (texto: string) => (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        fontSize: historia ? 48 : 34,
        color: acento,
        textTransform: "uppercase",
        letterSpacing: 3,
        marginBottom: historia ? 10 : 4,
        textAlign: "center",
      }}
    >
      {texto}
    </div>
  );

  // Goles: el nombre y una pelota por gol, centrados, sin tarjetas.
  const golesColumna = (c: Columna) => (
    <div style={{ display: "flex", flexDirection: "column", gap: historia ? 16 : 8 }}>
      {c.filas.map((j, i) => (
        <div
          key={`${j.apodo}-${i}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            fontSize: (historia ? 54 : 38) * escala,
            textTransform: "uppercase",
          }}
        >
          <span>{etiqueta(j)}</span>
          <Pelotas cantidad={j.goles} size={historia ? 50 : 36} acento={acento} />
        </div>
      ))}
    </div>
  );

  // Convocados: renglones con foto y nombre grande, separados por líneas finas.
  const convocadosColumna = (c: Columna, ci: number) => (
    <div style={{ display: "flex", flexDirection: "column", borderTop: `2px solid ${BORDE}` }}>
      {c.filas.map((j, i) => (
        <div
          key={`${j.apodo}-${i}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            height: altoFila,
            padding: "0 14px",
            borderBottom: `2px solid ${BORDE}`,
            background: i % 2 === 0 ? SUPERFICIE : "rgba(255,255,255,0)",
          }}
        >
          <Foto src={fotos[ci][i]} apodo={j.apodo} size={tamFoto} acento={acento} />
          <div
            style={{
              display: "flex",
              flex: 1,
              fontSize: tamNombre,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {etiqueta(j)}
          </div>
        </div>
      ))}
    </div>
  );

  return new ImageResponse(
    await Lienzo({
      formato,
      tema,
      encabezado: { grupoNombre: grupo.nombre, grupoLogoUrl: grupo.logoUrl, titulo, color: colorTitulo },
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: historia ? 56 : 24 }}>
          {cabecera}
          {columnas.length > 0 ? (
            <div style={{ display: "flex", gap: 28, justifyContent: "center" }}>
              {columnas.map((c, ci) => (
                <div
                  key={ci}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: resultado ? (historia ? 16 : 8) : 12,
                    width: columnas.length > 1 ? "50%" : resultado ? "100%" : "78%",
                  }}
                >
                  {resultado && subtitulo(columnas.length > 1 && c.titulo ? c.titulo : "Goleadores")}
                  {!resultado && c.titulo && subtitulo(c.titulo)}
                  {resultado ? golesColumna(c) : convocadosColumna(c, ci)}
                  {c.resto > 0 && (
                    <div style={{ display: "flex", justifyContent: "center", fontSize: historia ? 28 : 22, color: GRIS }}>
                      +{c.resto} más
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center", fontSize: historia ? 36 : 28, color: GRIS_OSCURO }}>
              {resultado ? "Sin goles de jugadores cargados." : "Todavía no hay convocados."}
            </div>
          )}
        </div>
      ),
    }),
    { ...TAMANIOS[formato], fonts: await fuentesAfiche() }
  );
}
