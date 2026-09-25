import { describe, expect, it } from "vitest";
import { bloqueaFecha, describirBloqueo } from "./disponibilidad";
import type { Bloqueo } from "./types";

function bloqueo(overrides: Partial<Bloqueo>): Bloqueo {
  return {
    id: "1",
    jugador_id: "j1",
    tipo: "puntual",
    fecha_desde: null,
    fecha_hasta: null,
    dia_semana: null,
    hora_desde: null,
    hora_hasta: null,
    nota: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("bloqueaFecha", () => {
  it("puntual: coincide exacto con la fecha, sin horario bloquea todo el día", () => {
    const b = bloqueo({ tipo: "puntual", fecha_desde: "2026-09-27" });
    expect(bloqueaFecha(b, "2026-09-27", "17:00:00")).toBe(true);
    expect(bloqueaFecha(b, "2026-09-27", null)).toBe(true);
    expect(bloqueaFecha(b, "2026-09-28", "17:00:00")).toBe(false);
  });

  it("puntual con horario: solo bloquea si el partido cae dentro del rango", () => {
    const b = bloqueo({
      tipo: "puntual",
      fecha_desde: "2026-09-27",
      hora_desde: "15:00:00",
      hora_hasta: "20:00:00",
    });
    expect(bloqueaFecha(b, "2026-09-27", "17:00:00")).toBe(true);
    expect(bloqueaFecha(b, "2026-09-27", "21:00:00")).toBe(false);
    expect(bloqueaFecha(b, "2026-09-27", "15:00:00")).toBe(true);
    // Partido sin hora cargada: no se puede descartar, se avisa igual.
    expect(bloqueaFecha(b, "2026-09-27", null)).toBe(true);
  });

  it("rango: coincide si la fecha cae entre desde y hasta, inclusive", () => {
    const b = bloqueo({ tipo: "rango", fecha_desde: "2026-10-01", fecha_hasta: "2026-10-15" });
    expect(bloqueaFecha(b, "2026-09-30", null)).toBe(false);
    expect(bloqueaFecha(b, "2026-10-01", null)).toBe(true);
    expect(bloqueaFecha(b, "2026-10-10", null)).toBe(true);
    expect(bloqueaFecha(b, "2026-10-15", null)).toBe(true);
    expect(bloqueaFecha(b, "2026-10-16", null)).toBe(false);
  });

  it("recurrente: coincide por día de la semana, sin importar la fecha exacta", () => {
    // 2026-09-27 es domingo.
    const b = bloqueo({ tipo: "recurrente", dia_semana: 0 });
    expect(bloqueaFecha(b, "2026-09-27", null)).toBe(true);
    expect(bloqueaFecha(b, "2026-10-04", null)).toBe(true); // otro domingo
    expect(bloqueaFecha(b, "2026-09-28", null)).toBe(false); // lunes
  });

  it("recurrente con horario acotado", () => {
    const b = bloqueo({
      tipo: "recurrente",
      dia_semana: 6, // sábado
      hora_desde: "15:00:00",
      hora_hasta: "20:00:00",
    });
    expect(bloqueaFecha(b, "2026-09-26", "17:00:00")).toBe(true); // sábado
    expect(bloqueaFecha(b, "2026-09-26", "10:00:00")).toBe(false);
    expect(bloqueaFecha(b, "2026-09-27", "17:00:00")).toBe(false); // domingo
  });
});

describe("describirBloqueo", () => {
  it("pluraliza bien los días que ya terminan en s (no duplica la s)", () => {
    const b = bloqueo({ tipo: "recurrente", dia_semana: 3 });
    expect(describirBloqueo(b)).toBe("Todos los miércoles");
  });

  it("pluraliza bien un día que no termina en s", () => {
    const b = bloqueo({ tipo: "recurrente", dia_semana: 6 });
    expect(describirBloqueo(b)).toBe("Todos los sábados");
  });

  it("puntual con horario incluye el rango de horas", () => {
    const b = bloqueo({
      tipo: "puntual",
      fecha_desde: "2026-09-27",
      hora_desde: "15:00:00",
      hora_hasta: "20:00:00",
    });
    expect(describirBloqueo(b)).toBe("27 sept de 15:00 a 20:00");
  });
});
