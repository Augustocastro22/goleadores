"use client";

import { useActionState } from "react";

type Resultado = { error?: string; success?: boolean } | null;

/** Form que muestra el error o un "Guardado" según lo que devuelva la server action. */
export default function AdminForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<Resultado>;
  className?: string;
  children: React.ReactNode;
}) {
  const [estado, formAction] = useActionState<Resultado, FormData>(
    (_prev, formData) => action(formData),
    null
  );

  return (
    <form action={formAction} className={className}>
      {children}
      {estado?.error && (
        <p aria-live="polite" className="text-sm text-danger-400">
          {estado.error}
        </p>
      )}
      {estado?.success && (
        <p aria-live="polite" className="text-sm text-primary-400">
          Guardado.
        </p>
      )}
    </form>
  );
}
