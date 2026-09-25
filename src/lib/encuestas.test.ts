import { describe, expect, it } from "vitest";
import { encuestaCerrada } from "./encuestas";

describe("encuestaCerrada", () => {
  it("no cierra si no votó todo el mundo y el plazo no venció", () => {
    const enUnaHora = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(
      encuestaCerrada({ cierraEn: enUnaHora, totalParticipantes: 9, totalVotos: 3 })
    ).toBe(false);
  });

  it("cierra si votó todo el plantel, aunque no haya vencido el plazo", () => {
    const enUnaHora = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(
      encuestaCerrada({ cierraEn: enUnaHora, totalParticipantes: 9, totalVotos: 9 })
    ).toBe(true);
  });

  it("cierra si venció el plazo, aunque falten votos", () => {
    expect(
      encuestaCerrada({ cierraEn: "2000-01-01T00:00:00Z", totalParticipantes: 9, totalVotos: 1 })
    ).toBe(true);
  });

  it("no cierra por votos si no hay participantes cargados (evita división rara)", () => {
    const enUnaHora = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(
      encuestaCerrada({ cierraEn: enUnaHora, totalParticipantes: 0, totalVotos: 0 })
    ).toBe(false);
  });
});
