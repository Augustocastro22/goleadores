import { afterEach, describe, expect, it } from "vitest";
import { activosPorSemana, contarPorSemana, diaDe, lunesDe, puedeVerMetricas, ultimasSemanas } from "./metricas";
import { diaArgentina } from "./visitas";

describe("semanas", () => {
  it("lunesDe devuelve el lunes de la semana (domingo cuenta en la anterior)", () => {
    expect(lunesDe("2026-11-19")).toBe("2026-11-16"); // jueves
    expect(lunesDe("2026-11-16")).toBe("2026-11-16"); // lunes
    expect(lunesDe("2026-11-22")).toBe("2026-11-16"); // domingo
  });

  it("ultimasSemanas va de la más vieja a la actual", () => {
    expect(ultimasSemanas("2026-11-19", 3)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });

  it("el día de un timestamp es el de Argentina", () => {
    // 02:00 UTC del lunes todavía es domingo a la noche en Argentina.
    expect(diaDe("2026-11-16T02:00:00+00:00")).toBe("2026-11-15");
    expect(diaArgentina(new Date("2026-11-16T03:30:00Z"))).toBe("2026-11-16");
    expect(diaDe("2026-11-16")).toBe("2026-11-16");
  });
});

describe("conteos", () => {
  const semanas = ["2026-11-09", "2026-11-16"];

  it("contarPorSemana ignora nulos y fechas fuera de rango", () => {
    const conteo = contarPorSemana(
      ["2026-11-10T15:00:00Z", "2026-11-17T15:00:00Z", "2026-11-18", null, "2026-10-01T00:00:00Z"],
      semanas
    );
    expect([...conteo]).toEqual([
      ["2026-11-09", 1],
      ["2026-11-16", 2],
    ]);
  });

  it("activosPorSemana cuenta usuarios distintos", () => {
    const activos = activosPorSemana(
      [
        { jugador_id: "a", dia: "2026-11-16" },
        { jugador_id: "a", dia: "2026-11-17" },
        { jugador_id: "b", dia: "2026-11-18" },
        { jugador_id: "a", dia: "2026-11-10" },
      ],
      semanas
    );
    expect(activos.get("2026-11-16")).toBe(2);
    expect(activos.get("2026-11-09")).toBe(1);
  });
});

describe("puedeVerMetricas", () => {
  const original = process.env.METRICAS_EMAILS;
  afterEach(() => {
    process.env.METRICAS_EMAILS = original;
  });

  it("solo los mails de METRICAS_EMAILS, sin importar mayúsculas", () => {
    process.env.METRICAS_EMAILS = "dueno@ejemplo.com, otro@ejemplo.com";
    expect(puedeVerMetricas("Dueno@Ejemplo.com")).toBe(true);
    expect(puedeVerMetricas("otro@ejemplo.com")).toBe(true);
    expect(puedeVerMetricas("cualquiera@ejemplo.com")).toBe(false);
    expect(puedeVerMetricas(null)).toBe(false);
  });

  it("sin la variable no lo ve nadie", () => {
    delete process.env.METRICAS_EMAILS;
    expect(puedeVerMetricas("dueno@ejemplo.com")).toBe(false);
  });
});
