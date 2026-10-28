import { describe, expect, it } from "vitest";
import {
  armarBloqueos,
  bloqueaFecha,
  bloqueosDeAgenda,
  bloqueosEnHora,
  describirBloqueo,
  liberarDia,
  mismoBloqueo,
  partirRango,
  puedeEnHora,
  tipoEnHora,
  validarBloqueo,
} from "./disponibilidad";
import type { Bloqueo } from "./types";

function bloqueo(overrides: Partial<Bloqueo>): Bloqueo {
  return {
    id: "1",
    jugador_id: "j1",
    grupo_id: null,
    tipo: "puntual",
    fecha_desde: null,
    fecha_hasta: null,
    dia_semana: null,
    hora_desde: null,
    hora_hasta: null,
    nota: null,
    excepciones: [],
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

describe("armarBloqueos", () => {
  it("días seguidos quedan como rango y los sueltos como puntuales", () => {
    expect(
      armarBloqueos({ fechas: ["2026-10-16", "2026-10-09", "2026-10-15"], diasSemana: [], horarios: null })
    ).toEqual([
      { tipo: "puntual", fecha_desde: "2026-10-09", fecha_hasta: null, dia_semana: null, hora_desde: null, hora_hasta: null },
      { tipo: "rango", fecha_desde: "2026-10-15", fecha_hasta: "2026-10-16", dia_semana: null, hora_desde: null, hora_hasta: null },
    ]);
  });

  it("un rango cruza el fin de mes", () => {
    const [b] = armarBloqueos({ fechas: ["2026-10-31", "2026-11-01"], diasSemana: [], horarios: null });
    expect(b).toMatchObject({ tipo: "rango", fecha_desde: "2026-10-31", fecha_hasta: "2026-11-01" });
  });

  it("varios horarios en un día de la semana: un bloqueo por horario", () => {
    expect(
      armarBloqueos({
        fechas: [],
        diasSemana: [4],
        horarios: [
          { desde: "14:00", hasta: "16:00" },
          { desde: "20:00", hasta: "24:00" },
        ],
      })
    ).toEqual([
      { tipo: "recurrente", fecha_desde: null, fecha_hasta: null, dia_semana: 4, hora_desde: "14:00", hora_hasta: "16:00" },
      { tipo: "recurrente", fecha_desde: null, fecha_hasta: null, dia_semana: 4, hora_desde: "20:00", hora_hasta: "24:00" },
    ]);
  });
});

describe("validarBloqueo", () => {
  const base = { tipo: "puntual" as const, fecha_desde: "2026-10-09", fecha_hasta: null, dia_semana: null };

  it("acepta hasta medianoche (24:00)", () => {
    expect(validarBloqueo({ ...base, hora_desde: "20:00", hora_hasta: "24:00" })).toBeNull();
  });

  it("rechaza un horario al revés o incompleto", () => {
    expect(validarBloqueo({ ...base, hora_desde: "22:00", hora_hasta: "18:00" })).not.toBeNull();
    expect(validarBloqueo({ ...base, hora_desde: "22:00", hora_hasta: null })).not.toBeNull();
  });

  it("rechaza horas que no son de la lista", () => {
    expect(validarBloqueo({ ...base, hora_desde: "10:15", hora_hasta: "12:00" })).not.toBeNull();
  });
});

describe("bloqueaFecha con medianoche", () => {
  it("un bloqueo hasta las 24 cubre un partido a las 23", () => {
    const b = bloqueo({ tipo: "recurrente", dia_semana: 4, hora_desde: "20:00:00", hora_hasta: "24:00:00" });
    expect(bloqueaFecha(b, "2026-10-08", "23:00:00")).toBe(true);
    expect(bloqueaFecha(b, "2026-10-08", "19:00:00")).toBe(false);
  });
});

describe("bloqueosEnHora", () => {
  const jueves = "2026-10-08";
  it("un bloqueo sin horario cubre todas las horas", () => {
    const b = bloqueo({ tipo: "puntual", fecha_desde: jueves });
    expect(bloqueosEnHora([b], jueves, 10)).toHaveLength(1);
    expect(bloqueosEnHora([b], jueves, 23)).toHaveLength(1);
  });

  it("un horario de 20 a 24 cubre de 20 a 23 y no las 19", () => {
    const b = bloqueo({ tipo: "recurrente", dia_semana: 4, hora_desde: "20:00:00", hora_hasta: "24:00:00" });
    expect(bloqueosEnHora([b], jueves, 19)).toHaveLength(0);
    expect(bloqueosEnHora([b], jueves, 20)).toHaveLength(1);
    expect(bloqueosEnHora([b], jueves, 23)).toHaveLength(1);
    expect(bloqueosEnHora([b], "2026-10-09", 20)).toHaveLength(0);
  });
});

describe("bloqueosDeAgenda", () => {
  it("junta horas seguidas y separa las que no lo son", () => {
    expect(bloqueosDeAgenda(new Map([["2026-10-08", [21, 14, 15, 20, 22, 23]]]), false)).toEqual([
      { tipo: "puntual", fecha_desde: "2026-10-08", fecha_hasta: null, dia_semana: null, hora_desde: "14:00", hora_hasta: "16:00" },
      { tipo: "puntual", fecha_desde: "2026-10-08", fecha_hasta: null, dia_semana: null, hora_desde: "20:00", hora_hasta: "24:00" },
    ]);
  });

  it("con repetir se guarda como todas las semanas", () => {
    const [b] = bloqueosDeAgenda(new Map([["2026-10-08", [18]]]), true);
    expect(b).toMatchObject({ tipo: "recurrente", dia_semana: 4, fecha_desde: null, hora_desde: "18:00", hora_hasta: "19:00" });
  });

  it("todas las horas de la agenda marcadas = día entero", () => {
    const todas = Array.from({ length: 14 }, (_, i) => 10 + i);
    expect(bloqueosDeAgenda(new Map([["2026-10-08", todas]]), false)).toEqual([
      { tipo: "puntual", fecha_desde: "2026-10-08", fecha_hasta: null, dia_semana: null, hora_desde: null, hora_hasta: null },
    ]);
  });
});

describe("partirRango", () => {
  const rango = bloqueo({ tipo: "rango", fecha_desde: "2026-10-28", fecha_hasta: "2026-11-02", hora_desde: "18:00:00", hora_hasta: "22:00:00" });

  it("liberar un día del medio deja dos tramos con el mismo horario", () => {
    expect(partirRango(rango, "2026-10-30")).toEqual([
      { tipo: "rango", fecha_desde: "2026-10-28", fecha_hasta: "2026-10-29", dia_semana: null, hora_desde: "18:00:00", hora_hasta: "22:00:00" },
      { tipo: "rango", fecha_desde: "2026-10-31", fecha_hasta: "2026-11-02", dia_semana: null, hora_desde: "18:00:00", hora_hasta: "22:00:00" },
    ]);
  });

  it("liberar una punta deja un solo tramo; si queda un día, es puntual", () => {
    expect(partirRango(rango, "2026-10-28")).toHaveLength(1);
    const corto = bloqueo({ tipo: "rango", fecha_desde: "2026-10-03", fecha_hasta: "2026-10-04" });
    expect(partirRango(corto, "2026-10-04")).toEqual([
      { tipo: "puntual", fecha_desde: "2026-10-03", fecha_hasta: null, dia_semana: null, hora_desde: null, hora_hasta: null },
    ]);
  });
});

describe("mismoBloqueo", () => {
  it("compara el horario sin importar los segundos", () => {
    const a = { tipo: "puntual" as const, fecha_desde: "2026-10-05", fecha_hasta: null, dia_semana: null, hora_desde: "10:00", hora_hasta: "12:00" };
    expect(mismoBloqueo(a, { ...a, hora_desde: "10:00:00", hora_hasta: "12:00:00" })).toBe(true);
    expect(mismoBloqueo(a, { ...a, hora_hasta: "13:00" })).toBe(false);
  });
});

describe("liberarDia", () => {
  const domingos = bloqueo({ tipo: "recurrente", dia_semana: 0 });

  it("en un 'todos los domingos' suma la fecha a las excepciones", () => {
    const [b] = liberarDia(domingos, "2026-10-11");
    expect(b).toMatchObject({ tipo: "recurrente", dia_semana: 0, excepciones: ["2026-10-11"] });
  });

  it("con la excepción, ese domingo ya no bloquea y el siguiente sí", () => {
    const liberado = { ...domingos, excepciones: ["2026-10-11"] };
    expect(bloqueaFecha(liberado, "2026-10-11", null)).toBe(false);
    expect(bloqueaFecha(liberado, "2026-10-18", null)).toBe(true);
    expect(describirBloqueo(liberado)).toBe("Todos los domingos (menos el 11 oct)");
  });

  it("un día puntual desaparece", () => {
    expect(liberarDia(bloqueo({ tipo: "puntual", fecha_desde: "2026-10-11" }), "2026-10-11")).toEqual([]);
  });
});

describe("modo puedo / no puedo", () => {
  // 2026-10-10 es sábado.
  const noPuedeNoche = bloqueo({ tipo: "puntual", fecha_desde: "2026-10-10", hora_desde: "20:00", hora_hasta: "24:00" });
  const puedeTarde = bloqueo({
    tipo: "puntual",
    fecha_desde: "2026-10-10",
    hora_desde: "15:00",
    hora_hasta: "19:00",
    disponible: true,
  });

  it("sin marcar, en 'no_puedo' o sin elegir puede, y en 'puedo' no", () => {
    expect(puedeEnHora("no_puedo", [], "2026-10-10", 16)).toBe(true);
    expect(puedeEnHora(null, [], "2026-10-10", 16)).toBe(true);
    expect(puedeEnHora("puedo", [], "2026-10-10", 16)).toBe(false);
  });

  it("una marca de 'no puedo' le saca la hora en cualquier modo", () => {
    expect(puedeEnHora("no_puedo", [noPuedeNoche], "2026-10-10", 21)).toBe(false);
    expect(puedeEnHora(null, [noPuedeNoche], "2026-10-10", 21)).toBe(false);
    expect(puedeEnHora("no_puedo", [noPuedeNoche], "2026-10-10", 16)).toBe(true);
  });

  it("una marca de 'puedo' le da la hora en 'puedo', y solo esas", () => {
    expect(puedeEnHora("puedo", [puedeTarde], "2026-10-10", 16)).toBe(true);
    expect(puedeEnHora("puedo", [puedeTarde], "2026-10-10", 20)).toBe(false);
    expect(puedeEnHora("puedo", [puedeTarde], "2026-10-11", 16)).toBe(false);
  });

  it("si hay de las dos en la misma hora, gana 'no puedo'", () => {
    const todo = bloqueo({ tipo: "puntual", fecha_desde: "2026-10-10", disponible: true });
    const excepcion = bloqueo({ tipo: "puntual", fecha_desde: "2026-10-10", hora_desde: "20:00", hora_hasta: "22:00" });
    expect(puedeEnHora("puedo", [todo, excepcion], "2026-10-10", 21)).toBe(false);
    expect(puedeEnHora("puedo", [todo, excepcion], "2026-10-10", 18)).toBe(true);
    expect(tipoEnHora([todo, excepcion], "2026-10-10", 21)).toBe("no_puedo");
    expect(tipoEnHora([todo, excepcion], "2026-10-10", 18)).toBe("puedo");
    expect(tipoEnHora([todo], "2026-10-11", 18)).toBeNull();
  });

  it("una marca de 'puedo' no cuenta para el aviso de la convocatoria", () => {
    expect(bloqueaFecha(puedeTarde, "2026-10-10", "16:00:00")).toBe(false);
    expect(bloqueaFecha(noPuedeNoche, "2026-10-10", "21:00:00")).toBe(true);
  });

  it("el mismo horario de 'puedo' y de 'no puedo' no es el mismo bloqueo", () => {
    const a = { ...noPuedeNoche, disponible: false };
    const b = { ...noPuedeNoche, disponible: true };
    expect(mismoBloqueo(a, b)).toBe(false);
    expect(mismoBloqueo(a, { ...noPuedeNoche })).toBe(true);
  });
});
