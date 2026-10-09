"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

/** El link de desafío del grupo (/desafiar/<codigo>), con botón para compartirlo o copiarlo. */
export default function CodigoDesafio({ url, nombreGrupo }: { url: string; nombreGrupo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function compartir() {
    const texto = `Desafiá a ${nombreGrupo} en Goleadores`;
    if (navigator.share) {
      try {
        await navigator.share({ title: nombreGrupo, text: texto, url });
      } catch {
        // Canceló el share: no hacemos nada.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 truncate rounded-xl border border-border bg-white/5 px-3.5 py-2.5 text-sm text-zinc-300">
        {url}
      </code>
      <Button type="button" size="sm" onClick={compartir} className="shrink-0">
        {copiado ? "¡Copiado!" : "Compartir link"}
      </Button>
    </div>
  );
}
