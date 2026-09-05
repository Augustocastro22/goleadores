"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { actualizarPassword, logout } from "@/lib/actions/auth";

export default function ActualizarPasswordPage() {
  const [tokens, setTokens] = useState<{ accessToken: string; refreshToken: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // El link del mail trae el token en el fragmento de la URL (después
    // del #), que nunca llega al servidor: lo leemos acá directamente,
    // sin depender de que ningún cliente lo "detecte" solo.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hashError = hash.get("error_description");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const type = hash.get("type");

    window.history.replaceState(null, "", window.location.pathname);

    Promise.resolve().then(() => {
      if (hashError) {
        setError(decodeURIComponent(hashError.replace(/\+/g, " ")));
      } else if (accessToken && refreshToken && type === "recovery") {
        setTokens({ accessToken, refreshToken });
      } else {
        setError("El link de recuperación venció o no es válido.");
      }
    });
  }, []);

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
        {!tokens && !error && (
          <p className="text-center text-sm text-zinc-500">Verificando el link...</p>
        )}

        {!tokens && error && (
          <div className="flex flex-col gap-4">
            <p className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-400">
              {error}
            </p>
            <a
              href="/recuperar"
              className="text-center text-sm font-semibold text-primary-400 hover:text-primary-300"
            >
              Pedir un link nuevo
            </a>
          </div>
        )}

        {tokens && (
          <>
            {error && (
              <p className="mb-4 rounded-xl border border-danger-500/20 bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-400">
                {error}
              </p>
            )}
            <form action={handleSubmit} className="flex flex-col gap-4">
              <input type="hidden" name="access_token" value={tokens.accessToken} />
              <input type="hidden" name="refresh_token" value={tokens.refreshToken} />
              <Label>
                Contraseña nueva
                <Input type="password" name="password" required minLength={6} />
              </Label>
              <Button type="submit" disabled={saving} className="mt-2 w-full">
                {saving ? "Guardando..." : "Guardar contraseña"}
              </Button>
            </form>
          </>
        )}
      </Card>

      {tokens && (
        <form action={logout} className="mt-6">
          <button type="submit" className="text-sm text-zinc-500 hover:text-zinc-300">
            Cancelar
          </button>
        </form>
      )}
    </div>
  );
}
