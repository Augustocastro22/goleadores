import { describe, expect, it } from "vitest";
import {
  calcularNiveles,
  historialPorJugador,
  MIN_PARTIDOS,
  nivelDe,
  puntajeEquipos,
  sortearParejos,
  type FilaHistorial,
} from "./nivel";

const fila = (partido_id: string, jugador_id: string, equipo: 1 | 2, goles = 0, extra: Partial<FilaHistorial> = {}) => ({
  partido_id,
  jugador_id,
  equipo,
  goles,
  goles_rival: 0,
  goles_otros: 0,
  ...extra,
});

describe("historialPorJugador", () => {
  it("suma 3 al que gana, 1 al empatar, 0 al perder, desde su equipo", () => {
    const h = historialPorJugador([
      // p1: entre ellos, gana el equipo 2 (2-1)
      fila("p1", "a", 1, 1),
      fila("p1", "b", 2, 2),
      // p2: contra otro equipo, 1-1 (el gol del rival en goles_rival): también cuenta
      fila("p2", "a", 1, 1, { goles_rival: 1 }),
      fila("p2", "b", 1, 0, { goles_rival: 1 }),
    ]);
    expect(h.get("a")).toEqual({ partidos: 2, puntos: 1, goles: 2 });
    expect(h.get("b")).toEqual({ partidos: 2, puntos: 4, goles: 2 });
  });

  it("cuenta los goles_otros para el equipo 1", () => {
    const h = historialPorJugador([fila("p", "a", 1, 0, { goles_otros: 1 }), fila("p", "b", 2, 0)]);
    expect(h.get("a")!.puntos).toBe(3);
    expect(h.get("b")!.puntos).toBe(0);
  });
});

describe("calcularNiveles", () => {
  const h = (partidos: number, puntos: number, goles: number) => ({ partidos, puntos, goles });

  it("sin nadie medido ni con nivel a mano no hay niveles", () => {
    expect(calcularNiveles(new Map([["a", h(MIN_PARTIDOS - 1, 12, 4)]]))).toBeNull();
  });

  it("del 1 al 10: el mejor en las dos cosas tiene 10 y el peor 1", () => {
    const n = calcularNiveles(
      new Map([
        ["crack", h(10, 30, 20)],
        ["medio", h(10, 15, 10)],
        ["flojo", h(10, 0, 0)],
      ])
    )!;
    expect(n.medidos).toEqual({ crack: 10, medio: 5.5, flojo: 1 });
  });

  it("los puntos pesan más que los goles", () => {
    const n = calcularNiveles(
      new Map([
        ["ganador", h(10, 30, 0)],
        ["goleador", h(10, 0, 20)],
      ])
    )!;
    expect(n.medidos.ganador).toBe(7.3);
    expect(n.medidos.goleador).toBe(3.7);
  });

  it("con pocos partidos vale el nivel a mano o, si no hay, el promedio; y no mueve el min/max", () => {
    const n = calcularNiveles(
      new Map([
        ["a", h(10, 30, 20)],
        ["b", h(10, 0, 0)],
        ["nuevoMalo", h(1, 3, 5)],
        ["nuevo", h(2, 6, 0)],
      ]),
      { manuales: { nuevoMalo: 2 } }
    )!;
    expect(nivelDe(n, "a")).toBe(10);
    expect(nivelDe(n, "b")).toBe(1);
    expect(nivelDe(n, "nuevoMalo")).toBe(2);
    // Promedio de 10, 1 y 2.
    expect(nivelDe(n, "nuevo")).toBe(4.3);
  });

  it("el nivel a mano no pisa al historial", () => {
    const n = calcularNiveles(new Map([["a", h(10, 30, 20)]]), { manuales: { a: 3 } })!;
    expect(nivelDe(n, "a")).toBe(5.5);
    expect(n.manuales).toEqual({});
  });

  it("solo con niveles a mano también hay niveles", () => {
    const n = calcularNiveles(new Map(), { manuales: { a: 8, b: 4 } })!;
    expect(n.promedio).toBe(6);
  });

  it("solo cuenta a los miembros", () => {
    const n = calcularNiveles(
      new Map([
        ["a", h(10, 30, 20)],
        ["b", h(10, 15, 10)],
        ["otroGrupo", h(10, 0, 0)],
      ]),
      { miembros: new Set(["a", "b"]) }
    )!;
    expect(n.medidos).toEqual({ a: 10, b: 1 });
  });
});

describe("puntajeEquipos", () => {
  it("es el promedio de cada equipo", () => {
    const nivel = (id: string) => ({ a: 8, b: 6, c: 5, d: 9, e: 4 })[id]!;
    expect(puntajeEquipos({ a: 1, b: 1, c: 2, d: 2, e: 2 }, nivel)).toEqual([7, 6]);
  });
});

describe("sortearParejos", () => {
  const niveles: Record<string, number> = { a: 10, b: 9, c: 8, d: 3, e: 2, f: 1 };
  const nivel = (id: string) => niveles[id];

  it("reparte a todos, parejo en cantidad y cerca del mejor promedio posible", () => {
    const ids = Object.keys(niveles);
    const equipos = sortearParejos(ids, nivel);
    expect(Object.keys(equipos).sort()).toEqual(ids);
    expect(Object.values(equipos).filter((e) => e === 1)).toHaveLength(3);
    const [uno, dos] = puntajeEquipos(equipos, nivel);
    // El mejor reparto posible, probando todos los de 3 contra 3.
    let mejor = Infinity;
    for (let mask = 0; mask < 1 << ids.length; mask++) {
      const enUno = ids.filter((_, i) => mask & (1 << i));
      if (enUno.length !== 3) continue;
      const [x, y] = puntajeEquipos(Object.fromEntries(ids.map((id) => [id, enUno.includes(id) ? 1 : 2])), nivel);
      mejor = Math.min(mejor, Math.abs(x - y));
    }
    expect(Math.abs(uno - dos)).toBeLessThanOrEqual(mejor + 0.2 + 1e-9);
  });

  it("con impares empareja el promedio, no la suma", () => {
    // 4 contra 3: los 3 terminan sumando menos (el que falta lo completa un invitado).
    const n: Record<string, number> = { a: 9, b: 8, c: 7, d: 6, e: 5, f: 4, g: 3 };
    const equipos = sortearParejos(Object.keys(n), (id) => n[id]);
    const [uno, dos] = puntajeEquipos(equipos, (id) => n[id]);
    expect(Math.abs(uno - dos)).toBeLessThan(0.3);
  });

  it("no separa siempre igual", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const vistos = new Set(
      Array.from({ length: 10 }, () => JSON.stringify(sortearParejos(ids, () => 5, Math.random, 200)))
    );
    expect(vistos.size).toBeGreaterThan(1);
  });
});
