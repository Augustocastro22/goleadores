import { describe, expect, it } from "vitest";
import { votacionCerrada, votacionVencida } from "./votacion";

const ahora = new Date("2026-10-14T19:00:00Z");
const enUnaHora = "2026-10-14T20:00:00Z";
const haceUnaHora = "2026-10-14T18:00:00Z";

describe("votacionVencida", () => {
  it("sin límite no vence", () => {
    expect(votacionVencida(null, ahora)).toBe(false);
  });

  it("vence justo al llegar al límite", () => {
    expect(votacionVencida("2026-10-14T19:00:00Z", ahora)).toBe(true);
    expect(votacionVencida(enUnaHora, ahora)).toBe(false);
  });
});

describe("votacionCerrada", () => {
  it("no cierra si no hay participantes y no venció", () => {
    expect(
      votacionCerrada({ cierraEn: enUnaHora, totalParticipantes: 0, votosMvp: 0, votosPeor: 0, ahora })
    ).toBe(false);
  });

  it("cierra cuando todos votaron ambas categorías", () => {
    expect(
      votacionCerrada({ cierraEn: enUnaHora, totalParticipantes: 5, votosMvp: 5, votosPeor: 5, ahora })
    ).toBe(true);
  });

  it("no cierra si falta alguna categoría y no pasó el plazo", () => {
    expect(
      votacionCerrada({ cierraEn: enUnaHora, totalParticipantes: 5, votosMvp: 5, votosPeor: 4, ahora })
    ).toBe(false);
  });

  it("una categoría apagada no se espera para cerrar", () => {
    const base = { cierraEn: enUnaHora, totalParticipantes: 5, votosPeor: 0, conMvp: true, conPeor: false, ahora };
    expect(votacionCerrada({ ...base, votosMvp: 5 })).toBe(true);
    expect(votacionCerrada({ ...base, votosMvp: 4 })).toBe(false);
  });

  it("cierra igual por vencimiento del plazo aunque falten votos", () => {
    expect(
      votacionCerrada({ cierraEn: haceUnaHora, totalParticipantes: 5, votosMvp: 1, votosPeor: 0, ahora })
    ).toBe(true);
  });

  it("vencida cierra aunque no queden participantes en el grupo", () => {
    expect(
      votacionCerrada({ cierraEn: haceUnaHora, totalParticipantes: 0, votosMvp: 0, votosPeor: 0, ahora })
    ).toBe(true);
  });
});
