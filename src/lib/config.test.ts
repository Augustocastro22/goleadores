import { describe, expect, it } from "vitest";
import { parseConfig, votacionDelPartido } from "./config";

const ambas = (min: number) => ({ vota_mvp: true, vota_peor: true, min_jugadores_votacion: min });

describe("votacionDelPartido", () => {
  it("sin mínimo (0) siempre hay votación", () => {
    expect(votacionDelPartido(2, ambas(0))).toEqual({ con_votacion: true, con_mvp: true, con_peor: true });
  });

  it("no hay votación si jugaron menos que el mínimo", () => {
    expect(votacionDelPartido(3, ambas(6))).toEqual({ con_votacion: false, con_mvp: false, con_peor: false });
  });

  it("hay votación si jugaron exactamente el mínimo", () => {
    expect(votacionDelPartido(6, ambas(6)).con_votacion).toBe(true);
  });

  it("solo vota las categorías que el grupo tiene prendidas", () => {
    expect(votacionDelPartido(10, { vota_mvp: true, vota_peor: false, min_jugadores_votacion: 0 })).toEqual({
      con_votacion: true,
      con_mvp: true,
      con_peor: false,
    });
    expect(votacionDelPartido(10, { vota_mvp: false, vota_peor: true, min_jugadores_votacion: 0 })).toEqual({
      con_votacion: true,
      con_mvp: false,
      con_peor: true,
    });
  });

  it("si el grupo no vota nada, nunca hay votación", () => {
    expect(
      votacionDelPartido(20, { vota_mvp: false, vota_peor: false, min_jugadores_votacion: 0 }).con_votacion
    ).toBe(false);
  });
});

describe("parseConfig", () => {
  function form(campos: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.set(k, v);
    return fd;
  }

  it("cada checkbox prende su categoría", () => {
    expect(parseConfig(form({ vota_mvp: "on", vota_peor: "on", min_jugadores_votacion: "8" }))).toEqual({
      vota_mvp: true,
      vota_peor: true,
      min_jugadores_votacion: 8,
      pedir_confirmacion: false,
    });
    expect(parseConfig(form({ vota_mvp: "on", min_jugadores_votacion: "8" }))).toEqual({
      vota_mvp: true,
      vota_peor: false,
      min_jugadores_votacion: 8,
      pedir_confirmacion: false,
    });
  });

  it("checkboxes sin marcar = sin votación, mantiene el mínimo", () => {
    expect(parseConfig(form({ min_jugadores_votacion: "8" }))).toEqual({
      vota_mvp: false,
      vota_peor: false,
      min_jugadores_votacion: 8,
      pedir_confirmacion: false,
    });
  });

  it("el checkbox de confirmación prende pedir_confirmacion", () => {
    expect(parseConfig(form({ pedir_confirmacion: "on", min_jugadores_votacion: "0" }))).toMatchObject({
      pedir_confirmacion: true,
    });
  });

  it("rechaza un mínimo inválido", () => {
    expect(parseConfig(form({ vota_mvp: "on", min_jugadores_votacion: "-1" }))).toHaveProperty("error");
    expect(parseConfig(form({ vota_mvp: "on", min_jugadores_votacion: "2.5" }))).toHaveProperty("error");
  });
});
