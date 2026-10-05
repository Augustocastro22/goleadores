import { describe, expect, it } from "vitest";
import { partidoYaPaso } from "./confirmacion";

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
