import { describe, expect, it } from "vitest";
import { parseConfig, tieneVotacion } from "./config";

const activa = (min: number) => ({ votacion_activa: true, min_jugadores_votacion: min });

describe("tieneVotacion", () => {
  it("sin mínimo (0) siempre hay votación", () => {
    expect(tieneVotacion(2, activa(0))).toBe(true);
  });

  it("no hay votación si jugaron menos que el mínimo", () => {
    expect(tieneVotacion(3, activa(6))).toBe(false);
  });

  it("hay votación si jugaron exactamente el mínimo", () => {
    expect(tieneVotacion(6, activa(6))).toBe(true);
  });

  it("si el grupo no vota, nunca hay votación", () => {
    expect(tieneVotacion(20, { votacion_activa: false, min_jugadores_votacion: 0 })).toBe(false);
  });
});

describe("parseConfig", () => {
  function form(campos: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.set(k, v);
    return fd;
  }

  it("checkbox marcado = votación activa", () => {
    expect(parseConfig(form({ votacion_activa: "on", min_jugadores_votacion: "8" }))).toEqual({
      votacion_activa: true,
      min_jugadores_votacion: 8,
    });
  });

  it("checkbox sin marcar = sin votación, mantiene el mínimo", () => {
    expect(parseConfig(form({ min_jugadores_votacion: "8" }))).toEqual({
      votacion_activa: false,
      min_jugadores_votacion: 8,
    });
  });

  it("rechaza un mínimo inválido", () => {
    expect(parseConfig(form({ votacion_activa: "on", min_jugadores_votacion: "-1" }))).toHaveProperty("error");
    expect(parseConfig(form({ votacion_activa: "on", min_jugadores_votacion: "2.5" }))).toHaveProperty("error");
  });
});
