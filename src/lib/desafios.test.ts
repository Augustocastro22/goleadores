import { describe, expect, it } from "vitest";
import {
  esperaMiRespuesta,
  estadoVisible,
  extraerCodigo,
  historialDesafios,
  puedeCancelar,
  puedeCargarResultado,
  puedeConfirmarResultado,
  puedeCortar,
  puedeReprogramar,
  puedeResponder,
  puedeResponderFecha,
  puedeSuspender,
  seccionDesafio,
  type DesafioVista,
} from "./desafios";

const hoy = "2026-10-08";
// 8 de octubre de 2026, 18:30 en Argentina (UTC-3).
const ahora = new Date("2026-10-08T21:30:00Z");

const desafio = (
  estado: DesafioVista["estado"],
  fecha: string,
  soyDesafiante: boolean,
  resultadoCargado = false,
  extra: Partial<DesafioVista> = {}
) => ({
  estado,
  fecha,
  hora: null as string | null,
  soy_desafiante: soyDesafiante,
  resultado_cargado: resultadoCargado,
  propuesta_es_mia: null as boolean | null,
  resultado_estado: "sin_cargar" as DesafioVista["resultado_estado"],
  resultado_pendiente_es_mio: null as boolean | null,
  ambos_propusieron: false,
  ...extra,
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
    expect(estadoVisible(desafio("suspendido", "2026-10-01", true), hoy)).toBe("suspendido");
  });
});

