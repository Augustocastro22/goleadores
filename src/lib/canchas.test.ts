import { describe, expect, it } from "vitest";
import { canchaExacta, filtrarCanchas, normalizarLugar, parecidas } from "./canchas";

const canchas = [{ nombre: "Green Park" }, { nombre: "Once Unidos" }, { nombre: "Club Atlético Ñuñoa" }];

describe("normalizarLugar", () => {
  it("ignora mayúsculas, tildes, espacios y signos", () => {
    expect(normalizarLugar("  Green   Park ")).toBe("greenpark");
    expect(normalizarLugar("Green-Park")).toBe("greenpark");
    expect(normalizarLugar("Club Atlético Ñuñoa")).toBe("clubatleticonunoa");
  });
});

describe("parecidas", () => {
  it("detecta la misma cancha mal escrita", () => {
    expect(parecidas("Gren Park", "Green Park")).toBe(true);
    expect(parecidas("Green Prak", "Green Park")).toBe(true);
    expect(parecidas("Once Unidso", "Once Unidos")).toBe(true);
  });

  it("no confunde canchas distintas ni cuenta las iguales", () => {
    expect(parecidas("GreenPark", "Green Park")).toBe(false);
    expect(parecidas("Ferro", "Once Unidos")).toBe(false);
    expect(parecidas("Cancha 1", "Cancha 2")).toBe(false);
    expect(parecidas("F5", "F7")).toBe(false);
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

  it("sugiere la cancha aunque esté mal escrita", () => {
    expect(filtrarCanchas(canchas, "gren park").map((c) => c.nombre)).toEqual(["Green Park"]);
  });
});

describe("canchaExacta", () => {
  it("reconoce la misma cancha escrita distinto", () => {
    expect(canchaExacta(canchas, "green  PARK")?.nombre).toBe("Green Park");
    expect(canchaExacta(canchas, "GreenPark")?.nombre).toBe("Green Park");
    expect(canchaExacta(canchas, "green")).toBeUndefined();
    expect(canchaExacta(canchas, "")).toBeUndefined();
  });
});
