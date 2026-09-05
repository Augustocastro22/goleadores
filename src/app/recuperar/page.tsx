"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { solicitarRecuperacion } from "@/lib/actions/auth";

export default function RecuperarPage() {
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(formData: FormData) {
    setEnviando(true);
    await solicitarRecuperacion(formData);
    setEnviando(false);
    setEnviado(true);
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">⚽</span>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Recuperar contraseña</h1>
        <p className="text-sm text-zinc-500">Te mandamos un link para elegir una nueva</p>
      </div>

      <Card className="w-full max-w-sm p-6">
        {enviado ? (
          <p className="text-sm text-zinc-300">
            Si ese email tiene una cuenta, te llegó un mail con un link para poner una contraseña
            nueva. Puede tardar un minuto.
          </p>
        ) : (
          <form action={handleSubmit} className="flex flex-col gap-4">
            <Label>
              Email
              <Input type="email" name="email" required />
            </Label>
            <Button type="submit" disabled={enviando} className="mt-2 w-full">
              {enviando ? "Enviando..." : "Enviar link"}
            </Button>
          </form>
        )}
      </Card>

      <p className="mt-6 text-sm text-zinc-500">
        <Link href="/login" className="font-semibold text-primary-400 hover:text-primary-300">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
