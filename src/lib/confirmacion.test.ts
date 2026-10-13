import { describe, expect, it } from "vitest";
import { formatearMomento, partidoYaPaso, puedeCargarResultado, resultadoHabilitadoDesde } from "./confirmacion";

// 5 de octubre de 2026, 18:30 en Argentina (UTC-3).
const ahora = new Date("2026-10-05T21:30:00Z");

describe("partidoYaPaso", () => {
  it("un día anterior ya pasó, con o sin hora", () => {
    expect(partidoYaPaso("2026-10-04", null, ahora)).toBe(true);
    expect(partidoYaPaso("2026-10-04", "23:00", ahora)).toBe(true);
  });

  it("un día posterior no pasó", () => {
    expect(partidoYaPaso("2026-10-06", "10:00", ahora)).toBe(false);
  });

  it("hoy depende de la hora", () => {
    expect(partidoYaPaso("2026-10-05", "17:00:00", ahora)).toBe(true);
    expect(partidoYaPaso("2026-10-05", "21:00", ahora)).toBe(false);
  });

  it("hoy sin hora todavía no pasó", () => {
    expect(partidoYaPaso("2026-10-05", null, ahora)).toBe(false);
  });

  it("usa la hora de Argentina, no la del servidor (UTC)", () => {
    // 01:00 UTC del 6 = 22:00 del 5 en Argentina: el partido del 5 a las 23 todavía no pasó.
    expect(partidoYaPaso("2026-10-05", "23:00", new Date("2026-10-06T01:00:00Z"))).toBe(false);
  });
});

describe("puedeCargarResultado", () => {
  it("un partido a las 15 se carga recién desde las 16 (hora de Argentina)", () => {
    // 18:59 UTC = 15:59 en Argentina
    expect(puedeCargarResultado("2026-10-14", "15:00", new Date("2026-10-14T18:59:00Z"))).toBe(false);
    expect(puedeCargarResultado("2026-10-14", "15:00", new Date("2026-10-14T19:00:00Z"))).toBe(true);
  });

  it("acepta la hora con segundos, como viene de la base", () => {
    expect(puedeCargarResultado("2026-10-14", "15:00:00", new Date("2026-10-14T19:00:00Z"))).toBe(true);
  });

  it("un partido a las 23:30 se carga desde las 00:30 del día siguiente", () => {
    expect(resultadoHabilitadoDesde("2026-10-14", "23:30").toISOString()).toBe("2026-10-15T03:30:00.000Z");
  });

  it("sin hora se carga desde ese día", () => {
    expect(puedeCargarResultado("2026-10-14", null, new Date("2026-10-14T02:59:00Z"))).toBe(false);
    expect(puedeCargarResultado("2026-10-14", null, new Date("2026-10-14T03:00:00Z"))).toBe(true);
  });

  it("días antes no se puede", () => {
    expect(puedeCargarResultado("2026-10-18", "15:00", new Date("2026-10-14T19:00:00Z"))).toBe(false);
  });
});

describe("formatearMomento", () => {
  it("muestra día, fecha y hora de Argentina", () => {
    expect(formatearMomento(new Date("2026-10-14T19:00:00Z"))).toBe("mié 14/10 a las 16:00");
  });
});
