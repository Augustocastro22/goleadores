import { describe, expect, it } from "vitest";
import { armarSlots, futbolPara, ordenEnCancha, parseFormacion, repartir } from "./cancha";

describe("parseFormacion", () => {
  it("lee números separados por guion", () => {
    expect(parseFormacion("3-2-1")).toEqual([3, 2, 1]);
    expect(parseFormacion(" 2 - 2 ")).toEqual([2, 2]);
  });
  it("rechaza vacío o ceros", () => {
    expect(parseFormacion("")).toBeNull();
    expect(parseFormacion("2-0")).toBeNull();
  });
});

describe("armarSlots", () => {
  it("un equipo en toda la cancha: arquero abajo y ataque arriba", () => {
    const slots = armarSlots([2, 2], 1, "completa");
    expect(slots).toHaveLength(5);
    expect(slots[0]).toMatchObject({ arquero: true, yPct: 92 });
    expect(Math.min(...slots.map((s) => s.yPct))).toBe(14);
  });

  it("dos equipos: cada uno en su mitad, el de arriba espejado", () => {
    const abajo = armarSlots([2, 2], 1, "abajo");
    const arriba = armarSlots([2, 2], 2, "arriba");
    expect(abajo.every((s) => s.yPct > 50)).toBe(true);
    expect(arriba.every((s) => s.yPct < 50)).toBe(true);
    expect(arriba[0].yPct).toBe(100 - abajo[0].yPct);
    expect(new Set([...abajo, ...arriba].map((s) => s.id)).size).toBe(10);
  });
});

describe("futbolPara", () => {
  it("elige la opción más chica que alcanza", () => {
    expect(futbolPara(3)).toBe(5);
    expect(futbolPara(5)).toBe(5);
    expect(futbolPara(7)).toBe(7);
    expect(futbolPara(10)).toBe(11);
    expect(futbolPara(20)).toBe(11);
  });
});

describe("repartir y ordenEnCancha", () => {
  it("ubica en orden y los que sobran quedan afuera", () => {
    const slots = armarSlots([2, 2], 1, "completa");
    const asignaciones = repartir(["a", "b", "c", "d", "e", "f"], slots);
    expect(Object.keys(asignaciones)).toHaveLength(5);
    expect(asignaciones["e1-arq"]).toBe("a");
    expect(ordenEnCancha(asignaciones, slots)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
