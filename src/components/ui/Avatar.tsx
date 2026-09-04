import Image from "next/image";

export default function Avatar({
  src,
  alt,
  size = 36,
  className = "",
}: {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        unoptimized
        className={`shrink-0 rounded-full object-cover ring-1 ring-white/10 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400/30 to-primary-600/30 font-bold text-primary-300 ring-1 ring-white/10 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {alt?.[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
