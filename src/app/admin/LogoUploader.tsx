"use client";

import { useRef, useState } from "react";
import { quitarLogoGrupo, subirLogoGrupo } from "@/lib/actions/admin";
import { resizeAndCompressImage } from "@/lib/image";
import GrupoLogo from "@/components/ui/GrupoLogo";
import Button from "@/components/ui/Button";

export default function LogoUploader({ nombre, logoInicial }: { nombre: string; logoInicial: string | null }) {
  const [logo, setLogo] = useState(logoInicial);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("La imagen no puede superar los 10 MB.");
      return;
    }

    setSubiendo(true);
    setError(null);
    try {
      const comprimida = await resizeAndCompressImage(file, 256, 0.9, "png");
      const formData = new FormData();
      formData.set("file", comprimida);
      const result = await subirLogoGrupo(formData);
      if (result.error) setError(result.error);
      else if (result.logo_url) setLogo(result.logo_url);
    } catch {
      setError("No se pudo procesar la imagen.");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleQuitar() {
    setSubiendo(true);
    setError(null);
    const result = await quitarLogoGrupo();
    setSubiendo(false);
    if (result.error) setError(result.error);
    else setLogo(null);
  }

  return (
    <div className="flex items-center gap-4">
      <GrupoLogo src={logo} nombre={nombre} size={72} />
      <div className="flex flex-col items-start gap-1.5">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={subiendo}
            onClick={() => inputRef.current?.click()}
          >
            {subiendo ? "Subiendo..." : logo ? "Cambiar escudo" : "Subir escudo"}
          </Button>
          {logo && (
            <Button type="button" size="sm" variant="ghost" disabled={subiendo} onClick={handleQuitar}>
              Quitar
            </Button>
          )}
        </div>
        <p className="text-xs text-zinc-500">PNG con fondo transparente queda mejor.</p>
        {error && <p className="text-xs text-danger-400">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}
