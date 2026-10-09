import { describe, expect, it } from "vitest";
import { estadoVisible, extraerCodigo, puedeCancelar, puedeResponder, seccionDesafio } from "./desafios";

const hoy = "2026-10-08";
const desafio = (
  estado: "pendiente" | "aceptado" | "rechazado" | "cancelado" | "vencido",
  fecha: string,
  soyDesafiante: boolean,
  resultadoCargado = false
) => ({
  estado,
  fecha,
  soy_desafiante: soyDesafiante,
  resultado_cargado: resultadoCargado,
});

describe("estadoVisible", () => {
  it("un pendiente con fecha pasada está vencido", () => {
    expect(estadoVisible(desafio("pendiente", "2026-10-07", true), hoy)).toBe("vencido");
  });

  it("un pendiente de hoy o después sigue pendiente", () => {
    expect(estadoVisible(desafio("pendiente", hoy, true), hoy)).toBe("pendiente");
  });

  it("los demás estados no vencen", () => {
    expect(estadoVisible(desafio("aceptado", "2026-10-01", true), hoy)).toBe("aceptado");
    expect(estadoVisible(desafio("rechazado", "2026-10-01", true), hoy)).toBe("rechazado");
  });
});

describe("seccionDesafio", () => {
  it("un pendiente recibido es para responder, uno enviado va a enviados", () => {
    expect(seccionDesafio(desafio("pendiente", "2026-10-10", false), hoy)).toBe("responder");
    expect(seccionDesafio(desafio("pendiente", "2026-10-10", true), hoy)).toBe("enviados");
  });

  it("un aceptado es próximo hasta el día del partido inclusive", () => {
    expect(seccionDesafio(desafio("aceptado", hoy, true), hoy)).toBe("proximos");
    expect(seccionDesafio(desafio("aceptado", "2026-10-07", true), hoy)).toBe("historial");
  });

  it("vencidos, rechazados y cancelados van al historial", () => {
    expect(seccionDesafio(desafio("pendiente", "2026-10-07", false), hoy)).toBe("historial");
    expect(seccionDesafio(desafio("rechazado", "2026-10-10", true), hoy)).toBe("historial");
    expect(seccionDesafio(desafio("cancelado", "2026-10-10", false), hoy)).toBe("historial");
  });
});

describe("puedeResponder", () => {
  it("solo el desafiado, mientras está pendiente y no venció", () => {
    expect(puedeResponder(desafio("pendiente", "2026-10-10", false), hoy)).toBe(true);
    expect(puedeResponder(desafio("pendiente", "2026-10-10", true), hoy)).toBe(false);
    expect(puedeResponder(desafio("pendiente", "2026-10-07", false), hoy)).toBe(false);
    expect(puedeResponder(desafio("aceptado", "2026-10-10", false), hoy)).toBe(false);
  });
});

describe("puedeCancelar", () => {
  it("un pendiente lo cancela solo el desafiante", () => {
    expect(puedeCancelar(desafio("pendiente", "2026-10-10", true), hoy)).toBe(true);
    expect(puedeCancelar(desafio("pendiente", "2026-10-10", false), hoy)).toBe(false);
  });

  it("un aceptado lo cancela cualquiera mientras no se cargó el resultado", () => {
    expect(puedeCancelar(desafio("aceptado", "2026-10-10", false), hoy)).toBe(true);
    expect(puedeCancelar(desafio("aceptado", "2026-10-07", true), hoy)).toBe(true);
    expect(puedeCancelar(desafio("aceptado", "2026-10-07", true, true), hoy)).toBe(false);
  });

  it("vencidos, rechazados y cancelados no se cancelan", () => {
    expect(puedeCancelar(desafio("pendiente", "2026-10-07", true), hoy)).toBe(false);
    expect(puedeCancelar(desafio("rechazado", "2026-10-10", true), hoy)).toBe(false);
  });
});

describe("extraerCodigo", () => {
  it("saca el código del mensaje de Compartir", () => {
    expect(extraerCodigo("Desafiá a Los Pibes en Goleadores con este código: 3fa9c01b2e")).toBe("3fa9c01b2e");
  });

  it("acepta el código solo, con espacios o en mayúsculas", () => {
    expect(extraerCodigo("  3FA9C01B2E ")).toBe("3fa9c01b2e");
  });

  it("si no hay un código, devuelve lo pegado", () => {
    expect(extraerCodigo(" cualquiera ")).toBe("cualquiera");
  });
});

describe("vencido guardado en la base", () => {
  it("va al historial y no se responde ni se cancela", () => {
    expect(seccionDesafio(desafio("vencido", "2026-10-07", false), hoy)).toBe("historial");
    expect(puedeResponder(desafio("vencido", "2026-10-07", false), hoy)).toBe(false);
    expect(puedeCancelar(desafio("vencido", "2026-10-07", true), hoy)).toBe(false);
  });
});
