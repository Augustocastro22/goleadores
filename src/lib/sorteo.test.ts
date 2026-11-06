import { describe, expect, it } from "vitest";
import { sortearEquipos } from "./sorteo";

describe("sortearEquipos", () => {
  it("reparte a todos, parejo en cantidad", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    const equipos = sortearEquipos(ids);
    expect(Object.keys(equipos).sort()).toEqual(ids);
    const enUno = Object.values(equipos).filter((e) => e === 1).length;
    expect(enUno).toBe(5);
  });

  it("con impares, la diferencia es de uno", () => {
    const equipos = sortearEquipos(["a", "b", "c", "d", "e"]);
    const enUno = Object.values(equipos).filter((e) => e === 1).length;
    expect([2, 3]).toContain(enUno);
  });

  it("con el mismo azar sale lo mismo, y cambia con otro", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const secuencia = (valores: number[]) => {
      let i = 0;
      return () => valores[i++ % valores.length];
    };
    const uno = sortearEquipos(ids, secuencia([0.1, 0.7, 0.3, 0.9, 0.5, 0.2]));
    expect(sortearEquipos(ids, secuencia([0.1, 0.7, 0.3, 0.9, 0.5, 0.2]))).toEqual(uno);
    expect(sortearEquipos(ids, secuencia([0.6, 0.1, 0.8, 0.4, 0.0, 0.7]))).not.toEqual(uno);
  });

  it("sin jugadores no hay equipos", () => {
    expect(sortearEquipos([])).toEqual({});
  });
});
