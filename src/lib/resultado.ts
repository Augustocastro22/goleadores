export type Resultado = "G" | "E" | "P";

/** Asume que el equipo 1 es siempre "nosotros". */
export function calcularResultado(golesEquipo1: number, golesEquipo2: number): Resultado {
  if (golesEquipo1 > golesEquipo2) return "G";
  if (golesEquipo1 < golesEquipo2) return "P";
  return "E";
}

export const RESULTADO_LABEL: Record<Resultado, string> = {
  G: "Ganado",
  E: "Empatado",
  P: "Perdido",
};

export const RESULTADO_CLASS: Record<Resultado, string> = {
  G: "bg-primary-500/15 text-primary-400",
  E: "bg-white/10 text-zinc-300",
  P: "bg-danger-500/15 text-danger-400",
};