describe("seccionDesafio", () => {
  it("un pendiente recibido es para responder, uno enviado va a enviados", () => {
    expect(seccionDesafio(desafio("pendiente", "2026-10-10", false), hoy)).toBe("responder");
    expect(seccionDesafio(desafio("pendiente", "2026-10-10", true), hoy)).toBe("enviados");
  });

  it("un aceptado o suspendido es próximo mientras el resultado no se cerró", () => {
    expect(seccionDesafio(desafio("aceptado", "2026-10-07", true), hoy)).toBe("proximos");
    expect(seccionDesafio(desafio("suspendido", "2026-10-07", true), hoy)).toBe("proximos");
    expect(
      seccionDesafio(desafio("aceptado", "2026-10-07", true, true, { resultado_estado: "verificado" }), hoy)
    ).toBe("historial");
  });

  it("una fecha o un resultado del otro grupo esperando respuesta van a responder", () => {
    expect(seccionDesafio(desafio("suspendido", "2026-10-10", true, false, { propuesta_es_mia: false }), hoy)).toBe(
      "responder"
    );
    expect(
      seccionDesafio(
        desafio("aceptado", "2026-10-07", true, true, {
          resultado_estado: "en_discusion",
          resultado_pendiente_es_mio: false,
        }),
        hoy
      )
    ).toBe("responder");
  });

  it("vencidos, rechazados y cancelados van al historial", () => {
    expect(seccionDesafio(desafio("pendiente", "2026-10-07", false), hoy)).toBe("historial");
    expect(seccionDesafio(desafio("rechazado", "2026-10-10", true), hoy)).toBe("historial");
    expect(seccionDesafio(desafio("cancelado", "2026-10-10", false), hoy)).toBe("historial");
    expect(seccionDesafio(desafio("vencido", "2026-10-07", false), hoy)).toBe("historial");
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

  it("un aceptado o suspendido lo cancela cualquiera mientras no hay resultado", () => {
    expect(puedeCancelar(desafio("aceptado", "2026-10-10", false), hoy)).toBe(true);
    expect(puedeCancelar(desafio("suspendido", "2026-10-07", true), hoy)).toBe(true);
    expect(puedeCancelar(desafio("aceptado", "2026-10-07", true, true), hoy)).toBe(false);
  });

  it("vencidos, rechazados y cancelados no se cancelan", () => {
    expect(puedeCancelar(desafio("pendiente", "2026-10-07", true), hoy)).toBe(false);
    expect(puedeCancelar(desafio("rechazado", "2026-10-10", true), hoy)).toBe(false);
    expect(puedeCancelar(desafio("vencido", "2026-10-07", true), hoy)).toBe(false);
  });
});

describe("suspender y reprogramar", () => {
  it("se suspende solo un aceptado sin resultado", () => {
    expect(puedeSuspender(desafio("aceptado", "2026-10-10", true))).toBe(true);
    expect(puedeSuspender(desafio("suspendido", "2026-10-10", true))).toBe(false);
    expect(puedeSuspender(desafio("aceptado", "2026-10-10", true, true))).toBe(false);
  });

  it("se reprograma un aceptado o suspendido sin resultado", () => {
    expect(puedeReprogramar(desafio("aceptado", "2026-10-10", true))).toBe(true);
    expect(puedeReprogramar(desafio("suspendido", "2026-10-10", true))).toBe(true);
    expect(puedeReprogramar(desafio("aceptado", "2026-10-10", true, true))).toBe(false);
    expect(puedeReprogramar(desafio("cancelado", "2026-10-10", true))).toBe(false);
  });

  it("la fecha propuesta la responde el otro grupo", () => {
    expect(puedeResponderFecha(desafio("suspendido", "2026-10-10", true, false, { propuesta_es_mia: false }))).toBe(
      true
    );
    expect(puedeResponderFecha(desafio("suspendido", "2026-10-10", true, false, { propuesta_es_mia: true }))).toBe(
      false
    );
    expect(puedeResponderFecha(desafio("aceptado", "2026-10-10", true))).toBe(false);
  });
});

describe("resultado", () => {
  it("se carga después del partido, mientras no quedó cerrado", () => {
    expect(puedeCargarResultado(desafio("aceptado", "2026-10-07", true), ahora)).toBe(true);
    expect(puedeCargarResultado({ ...desafio("aceptado", hoy, true), hora: "17:00" }, ahora)).toBe(true);
    expect(puedeCargarResultado({ ...desafio("aceptado", hoy, true), hora: "21:00" }, ahora)).toBe(false);
    expect(puedeCargarResultado(desafio("suspendido", "2026-10-07", true), ahora)).toBe(false);
    expect(
      puedeCargarResultado(desafio("aceptado", "2026-10-07", true, true, { resultado_estado: "verificado" }), ahora)
    ).toBe(false);
  });

  it("confirma el grupo que no lo cargó", () => {
    const enDiscusion = { resultado_estado: "en_discusion" as const };
    expect(puedeConfirmarResultado({ ...enDiscusion, resultado_pendiente_es_mio: false })).toBe(true);
    expect(puedeConfirmarResultado({ ...enDiscusion, resultado_pendiente_es_mio: true })).toBe(false);
  });

  it("se corta solo si los dos grupos dieron su versión", () => {
    expect(puedeCortar({ resultado_estado: "en_discusion", ambos_propusieron: true })).toBe(true);
    expect(puedeCortar({ resultado_estado: "en_discusion", ambos_propusieron: false })).toBe(false);
    expect(puedeCortar({ resultado_estado: "verificado", ambos_propusieron: true })).toBe(false);
  });

  it("esperaMiRespuesta junta desafíos, fechas y resultados", () => {
    expect(esperaMiRespuesta(desafio("pendiente", "2026-10-10", false), hoy)).toBe(true);
    expect(esperaMiRespuesta(desafio("aceptado", "2026-10-10", true), hoy)).toBe(false);
  });
});

describe("historialDesafios", () => {
  const fila = (rival: string, estado: DesafioVista["resultado_estado"], mios: number | null, suyos: number | null) => ({
    rival_id: rival,
    rival_nombre: rival,
    rival_logo_url: null,
    resultado_estado: estado,
    marcador_mios: mios,
    marcador_rival: suyos,
  });

  it("cuenta G/E/P verificados y los sin verificar por rival", () => {
    const historial = historialDesafios([
      fila("A", "verificado", 3, 1),
      fila("A", "verificado", 2, 2),
      fila("A", "sin_verificar", 5, 4),
      fila("B", "verificado", 0, 1),
      fila("B", "en_discusion", 1, 0),
      fila("C", "sin_cargar", null, null),
    ]);
    expect(historial).toEqual([
      { rivalNombre: "A", rivalLogoUrl: null, ganados: 1, empatados: 1, perdidos: 0, sinVerificar: 1 },
      { rivalNombre: "B", rivalLogoUrl: null, ganados: 0, empatados: 0, perdidos: 1, sinVerificar: 0 },
    ]);
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
