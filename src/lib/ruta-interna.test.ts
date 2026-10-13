import { describe, expect, it } from "vitest";
import { rutaInterna } from "./ruta-interna";

describe("rutaInterna", () => {
  it("deja pasar rutas de la app", () => {
    expect(rutaInterna("/unirse/abc123")).toBe("/unirse/abc123");
    expect(rutaInterna("/partidos/1?grupo=2#votar")).toBe("/partidos/1?grupo=2#votar");
  });

  it("rechaza otros sitios", () => {
    for (const next of ["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "\\evil.com", "evil.com"]) {
      expect(rutaInterna(next)).toBeNull();
    }
  });

  it("sin next, null", () => {
    expect(rutaInterna(null)).toBeNull();
    expect(rutaInterna("")).toBeNull();
  });
});
