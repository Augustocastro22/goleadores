import { describe, expect, it } from "vitest";
import { tocaRecordar } from "./recordatorios";

// Las 10 de la mañana en Argentina (13 UTC), cuando corre el cron.
const ahora = new Date("2026-10-15T13:00:00Z");

describe("tocaRecordar", () => {
  it("convocado ayer a las 9 y hoy a las 10 (25 h): sí", () => {
    expect(tocaRecordar({ convocado_en: "2026-10-14T12:00:00Z", recordado_en: null }, ahora)).toBe(true);
  });

  it("convocado hoy a las 9 (1 h antes del cron): no, el aviso de la convocatoria está fresco", () => {
    expect(tocaRecordar({ convocado_en: "2026-10-15T12:00:00Z", recordado_en: null }, ahora)).toBe(false);
  });

  it("ya se le recordó ayer a la mañana: sí, es otro día", () => {
    expect(
      tocaRecordar({ convocado_en: "2026-10-10T12:00:00Z", recordado_en: "2026-10-14T13:00:00Z" }, ahora)
    ).toBe(true);
  });

  it("se le recordó hace un rato (el cron corrió dos veces): no", () => {
    expect(
      tocaRecordar({ convocado_en: "2026-10-10T12:00:00Z", recordado_en: "2026-10-15T12:55:00Z" }, ahora)
    ).toBe(false);
  });
});
