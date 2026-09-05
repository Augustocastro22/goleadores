"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { actualizarPassword, logout } from "@/lib/actions/auth";

export default function ActualizarPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const result = await actualizarPassword(formData);
    setSaving(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">⚽</span>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Nueva contraseña</h1>
        <p className="text-sm text-zinc-500">Elegí la contraseña que vas a usar de ahora en más</p>
      </div>

      <Card className="w-full max-w-sm p-6">
        {error && (
          <p className="mb-4 rounded-xl border border-danger-500/20 bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-400">
            {error}
          </p>
        )}
        <form action={handleSubmit} className="flex flex-col gap-4">
          <Label>
            Contraseña nueva
            <Input type="password" name="password" required minLength={6} />
          </Label>
          <Button type="submit" disabled={saving} className="mt-2 w-full">
            {saving ? "Guardando..." : "Guardar contraseña"}
          </Button>
        </form>
      </Card>

      <form action={logout} className="mt-6">
        <button type="submit" className="text-sm text-zinc-500 hover:text-zinc-300">
          Cancelar
        </button>
      </form>
    </div>
  );
}
