import { describe, expect, it } from "vitest";
import { proximoRecordatorioVotacion, puedeCerrarVotacionAMano, votacionCerrada, votacionVencida } from "./votacion";

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

describe("puedeCerrarVotacionAMano", () => {
  // Resultado cargado el martes a las 23:00 (hora de Argentina): cierra el jueves a las 23:00.
  const cierra = "2026-11-06T02:00:00Z";

  it("antes de las 24 horas no se puede", () => {
    expect(puedeCerrarVotacionAMano(cierra, new Date("2026-11-05T01:59:00Z"))).toBe(false);
  });

  it("desde las 24 horas se puede", () => {
    expect(puedeCerrarVotacionAMano(cierra, new Date("2026-11-05T02:00:00Z"))).toBe(true);
    expect(puedeCerrarVotacionAMano(cierra, new Date("2026-11-05T20:00:00Z"))).toBe(true);
  });

  it("sin límite no se puede", () => {
    expect(puedeCerrarVotacionAMano(null, ahora)).toBe(false);
  });
});

describe("proximoRecordatorioVotacion", () => {
  // El cron corre todos los días a las 10:00 de Argentina (13:00 UTC).
  const cron = (dia: string) => new Date(`${dia}T13:00:00Z`);

  it("resultado de noche: uno a la mañana siguiente y el último el día del cierre", () => {
    // Cargado el martes 03/11 a las 23:00, cierra el jueves 05/11 a las 23:00.
    const cierraEn = "2026-11-06T02:00:00Z";
    expect(proximoRecordatorioVotacion({ cierraEn, enviados: 0, ahora: cron("2026-11-03") })).toBeNull();
    expect(proximoRecordatorioVotacion({ cierraEn, enviados: 0, ahora: cron("2026-11-04") })).toBe("primero");
    expect(proximoRecordatorioVotacion({ cierraEn, enviados: 1, ahora: cron("2026-11-05") })).toBe("ultimo");
  });

  it("resultado de mediodía: también salen los dos", () => {
    // Cargado el martes 03/11 a las 12:00, cierra el jueves 05/11 a las 12:00.
    const cierraEn = "2026-11-05T15:00:00Z";
    expect(proximoRecordatorioVotacion({ cierraEn, enviados: 0, ahora: cron("2026-11-04") })).toBe("primero");
    expect(proximoRecordatorioVotacion({ cierraEn, enviados: 1, ahora: cron("2026-11-05") })).toBe("ultimo");
  });

  it("resultado de madrugada: el primer cron ya cae dentro de las últimas 24 horas y sale uno solo", () => {
    // Cargado el martes 03/11 a las 09:00, cierra el jueves 05/11 a las 09:00.
    const cierraEn = "2026-11-05T12:00:00Z";
    expect(proximoRecordatorioVotacion({ cierraEn, enviados: 0, ahora: cron("2026-11-03") })).toBeNull();
    expect(proximoRecordatorioVotacion({ cierraEn, enviados: 0, ahora: cron("2026-11-04") })).toBe("ultimo");
    expect(proximoRecordatorioVotacion({ cierraEn, enviados: 2, ahora: cron("2026-11-04") })).toBeNull();
  });

  it("no repite lo que ya salió", () => {
    const cierraEn = "2026-11-06T02:00:00Z";
    expect(proximoRecordatorioVotacion({ cierraEn, enviados: 1, ahora: cron("2026-11-04") })).toBeNull();
    expect(proximoRecordatorioVotacion({ cierraEn, enviados: 2, ahora: cron("2026-11-05") })).toBeNull();
  });

  it("una votación vencida o sin límite no recibe recordatorios", () => {
    expect(proximoRecordatorioVotacion({ cierraEn: "2026-11-05T12:00:00Z", enviados: 1, ahora: cron("2026-11-06") })).toBeNull();
    expect(proximoRecordatorioVotacion({ cierraEn: null, enviados: 0, ahora })).toBeNull();
  });
});
