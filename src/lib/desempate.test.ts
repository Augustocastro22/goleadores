import { describe, expect, it } from "vitest";
import { calcularEmpate } from "./desempate";

const participantes7 = ["a", "b", "c", "d", "e", "f", "g"];

describe("calcularEmpate", () => {
  it("no detecta empate cuando hay un ganador único", () => {
    const votos = [
      { votante: "a", votado: "d" },
      { votante: "b", votado: "d" },
      { votante: "c", votado: "e" },
    ];
    expect(calcularEmpate(participantes7, votos)).toBeNull();
  });

  it("devuelve null si nadie votó", () => {
    expect(calcularEmpate(participantes7, [])).toBeNull();
  });

  it("ejemplo 1: empate 3-3 definible por el único que no votó a ninguno de los dos", () => {
    // a,b,c votan a d; d,e,f votan a c; g vota a a.
    const votos = [
      { votante: "a", votado: "d" },
      { votante: "b", votado: "d" },
      { votante: "c", votado: "d" },
      { votante: "d", votado: "c" },
      { votante: "e", votado: "c" },
      { votante: "f", votado: "c" },
      { votante: "g", votado: "a" },
    ];
    const resultado = calcularEmpate(participantes7, votos);
    expect(resultado).not.toBeNull();
    expect(resultado!.empatados.sort()).toEqual(["c", "d"]);
    expect(resultado!.elegibles).toEqual(["g"]);
    expect(resultado!.definible).toBe(true);
  });

  it("ejemplo 2: empate 3-3 no definible porque el único candidato a elegible es uno de los empatados", () => {
    // a,b,c votan a d; d vota a e; e,f,g votan a a.
    const votos = [
      { votante: "a", votado: "d" },
      { votante: "b", votado: "d" },
      { votante: "c", votado: "d" },
      { votante: "d", votado: "e" },
      { votante: "e", votado: "a" },
      { votante: "f", votado: "a" },
      { votante: "g", votado: "a" },
    ];
    const resultado = calcularEmpate(participantes7, votos);
    expect(resultado).not.toBeNull();
    expect(resultado!.empatados.sort()).toEqual(["a", "d"]);
    expect(resultado!.elegibles).toEqual([]);
    expect(resultado!.definible).toBe(false);
  });

  it("empate entre 2 con 3 elegibles (impar): definible", () => {
    // a es votado por b,c; b es votado por a,d; c por e; d por f; e por g.
    const votos = [
      { votante: "b", votado: "a" },
      { votante: "c", votado: "a" },
      { votante: "a", votado: "b" },
      { votante: "d", votado: "b" },
      { votante: "e", votado: "c" },
      { votante: "f", votado: "d" },
      { votante: "g", votado: "e" },
    ];
    const resultado = calcularEmpate(participantes7, votos);
    expect(resultado).not.toBeNull();
    expect(resultado!.empatados.sort()).toEqual(["a", "b"]);
    expect(resultado!.elegibles.sort()).toEqual(["e", "f", "g"]);
    expect(resultado!.definible).toBe(true);
  });

  it("empate entre 2 con 2 elegibles (par): no definible, riesgo de re-empate", () => {
    const votos = [
      { votante: "a", votado: "c" },
      { votante: "b", votado: "c" },
      { votante: "d", votado: "e" },
      { votante: "e", votado: "d" },
      { votante: "f", votado: "g" },
      { votante: "g", votado: "d" },
    ];
    // c: 2, e: 1, d:2, g:1 → empatados c,d (2 cada uno); elegibles: f,g? revisemos
    const resultado = calcularEmpate(participantes7, votos);
    expect(resultado).not.toBeNull();
    expect(resultado!.empatados.sort()).toEqual(["c", "d"]);
    // f votó a g (no empatado) -> elegible; g votó a d (empatado) -> no elegible
    expect(resultado!.elegibles).toEqual(["f"]);
    expect(resultado!.definible).toBe(true);
  });

  it("empate triple 2-2-2 con exactamente 1 elegible: definible", () => {
    const participantes = ["a", "b", "c", "d", "e", "f", "g"];
    const votos = [
      { votante: "e", votado: "a" },
      { votante: "f", votado: "b" },
      { votante: "g", votado: "c" },
      { votante: "a", votado: "b" },
      { votante: "b", votado: "c" },
      { votante: "c", votado: "a" },
      { votante: "d", votado: "e" },
    ];
    // a:2(e,c) b:2(f,a) c:2(g,b) e:1(d) -> empatados a,b,c (2 cada uno)
    // e,f,g votaron a un empatado -> no elegibles; d votó a e (no empatado) -> único elegible
    const resultado = calcularEmpate(participantes, votos);
    expect(resultado).not.toBeNull();
    expect(resultado!.empatados.sort()).toEqual(["a", "b", "c"]);
    expect(resultado!.elegibles).toEqual(["d"]);
    expect(resultado!.definible).toBe(true);
  });

  it("empate triple con 2 elegibles: no definible, riesgo de re-empate", () => {
    const participantes = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const votos = [
      { votante: "b", votado: "a" },
      { votante: "c", votado: "a" },
      { votante: "d", votado: "e" },
      { votante: "f", votado: "e" },
      { votante: "g", votado: "d" },
      { votante: "a", votado: "d" },
      { votante: "h", votado: "b" },
      { votante: "i", votado: "c" },
    ];
    // a:2 e:2 d:2 (empatados); h y e... h votó b (no empatado) elegible; i votó c (no empatado) elegible
    const resultado = calcularEmpate(participantes, votos);
    expect(resultado).not.toBeNull();
    expect(resultado!.empatados.sort()).toEqual(["a", "d", "e"]);
    expect(resultado!.elegibles.sort()).toEqual(["h", "i"]);
    expect(resultado!.definible).toBe(false);
  });
});
