"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearEncuesta } from "@/lib/actions/encuestas";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { IconClose, IconPlus } from "@/components/icons";

const MAX_OPCIONES = 8;

export default function CrearEncuestaForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [opciones, setOpciones] = useState(["", ""]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function agregarOpcion() {
    if (opciones.length >= MAX_OPCIONES) return;
    setOpciones((prev) => [...prev, ""]);
  }

  function quitarOpcion(i: number) {
    setOpciones((prev) => prev.filter((_, idx) => idx !== i));
  }

  function actualizarOpcion(i: number, valor: string) {
    setOpciones((prev) => prev.map((o, idx) => (idx === i ? valor : o)));
  }

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const result = await crearEncuesta(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    formRef.current?.reset();
    setOpciones(["", ""]);
    setAbierto(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <Button type="button" onClick={() => setAbierto(true)} className="w-full">
        <IconPlus className="h-4 w-4" /> Nueva encuesta
      </Button>
    );
  }

  return (
    <Card className="p-4">
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
        <Label>
          Pregunta
          <Input type="text" name="pregunta" required maxLength={200} placeholder="¿Qué día jugamos?" />
        </Label>

        <div>
          <p className="mb-1.5 text-sm font-medium text-zinc-300">Opciones</p>
          <div className="flex flex-col gap-2">
            {opciones.map((valor, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="text"
                  name="opcion"
                  required
                  maxLength={80}
                  value={valor}
                  onChange={(e) => actualizarOpcion(i, e.target.value)}
                  placeholder={`Opción ${i + 1}`}
                />
                {opciones.length > 2 && (
                  <button
                    type="button"
                    onClick={() => quitarOpcion(i)}
                    className="shrink-0 text-zinc-500 hover:text-danger-400"
                    aria-label="Quitar opción"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {opciones.length < MAX_OPCIONES && (
            <button
              type="button"
              onClick={agregarOpcion}
              className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary-400 hover:text-primary-300"
            >
              <IconPlus className="h-3.5 w-3.5" /> Agregar opción
            </button>
          )}
        </div>

        <Label>
          Cierra
          <Input type="datetime-local" name="cierra_en" required />
        </Label>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? "Creando..." : "Crear encuesta"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAbierto(false)} disabled={saving}>
            Cancelar
          </Button>
        </div>

        {message && (
          <p className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-400">
            {message.text}
          </p>
        )}
      </form>
    </Card>
  );
}
