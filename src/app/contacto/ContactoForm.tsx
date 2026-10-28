"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { enviarMensajeContacto } from "@/lib/actions/contacto";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type Resultado = { error?: string; success?: boolean } | null;

/** "sugerencias": ideas y reportes. "datos": pedidos sobre la cuenta y los datos (política de privacidad). */
export type ModoContacto = "sugerencias" | "datos";

const MOTIVOS: Record<ModoContacto, { value: string; label: string }[]> = {
  sugerencias: [
    { value: "idea", label: "Tengo una idea o mejora" },
    { value: "falla", label: "Algo no funciona" },
    { value: "otro", label: "Otra consulta" },
  ],
  datos: [
    { value: "borrar_cuenta", label: "Quiero que borren mi cuenta" },
    { value: "mis_datos", label: "Consulta sobre mis datos" },
    { value: "otro", label: "Otra consulta" },
  ],
};

const AYUDA_MENSAJE: Record<string, string> = {
  idea: "Contanos qué te gustaría que hiciera la app.",
  falla: "Contanos qué pasó y en qué pantalla.",
};

export default function ContactoForm({
  nombreInicial,
  emailInicial,
  motivoInicial,
  modo,
}: {
  nombreInicial: string;
  emailInicial: string;
  motivoInicial: string;
  modo: ModoContacto;
}) {
  const [estado, formAction, pending] = useActionState<Resultado, FormData>(
    (_prev, formData) => enviarMensajeContacto(formData),
    null
  );
  const motivos = MOTIVOS[modo];
  const [motivo, setMotivo] = useState(motivos.some((m) => m.value === motivoInicial) ? motivoInicial : "");

  if (estado?.success) {
    return (
      <div className="flex flex-col gap-2 py-4 text-center">
        <p className="text-lg font-bold text-white">¡Mensaje enviado!</p>
        <p className="text-sm text-zinc-400">
          {modo === "sugerencias" ? "Gracias por ayudarnos a mejorar." : "Te vamos a responder al email que nos dejaste."}
        </p>
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
        // Para un reporte de falla: el dispositivo ayuda a reproducirlo.
        formData.set("dispositivo", navigator.userAgent);
        startTransition(() => formAction(formData));
      }}
    >
      <Label>
        Motivo
        <select
          name="motivo"
          required
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full rounded-xl border border-border bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
        >
          <option value="" disabled className="bg-surface">
            Elegí un motivo...
          </option>
          {motivos.map((m) => (
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
          {modo === "datos"
            ? "Para responderte. Si pedís borrar tu cuenta, usá el email con el que te registraste."
            : "Para responderte si hace falta."}
        </span>
      </Label>
      <Label>
        Mensaje
        <textarea
          name="mensaje"
          required
          maxLength={2000}
          rows={5}
          placeholder={AYUDA_MENSAJE[motivo] ?? ""}
          className="w-full rounded-xl border border-border bg-white/5 px-3.5 py-2.5 text-white outline-none transition placeholder:text-zinc-500 focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
        />
        {motivo === "falla" && (
          <span className="text-xs font-normal text-zinc-500">
            También mandamos qué dispositivo usás, para poder reproducirlo.
          </span>
        )}
      </Label>
      {/* Campo trampa para bots: oculto para las personas. */}
      <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {estado?.error && <p className="text-sm text-danger-400">{estado.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Enviar"}
      </Button>
      <p className="text-xs text-zinc-500">
        {modo === "sugerencias" ? (
          <>
            ¿Querés borrar tu cuenta o consultar por tus datos?{" "}
            <Link href="/contacto?motivo=mis_datos" className="text-zinc-300 underline hover:text-white">
              Escribinos acá
            </Link>
            .
          </>
        ) : (
          <>
            ¿Una idea o algo que no anda?{" "}
            <Link href="/contacto?motivo=idea" className="text-zinc-300 underline hover:text-white">
              Contanos acá
            </Link>
            .
          </>
        )}
      </p>
    </form>
  );
}
