import { armarSlots, FORMACIONES_PRESET, futbolPara, parseFormacion, repartir, type Equipo } from "@/lib/cancha";
import { Foto } from "./imagenes";

/*
 * La cancha para las imágenes para compartir (ImageResponse de next/og): las
 * franjas de pasto, las líneas de cal hechas con cajas con borde (sin SVG, que
 * ImageResponse dibuja a medias) y los jugadores con foto y nombre. Con dos
 * equipos, cada uno en su mitad (el segundo arriba, en dorado).
 */

export interface JugadorCancha {
  etiqueta: string;
  apodo: string;
  foto: string | null;
}

const CAL = "rgba(255,255,255,0.72)";
const COLOR: Record<Equipo, string> = { 1: "#34d399", 2: "#fbbf24" };

/** Los que entran en la cancha (con la formación más común para esa cantidad) y los que quedan afuera. */
export function ubicarEnCancha(equipos: JugadorCancha[][]) {
  const dos = equipos.length === 2;
  const futbol = futbolPara(Math.max(...equipos.map((e) => e.length)));
  const lineas = parseFormacion(FORMACIONES_PRESET[futbol][0])!;
  const ubicados: { jugador: JugadorCancha; equipo: Equipo; x: number; y: number }[] = [];
  const afuera: JugadorCancha[] = [];
  equipos.forEach((lista, i) => {
    const equipo = (i + 1) as Equipo;
    const slots = armarSlots(lineas, equipo, dos ? (equipo === 1 ? "abajo" : "arriba") : "completa");
    const asign = repartir(
      lista.map((_, k) => String(k)),
      slots
    );
    slots.forEach((s) => {
      const k = asign[s.id];
      // Un poco hacia el centro: en la imagen el nombre va abajo de la foto y el arquero no tiene que subir.
      if (k !== undefined) ubicados.push({ jugador: lista[Number(k)], equipo, x: s.xPct, y: 50 + (s.yPct - 50) * 0.88 });
    });
    afuera.push(...lista.slice(slots.length));
  });
  return { ubicados, afuera };
}

function Linea(props: { left: number; top: number; width: number; height: number; radius?: number; sinArriba?: boolean; sinAbajo?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        left: props.left,
        top: props.top,
        width: props.width,
        height: props.height,
        border: `4px solid ${CAL}`,
        borderTopWidth: props.sinArriba ? 0 : 4,
        borderBottomWidth: props.sinAbajo ? 0 : 4,
        borderRadius: props.radius ?? 0,
      }}
    />
  );
}

export function CanchaAfiche({
  equipos,
  ancho,
  alto,
}: {
  equipos: JugadorCancha[][];
  ancho: number;
  alto: number;
}) {
  const { ubicados } = ubicarEnCancha(equipos);
  const dos = equipos.length === 2;
  const muchos = ubicados.length > 14;
  const foto = muchos ? 54 : dos || ubicados.length > 7 ? 60 : 80;
  const tamNombre = muchos ? 22 : dos || ubicados.length > 7 ? 26 : 30;
  // Alto de la ficha (foto con marco + nombre): para que el nombre del arquero no se salga por abajo.
  const altoFicha = foto + 12 + 10 + tamNombre * 1.4;
  const franjas = 12;
  const m = Math.round(ancho * 0.04);
  const areaW = ancho * 0.52;
  const areaH = alto * 0.14;
  const chicaW = ancho * 0.26;
  const chicaH = alto * 0.05;
  const circulo = ancho * 0.24;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: ancho,
        height: alto,
        borderRadius: 36,
        overflow: "hidden",
        background: "#1d7a3e",
      }}
    >
      {Array.from({ length: franjas }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            display: "flex",
            left: 0,
            top: (alto / franjas) * i,
            width: ancho,
            height: alto / franjas + 1,
            background: i % 2 === 0 ? "#1d7a3e" : "#18703a",
          }}
        />
      ))}
      <Linea left={m} top={m} width={ancho - m * 2} height={alto - m * 2} radius={6} />
      <div style={{ position: "absolute", display: "flex", left: m, top: alto / 2 - 2, width: ancho - m * 2, height: 4, background: CAL }} />
      <Linea left={(ancho - circulo) / 2} top={(alto - circulo) / 2} width={circulo} height={circulo} radius={circulo} />
      <Linea left={(ancho - areaW) / 2} top={m} width={areaW} height={areaH} sinArriba />
      <Linea left={(ancho - chicaW) / 2} top={m} width={chicaW} height={chicaH} sinArriba />
      <Linea left={(ancho - areaW) / 2} top={alto - m - areaH} width={areaW} height={areaH} sinAbajo />
      <Linea left={(ancho - chicaW) / 2} top={alto - m - chicaH} width={chicaW} height={chicaH} sinAbajo />

      {ubicados.map(({ jugador, equipo, x, y }, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 220,
            left: (x / 100) * ancho - 110,
            top: Math.max(8, Math.min((y / 100) * alto - foto / 2 - 6, alto - altoFicha - 8)),
          }}
        >
          <div style={{ display: "flex", padding: 6, borderRadius: 999, background: COLOR[equipo] }}>
            {jugador.foto ? (
              <Foto src={jugador.foto} apodo={jugador.apodo} size={foto} acento={COLOR[equipo]} />
            ) : (
              // Sin foto: la inicial en el color del equipo sobre verde oscuro (sobre el marco se lee).
              <div
                style={{
                  display: "flex",
                  width: foto,
                  height: foto,
                  borderRadius: foto,
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#0f2a1f",
                  color: COLOR[equipo],
                  fontSize: foto * 0.5,
                }}
              >
                {jugador.apodo.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 8,
              padding: "2px 14px",
              borderRadius: 12,
              background: "rgba(8,9,12,0.82)",
              fontSize: tamNombre,
              textTransform: "uppercase",
              maxWidth: 220,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {jugador.etiqueta}
          </div>
        </div>
      ))}
    </div>
  );
}
