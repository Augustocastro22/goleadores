import { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-primary-400 to-primary-600 text-black shadow-lg shadow-primary-500/20 hover:brightness-110",
  secondary:
    "bg-white/5 border border-border-strong text-white hover:bg-white/10",
  ghost: "text-zinc-400 hover:text-white hover:bg-white/5",
  danger:
    "bg-danger-500/10 border border-danger-500/30 text-danger-400 hover:bg-danger-500/20",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = ""
) {
  return `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${sizes[size]} ${variants[variant]} ${className}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}
