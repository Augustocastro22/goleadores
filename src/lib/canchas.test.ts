import { describe, expect, it } from "vitest";
import { canchaExacta, filtrarCanchas, normalizarLugar } from "./canchas";

const canchas = [{ nombre: "Green Park" }, { nombre: "Once Unidos" }, { nombre: "Club Atlético Ñuñoa" }];

describe("normalizarLugar", () => {
  it("ignora mayúsculas, tildes y espacios de más", () => {
    expect(normalizarLugar("  Green   Park ")).toBe("green park");
    expect(normalizarLugar("Club Atlético Ñuñoa")).toBe("club atletico nunoa");
  });
});

describe("filtrarCanchas", () => {
  it("sin nada escrito muestra todas", () => {
    expect(filtrarCanchas(canchas, " ")).toEqual(canchas);
  });

  it("filtra por parte del nombre", () => {
    expect(filtrarCanchas(canchas, "park").map((c) => c.nombre)).toEqual(["Green Park"]);
    expect(filtrarCanchas(canchas, "atletico").map((c) => c.nombre)).toEqual(["Club Atlético Ñuñoa"]);
    expect(filtrarCanchas(canchas, "ferro")).toEqual([]);
  });
});

describe("canchaExacta", () => {
  it("reconoce la misma cancha escrita distinto", () => {
    expect(canchaExacta(canchas, "green  PARK")?.nombre).toBe("Green Park");
    expect(canchaExacta(canchas, "green")).toBeUndefined();
    expect(canchaExacta(canchas, "")).toBeUndefined();
  });
});
