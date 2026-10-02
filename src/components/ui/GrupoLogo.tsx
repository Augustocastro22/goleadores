import Image from "next/image";

/**
 * Escudo de un grupo. Cuadrado redondeado (no círculo, para diferenciarlo de
 * las fotos de perfil) y con object-contain para que no se recorte el escudo.
 * Sin logo muestra la inicial del grupo.
 */
export default function GrupoLogo({
  src,
  nombre,
  size = 36,
  className = "",
}: {
  src?: string | null;
  nombre: string;
  size?: number;
  className?: string;
}) {
  const radio = Math.round(size * 0.28);

  if (src) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden bg-white/5 ring-1 ring-white/10 ${className}`}
        style={{ width: size, height: size, borderRadius: radio }}
      >
        <Image
          src={src}
          alt={nombre}
          width={size}
          height={size}
          unoptimized
          draggable={false}
          className="h-full w-full object-contain select-none"
        />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-gold-400/25 to-gold-500/10 font-extrabold text-gold-400 ring-1 ring-white/10 ${className}`}
      style={{ width: size, height: size, borderRadius: radio, fontSize: size * 0.42 }}
    >
      {nombre?.trim()?.[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
