import { HTMLAttributes } from "react";

export default function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface/80 shadow-xl shadow-black/20 backdrop-blur-sm ${className}`}
      {...props}
    />
  );
}
