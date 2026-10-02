"use client";

import { createContext, startTransition, useActionState } from "react";

type Resultado = { error?: string; success?: boolean } | null;

/** Para que SubmitButton sepa que este form se está enviando (ver más abajo). */
export const ActionFormPendingContext = createContext(false);

/**
 * Form que muestra el error o un "Guardado" según lo que devuelva la server
 * action. El envío se hace desde onSubmit (y no con `<form action>`) porque
 * React vacía los campos de un `<form action>` al terminar, aunque la acción
 * haya devuelto un error, y se pierde lo que la persona había escrito.
 */
export default function ActionForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<Resultado>;
  className?: string;
  children: React.ReactNode;
}) {
  const [estado, formAction, pending] = useActionState<Resultado, FormData>(
    (_prev, formData) => action(formData),
    null
  );

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <ActionFormPendingContext.Provider value={pending}>{children}</ActionFormPendingContext.Provider>
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
