import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * Interruptor on/off con título y explicación. Por dentro es un checkbox, así
 * que se manda en el form igual que uno (name, checked/defaultChecked).
 */
export default function Switch({
  titulo,
  detalle,
  className = "",
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  titulo: ReactNode;
  detalle?: ReactNode;
}) {
  return (
    <label className={`flex cursor-pointer items-start justify-between gap-4 text-sm ${className}`}>
      <span className="min-w-0">
        <span className="font-medium text-white">{titulo}</span>
        {detalle && <span className="mt-0.5 block text-xs text-zinc-500">{detalle}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" {...input} />
        <span className="h-6 w-10 rounded-full bg-white/10 ring-1 ring-white/10 transition peer-checked:bg-primary-500 peer-checked:ring-primary-400/40 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-400 peer-disabled:opacity-50" />
        <span className="pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
