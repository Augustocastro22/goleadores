"use client";

/**
 * Cantidad de goles. El 0 se muestra como placeholder (campo vacío) para que
 * al escribir no quede "10" en vez de "1", y al enfocar se selecciona lo que
 * hay, así se reemplaza al tipear. Vacío cuenta como 0 (también en el form).
 */
export default function GolesInput({
  name,
  value,
  onChange,
}: {
  name?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      name={name}
      min={0}
      inputMode="numeric"
      placeholder="0"
      value={value === 0 ? "" : value}
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
      className="w-16 shrink-0 rounded-lg border border-border bg-white/5 px-2 py-1.5 text-center text-sm text-white outline-none placeholder:text-zinc-500 focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
    />
  );
}
