"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bloqueo, DisponibilidadTipo } from "@/lib/types";
import { DIAS_SEMANA, describirBloqueo } from "@/lib/disponibilidad";
import { crearBloqueo, eliminarBloqueo } from "@/lib/actions/disponibilidad";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { IconTrash } from "@/components/icons";

const TIPOS: { value: DisponibilidadTipo; label: string }[] = [
  { value: "puntual", label: "Un día puntual" },
  { value: "rango", label: "Un rango de fechas" },
  { value: "recurrente", label: "Siempre (por día de semana)" },
];

export default function DisponibilidadEditor({ bloqueosIniciales }: { bloqueosIniciales: Bloqueo[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [borrados, setBorrados] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState<DisponibilidadTipo>("puntual");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const bloqueos = useMemo(
    () => bloqueosIniciales.filter((b) => !borrados.has(b.id)),
    [bloqueosIniciales, borrados]
  );

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    formData.set("tipo", tipo);
    const result = await crearBloqueo(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "ok", text: "Bloqueo agregado." });
    formRef.current?.reset();
    router.refresh();
  }

  async function handleEliminar(id: string) {
    setBorrados((prev) => new Set(prev).add(id));
    const formData = new FormData();
    formData.set("bloqueo_id", id);
    await eliminarBloqueo(formData);
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div>
        <p className="font-semibold text-white">Disponibilidad</p>
        <p className="mt-1 text-xs text-zinc-500">
          Marcá los días que no podés jugar. Es solo un aviso para el admin al armar la
          convocatoria, no te saca solo del partido.
        </p>
      </div>

      {bloqueos.length > 0 && (
        <div className="flex flex-col gap-2">
          {bloqueos.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/5 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">{describirBloqueo(b)}</p>
                {b.nota && <p className="truncate text-xs text-zinc-500">{b.nota}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleEliminar(b.id)}
                className="shrink-0 text-zinc-500 hover:text-danger-400"
                aria-label="Eliminar bloqueo"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={handleSubmit}
        className="flex flex-col gap-3 border-t border-border pt-4"
      >
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                tipo === t.value
                  ? "border-primary-500/40 bg-primary-500/15 text-primary-400"
                  : "border-border bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tipo === "puntual" && (
          <Label>
            Fecha
            <Input type="date" name="fecha_desde" required />
          </Label>
        )}

        {tipo === "rango" && (
          <div className="flex gap-3">
            <Label className="flex-1">
              Desde
              <Input type="date" name="fecha_desde" required />
            </Label>
            <Label className="flex-1">
              Hasta
              <Input type="date" name="fecha_hasta" required />
            </Label>
          </div>
        )}

        {tipo === "recurrente" && (
          <Label>
            Día de la semana
            <select
              name="dia_semana"
              required
              defaultValue=""
              className="w-full rounded-xl border border-border bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
            >
              <option value="" disabled className="bg-surface">
                Elegí un día...
              </option>
              {DIAS_SEMANA.map((dia, i) => (
                <option key={dia} value={i} className="bg-surface">
                  {dia}
                </option>
              ))}
            </select>
          </Label>
        )}

        <div className="flex gap-3">
          <Label className="flex-1">
            Desde (hora, opcional)
            <Input type="time" name="hora_desde" />
          </Label>
          <Label className="flex-1">
            Hasta (hora, opcional)
            <Input type="time" name="hora_hasta" />
          </Label>
        </div>

        <Label>
          Nota (opcional)
          <Input type="text" name="nota" placeholder="Ej: de viaje" maxLength={100} />
        </Label>

        <Button type="submit" size="sm" disabled={saving} className="self-start">
          {saving ? "Guardando..." : "Agregar bloqueo"}
        </Button>

        {message && (
          <p
            className={`rounded-xl border px-3.5 py-2.5 text-sm ${
              message.type === "ok"
                ? "border-primary-500/20 bg-primary-500/10 text-primary-400"
                : "border-danger-500/20 bg-danger-500/10 text-danger-400"
            }`}
          >
            {message.text}
          </p>
        )}
      </form>
    </Card>
  );
}
