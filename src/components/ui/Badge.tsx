import { HTMLAttributes } from "react";

export type BadgeVariant = "primary" | "gold" | "danger" | "neutral";

const variants: Record<BadgeVariant, string> = {
  primary: "bg-primary-500/15 text-primary-400 border-primary-500/20",
  gold: "bg-gold-500/15 text-gold-400 border-gold-500/20",
  danger: "bg-danger-500/15 text-danger-400 border-danger-500/20",
  neutral: "bg-white/5 text-zinc-400 border-white/10",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export default function Badge({
  variant = "neutral",
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
