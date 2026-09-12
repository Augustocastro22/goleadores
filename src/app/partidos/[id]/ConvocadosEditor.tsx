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
  const asignacionesIniciales = useMemo(() => {
    const inicial: Record<string, Equipo> = {};
    for (const id of equipo1IdsInit) inicial[id] = 1;
    for (const id of equipo2IdsInit) inicial[id] = 2;
    return inicial;
  }, [equipo1IdsInit, equipo2IdsInit]);

  const [editando, setEditando] = useState(false);
  const [asignaciones, setAsignaciones] = useState(asignacionesIniciales);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const cantidad = useMemo(() => Object.keys(asignaciones).length, [asignaciones]);

  const jugadorPorId = useMemo(() => {
    const map = new Map<string, Profile>();
    jugadores.forEach((j) => map.set(j.id, j));
    return map;
  }, [jugadores]);

  const convocadosActuales = useMemo(
    () =>
      [...equipo1IdsInit, ...equipo2IdsInit]
        .map((id) => jugadorPorId.get(id))
        .filter((j): j is Profile => Boolean(j)),
    [equipo1IdsInit, equipo2IdsInit, jugadorPorId]
  );

  function empezarEdicion() {
    setMessage(null);
    setAsignaciones(asignacionesIniciales);
    setEditando(true);
  }

  function cancelarEdicion() {
    setMessage(null);
    setAsignaciones(asignacionesIniciales);
    setEditando(false);
  }

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
      setEditando(false);
      router.refresh();
    }
  }

  if (!editando) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Convocatoria</h2>
          <button
            type="button"
            onClick={empezarEdicion}
            className="text-xs font-semibold text-primary-400 hover:text-primary-300"
          >
            Editar
          </button>
        </div>
        <Card className="divide-y divide-border overflow-hidden py-1">
          {convocadosActuales.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Todavía no hay nadie convocado.</p>
          ) : (
            convocadosActuales.map((jugador) => (
              <div key={jugador.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar src={jugador.foto_url} alt={jugador.apodo} size={32} />
                <span className="truncate text-sm text-zinc-200">
                  {jugador.nombre} {jugador.apellido}{" "}
                  <span className="text-zinc-500">({jugador.apodo})</span>
                </span>
              </div>
            ))
          )}
        </Card>
        {message && (
          <p
            className={`mt-2 rounded-xl border px-3.5 py-2.5 text-sm ${
              message.type === "ok"
                ? "border-primary-500/20 bg-primary-500/10 text-primary-400"
                : "border-danger-500/20 bg-danger-500/10 text-danger-400"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    );
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
          <div className="flex gap-2">
            <Button type="button" onClick={handleGuardar} disabled={saving} className="flex-1">
              {saving ? "Guardando..." : `Guardar convocatoria (${cantidad})`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={cancelarEdicion}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
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
