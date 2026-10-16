import { describe, expect, it } from "vitest";
import {
  CONFIG_DEFAULTS,
  esPartidoInterno,
  parseConfig,
  parseModoJuego,
  REGLAS_GRUPO_NUEVO,
  votacionDelPartido,
} from "./config";

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
    // Cómo juegan es obligatorio: por defecto, un equipo.
    for (const [k, v] of Object.entries({ modo_juego: "equipo", ...campos })) fd.set(k, v);
    return fd;
  }

  it("cada checkbox prende su categoría", () => {
    expect(parseConfig(form({ vota_mvp: "on", vota_peor: "on", min_jugadores_votacion: "8" }))).toEqual({
      vota_mvp: true,
      vota_peor: true,
      min_jugadores_votacion: 8,
      pedir_confirmacion: false,
      modo_juego: "equipo",
      nombre_equipo_1: "Equipo A",
      nombre_equipo_2: "Equipo B",
    });
    expect(parseConfig(form({ vota_mvp: "on", min_jugadores_votacion: "8" }))).toEqual({
      vota_mvp: true,
      vota_peor: false,
      min_jugadores_votacion: 8,
      pedir_confirmacion: false,
      modo_juego: "equipo",
      nombre_equipo_1: "Equipo A",
      nombre_equipo_2: "Equipo B",
    });
  });

  it("checkboxes sin marcar = sin votación, mantiene el mínimo", () => {
    expect(parseConfig(form({ min_jugadores_votacion: "8" }))).toEqual({
      vota_mvp: false,
      vota_peor: false,
      min_jugadores_votacion: 8,
      pedir_confirmacion: false,
      modo_juego: "equipo",
      nombre_equipo_1: "Equipo A",
      nombre_equipo_2: "Equipo B",
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

describe("REGLAS_GRUPO_NUEVO", () => {
  it("un grupo nuevo arranca sin Peor Jugador, sin cambiar los grupos que ya existen", () => {
    expect(REGLAS_GRUPO_NUEVO.vota_peor).toBe(false);
    expect(REGLAS_GRUPO_NUEVO.vota_mvp).toBe(true);
    expect(CONFIG_DEFAULTS.vota_peor).toBe(true);
  });
});

describe("parseModoJuego", () => {
  const form = (campos: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.set(k, v);
    return fd;
  };

  it("hay que elegir cómo juegan", () => {
    expect(parseModoJuego(form({}))).toEqual({ error: "Elegí cómo juega el grupo." });
  });

  it("entre nosotros con nombres propios", () => {
    expect(
      parseModoJuego(form({ modo_juego: "entre_nosotros", nombre_equipo_1: " Blancos ", nombre_equipo_2: "Negros" }))
    ).toEqual({ modo_juego: "entre_nosotros", nombre_equipo_1: "Blancos", nombre_equipo_2: "Negros" });
  });

  it("sin nombres, Equipo A y Equipo B; iguales, error", () => {
    expect(parseModoJuego(form({ modo_juego: "entre_nosotros" }))).toMatchObject({
      nombre_equipo_1: "Equipo A",
      nombre_equipo_2: "Equipo B",
    });
    expect(parseModoJuego(form({ modo_juego: "entre_nosotros", nombre_equipo_1: "Rojo", nombre_equipo_2: "rojo" }))).toEqual({
      error: "Los dos equipos tienen que tener nombres distintos.",
    });
  });
});

describe("esPartidoInterno", () => {
  it("entre ellos si alguien del grupo jugó en el segundo equipo", () => {
    expect(esPartidoInterno(3)).toBe(true);
    expect(esPartidoInterno(0)).toBe(false);
  });

  it("un desafío nunca es entre ellos", () => {
    expect(esPartidoInterno(3, "desafio-1")).toBe(false);
  });
});
