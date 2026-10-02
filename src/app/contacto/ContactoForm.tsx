"use client";

import { startTransition, useActionState } from "react";
import { enviarMensajeContacto } from "@/lib/actions/contacto";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type Resultado = { error?: string; success?: boolean } | null;

const MOTIVOS = [
  { value: "borrar_cuenta", label: "Quiero que borren mi cuenta" },
  { value: "mis_datos", label: "Consulta sobre mis datos" },
  { value: "otro", label: "Otra consulta" },
];

export default function ContactoForm({
  nombreInicial,
  emailInicial,
  motivoInicial,
}: {
  nombreInicial: string;
  emailInicial: string;
  motivoInicial: string;
}) {
  const [estado, formAction, pending] = useActionState<Resultado, FormData>(
    (_prev, formData) => enviarMensajeContacto(formData),
    null
  );

  if (estado?.success) {
    return (
      <div className="flex flex-col gap-2 py-4 text-center">
        <p className="text-lg font-bold text-white">¡Mensaje enviado!</p>
        <p className="text-sm text-zinc-400">Te vamos a responder al email que nos dejaste.</p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        // Envío desde onSubmit para que no se borre lo escrito si hay un error.
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <Label>
        Motivo
        <select
          name="motivo"
          required
          defaultValue={MOTIVOS.some((m) => m.value === motivoInicial) ? motivoInicial : ""}
          className="w-full rounded-xl border border-border bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
        >
          <option value="" disabled className="bg-surface">
            Elegí un motivo...
          </option>
          {MOTIVOS.map((m) => (
            <option key={m.value} value={m.value} className="bg-surface">
              {m.label}
            </option>
          ))}
        </select>
      </Label>
      <Label>
        Tu nombre
        <Input type="text" name="nombre" required maxLength={100} defaultValue={nombreInicial} />
      </Label>
      <Label>
        Tu email
        <Input type="email" name="email" required maxLength={200} defaultValue={emailInicial} />
        <span className="text-xs font-normal text-zinc-500">
          Para responderte. Si pedís borrar tu cuenta, usá el email con el que te registraste.
        </span>
      </Label>
      <Label>
        Mensaje
        <textarea
          name="mensaje"
          required
          maxLength={2000}
          rows={5}
          className="w-full rounded-xl border border-border bg-white/5 px-3.5 py-2.5 text-white outline-none transition placeholder:text-zinc-500 focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
        />
      </Label>
      {/* Campo trampa para bots: oculto para las personas. */}
      <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {estado?.error && <p className="text-sm text-danger-400">{estado.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Enviar"}
      </Button>
    </form>
  );
}
