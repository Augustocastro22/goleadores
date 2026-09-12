import { describe, expect, it } from "vitest";
import { votacionCerrada } from "./votacion";

describe("votacionCerrada", () => {
  it("no cierra si nadie votó todavía", () => {
    expect(
      votacionCerrada({ fechaPartido: "2026-01-01", totalParticipantes: 0, votosMvp: 0, votosPeor: 0 })
    ).toBe(false);
  });

  it("cierra cuando todos votaron ambas categorías", () => {
    expect(
      votacionCerrada({ fechaPartido: "2026-01-01", totalParticipantes: 5, votosMvp: 5, votosPeor: 5 })
    ).toBe(true);
  });

  it("no cierra si falta alguna categoría y no pasó el plazo", () => {
    const hoy = new Date().toISOString().slice(0, 10);
    expect(
      votacionCerrada({ fechaPartido: hoy, totalParticipantes: 5, votosMvp: 5, votosPeor: 4 })
    ).toBe(false);
  });

  it("cierra igual por vencimiento del plazo aunque falten votos", () => {
    expect(
      votacionCerrada({ fechaPartido: "2000-01-01", totalParticipantes: 5, votosMvp: 1, votosPeor: 0 })
    ).toBe(true);
  });
});
