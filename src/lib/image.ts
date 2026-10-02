/**
 * Redimensiona y comprime una imagen en el navegador antes de subirla. Por
 * defecto JPEG (fotos de perfil); los escudos van en PNG para no perder la
 * transparencia.
 */
export async function resizeAndCompressImage(
  file: File,
  maxSize = 512,
  quality = 0.8,
  formato: "jpeg" | "png" = "jpeg"
): Promise<File> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo comprimir la imagen."))),
      `image/${formato}`,
      quality
    )
  );

  return new File([blob], formato === "png" ? "imagen.png" : "avatar.jpg", { type: `image/${formato}` });
}
