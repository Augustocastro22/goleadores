"use client";

import { useFormStatus } from "react-dom";
import Button, { ButtonVariant, ButtonSize } from "@/components/ui/Button";

export default function SubmitButton({
  children,
  pendingText,
  variant,
  size,
  className,
}: {
  children: React.ReactNode;
  pendingText: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}
