/** Horarios de partido, en punto y a las y media, de 8 a 23:30. */
const HORAS_PARTIDO = Array.from({ length: 32 }, (_, i) => {
  const h = String(8 + Math.floor(i / 2)).padStart(2, "0");
  return `${h}:${i % 2 === 0 ? "00" : "30"}`;
});

/**
 * Selector de hora del partido (campo "hora" del form, "HH:MM" o vacío).
 * Si el partido ya tenía una hora fuera de la lista (cargada antes), se
 * agrega para no perderla al editar.
 */
export default function HoraSelect({ defaultValue = "" }: { defaultValue?: string }) {
  const opciones =
    defaultValue && !HORAS_PARTIDO.includes(defaultValue)
      ? [...HORAS_PARTIDO, defaultValue].sort()
      : HORAS_PARTIDO;

  return (
    <select
      name="hora"
      defaultValue={defaultValue}
      className="w-full appearance-none rounded-xl border border-border bg-white/5 px-3.5 py-2.5 text-white outline-none transition focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
    >
      <option value="" className="bg-surface">
        Sin hora
      </option>
      {opciones.map((hora) => (
        <option key={hora} value={hora} className="bg-surface">
          {hora}
        </option>
      ))}
    </select>
  );
}
