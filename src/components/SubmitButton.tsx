"use client";

import { useContext } from "react";
import { useFormStatus } from "react-dom";
import Button, { ButtonVariant, ButtonSize } from "@/components/ui/Button";
import { ActionFormPendingContext, ActionFormSinCambiosContext } from "@/components/ActionForm";

export default function SubmitButton({
  children,
  pendingText,
  variant,
  size,
  className,
  disabled = false,
}: {
  children: React.ReactNode;
  pendingText: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
}) {
  // useFormStatus cubre los `<form action>` comunes; el contexto, los ActionForm
  // (que envían desde onSubmit y por eso useFormStatus no los ve).
  const { pending: formPending } = useFormStatus();
  const actionFormPending = useContext(ActionFormPendingContext);
  const pending = formPending || actionFormPending;
  // En un form de edición sin cambios no hay nada para guardar.
  const sinCambios = useContext(ActionFormSinCambiosContext);
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || sinCambios || disabled}>
      {pending ? pendingText : children}
    </Button>
  );
}
