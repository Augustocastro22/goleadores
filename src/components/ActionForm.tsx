"use client";

import { createContext, startTransition, useActionState, useEffect, useRef, useState } from "react";

type Resultado = { error?: string; success?: boolean } | null;

/** Para que SubmitButton sepa que este form se está enviando (ver más abajo). */
export const ActionFormPendingContext = createContext(false);

/** Para que SubmitButton se apague mientras no hay nada para guardar (ver soloConCambios). */
export const ActionFormSinCambiosContext = createContext(false);

/** Los valores del form, para comparar si cambió algo. */
function valores(form: HTMLFormElement | null): string {
  if (!form) return "";
  return JSON.stringify([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === "string" ? v : v.name]));
}

/**
 * Form que muestra el error o un "Guardado" según lo que devuelva la server
 * action. El envío se hace desde onSubmit (y no con `<form action>`) porque
 * React vacía los campos de un `<form action>` al terminar, aunque la acción
 * haya devuelto un error, y se pierde lo que la persona había escrito.
 */
export default function ActionForm({
  action,
  className,
  grupoId,
  soloConCambios = false,
  children,
}: {
  action: (formData: FormData) => Promise<Resultado>;
  className?: string;
  /**
   * El grupo que se está mirando en la pantalla (va como grupo_id): la acción
   * opera sobre ese y no sobre el de la cookie, que puede haber cambiado en
   * otra pestaña.
   */
  grupoId?: string;
  /**
   * Para forms de edición ("Guardar"): el botón queda apagado mientras los
   * valores sean los mismos que al abrir (o que lo último guardado).
   */
  soloConCambios?: boolean;
  children: React.ReactNode;
}) {
  const [estado, formAction, pending] = useActionState<Resultado, FormData>(
    (_prev, formData) => action(formData),
    null
  );
  const formRef = useRef<HTMLFormElement>(null);
  const guardado = useRef<string | null>(null);
  const [hayCambios, setHayCambios] = useState(false);

  // Lo que se ve al abrir es lo guardado; después de guardar bien, lo nuevo.
  useEffect(() => {
    async function tomarBase() {
      if (!soloConCambios || (guardado.current !== null && !estado?.success)) return;
      guardado.current = valores(formRef.current);
      setHayCambios(false);
    }
    tomarBase();
  }, [soloConCambios, estado]);

  function revisarCambios() {
    if (!soloConCambios) return;
    // Después de que React aplique el cambio (algunos campos actualizan inputs ocultos).
    setTimeout(() => setHayCambios(valores(formRef.current) !== guardado.current), 0);
  }

  return (
    <form
      ref={formRef}
      className={className}
      onInput={revisarCambios}
      onChange={revisarCambios}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {grupoId && <input type="hidden" name="grupo_id" value={grupoId} />}
      <ActionFormPendingContext.Provider value={pending}>
        <ActionFormSinCambiosContext.Provider value={soloConCambios && !hayCambios}>
          {children}
        </ActionFormSinCambiosContext.Provider>
      </ActionFormPendingContext.Provider>
      {estado?.error && (
        <p aria-live="polite" className="text-sm text-danger-400">
          {estado.error}
        </p>
      )}
      {estado?.success && !hayCambios && (
        <p aria-live="polite" className="text-sm text-primary-400">
          Guardado.
        </p>
      )}
    </form>
  );
}
