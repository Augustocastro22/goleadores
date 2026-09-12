"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { actualizarConvocados } from "@/lib/actions/partidos";

type Equipo = 1 | 2;

export default function ConvocadosEditor({
  partidoId,
  jugadores,
  equipo1IdsInit,
  equipo2IdsInit,
}: {
  partidoId: string;
  jugadores: Profile[];
  equipo1IdsInit: string[];
  equipo2IdsInit: string[];
}) {
  const router = useRouter();
  const [asignaciones, setAsignaciones] = useState<Record<string, Equipo>>(() => {
    const inicial: Record<string, Equipo> = {};
    for (const id of equipo1IdsInit) inicial[id] = 1;
    for (const id of equipo2IdsInit) inicial[id] = 2;
    return inicial;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const cantidad = useMemo(() => Object.keys(asignaciones).length, [asignaciones]);

  function elegir(jugadorId: string, equipo: Equipo) {
    setMessage(null);
    setAsignaciones((prev) => {
      const next = { ...prev };
      if (next[jugadorId] === equipo) {
        delete next[jugadorId];
      } else {
        next[jugadorId] = equipo;
      }
      return next;
    });
  }

  async function handleGuardar() {
    setSaving(true);
    setMessage(null);
    const result = await actualizarConvocados({
      partidoId,
      participantes: Object.entries(asignaciones).map(([jugadorId, equipo]) => ({
        jugadorId,
        equipo,
      })),
    });
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "ok", text: "Convocatoria guardada." });
      router.refresh();
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-white">Convocatoria</h2>
      <Card className="p-4">
        <p className="mb-3 text-xs text-zinc-500">
          Marcá quién juega y en qué equipo. Si alguien todavía no confirmó o se baja, dejalo sin
          marcar: podés sumarlo o sacarlo hasta antes de cargar el resultado.
        </p>
        <div className="flex flex-col gap-2">
          {jugadores.map((jugador) => {
            const equipo = asignaciones[jugador.id];
            return (
              <div
                key={jugador.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/5 px-3.5 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={jugador.foto_url} alt={jugador.apodo} size={28} />
                  <span className="truncate text-sm text-zinc-200">
                    {jugador.nombre} {jugador.apellido}{" "}
                    <span className="text-zinc-500">({jugador.apodo})</span>
                  </span>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => elegir(jugador.id, 1)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                      equipo === 1
                        ? "border-primary-500/40 bg-primary-500/10 text-primary-400"
                        : "border-border text-zinc-400 hover:text-white"
                    }`}
                  >
                    Eq. 1
                  </button>
                  <button
                    type="button"
                    onClick={() => elegir(jugador.id, 2)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                      equipo === 2
                        ? "border-gold-500/40 bg-gold-500/10 text-gold-400"
                        : "border-border text-zinc-400 hover:text-white"
                    }`}
                  >
                    Eq. 2
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button type="button" onClick={handleGuardar} disabled={saving} className="w-full">
            {saving ? "Guardando..." : `Guardar convocatoria (${cantidad})`}
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
        </div>
      </Card>
    </div>
  );
}
