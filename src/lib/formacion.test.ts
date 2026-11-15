import { describe, expect, it } from "vitest";
import { validarFormacion } from "./formacion";

const jugadores = new Set(["a", "b", "c"]);

describe("validarFormacion", () => {
  it("acepta jugadores e invitados en posiciones válidas", () => {
    const r = validarFormacion(
      {
        futbol: 5,
        formacion: "2-2",
        lugares: { "e1-arq": { jugador: "a" }, "e1-l0-0": { invitado: "  Primo de Juan " }, "e1-l1-1": { jugador: "b" } },
        posiciones: { "e1-arq": { x: 50, y: 120 } },
      },
      { jugadores, dosEquipos: false }
    );
    expect("formacion" in r && r.formacion.lugares["e1-l0-0"]).toEqual({ invitado: "Primo de Juan" });
    expect("formacion" in r && r.formacion.posiciones["e1-arq"]).toEqual({ x: 50, y: 95 });
  });

  it("la formación tiene que sumar los de campo", () => {
    const r = validarFormacion({ futbol: 7, formacion: "2-2", lugares: {} }, { jugadores, dosEquipos: false });
    expect(r).toEqual({ error: expect.stringContaining("sumar 6") });
  });

  it("rechaza jugadores que no están convocados o repetidos", () => {
    expect(
      validarFormacion({ futbol: 5, formacion: "2-2", lugares: { "e1-arq": { jugador: "z" } } }, { jugadores, dosEquipos: false })
    ).toHaveProperty("error");
    expect(
      validarFormacion(
        { futbol: 5, formacion: "2-2", lugares: { "e1-arq": { jugador: "a" }, "e1-l0-0": { jugador: "a" } } },
        { jugadores, dosEquipos: false }
      )
    ).toHaveProperty("error");
  });

  it("con dos equipos, acepta posiciones del segundo; con uno, no", () => {
    const lugares = { "e2-arq": { invitado: "Pedro" } };
    expect(validarFormacion({ futbol: 5, formacion: "2-2", lugares }, { jugadores, dosEquipos: true })).toHaveProperty(
      "formacion"
    );
    expect(validarFormacion({ futbol: 5, formacion: "2-2", lugares }, { jugadores, dosEquipos: false })).toHaveProperty(
      "error"
    );
  });

  it("un invitado sin nombre se ignora", () => {
    const r = validarFormacion(
      { futbol: 5, formacion: "2-2", lugares: { "e1-arq": { invitado: "   " } } },
      { jugadores, dosEquipos: false }
    );
    expect("formacion" in r && r.formacion.lugares).toEqual({});
  });
});
