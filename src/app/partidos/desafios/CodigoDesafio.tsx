"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

/** El código de desafío del grupo, con botón para compartirlo o copiarlo. */
export default function CodigoDesafio({ codigo, nombreGrupo }: { codigo: string; nombreGrupo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function compartir() {
    const texto = `Desafiá a ${nombreGrupo} en Goleadores con este código: ${codigo}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: nombreGrupo, text: texto });
      } catch {
        // Canceló el share: no hacemos nada.
      }
      return;
    }
    await navigator.clipboard.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-xl border border-border bg-white/5 px-3.5 py-2.5 text-sm tracking-wide text-zinc-300">
        {codigo}
      </code>
      <Button type="button" size="sm" onClick={compartir} className="shrink-0">
        {copiado ? "¡Copiado!" : "Compartir"}
      </Button>
    </div>
  );
}
