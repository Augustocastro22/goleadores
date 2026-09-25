import { describe, expect, it } from "vitest";
import { tieneVotacion } from "./config";

describe("tieneVotacion", () => {
  it("sin mínimo (0) siempre hay votación", () => {
    expect(tieneVotacion(2, 0)).toBe(true);
  });

  it("no hay votación si jugaron menos que el mínimo", () => {
    expect(tieneVotacion(3, 6)).toBe(false);
  });

  it("hay votación si jugaron exactamente el mínimo", () => {
    expect(tieneVotacion(6, 6)).toBe(true);
  });
});
