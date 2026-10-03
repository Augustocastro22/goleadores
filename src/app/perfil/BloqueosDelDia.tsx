"use client";

import { useState } from "react";
import type { Bloqueo } from "@/lib/types";
import { HORARIOS, describirBloqueo, liberarDia } from "@/lib/disponibilidad";
import { eliminarBloqueo, reemplazarBloqueo } from "@/lib/actions/disponibilidad";
import Button from "@/components/ui/Button";
import { IconClose } from "@/components/icons";

const selectClass =
  "w-full appearance-none rounded-xl border border-border bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20";

interface Edicion {
  id: string;
  todoElDia: boolean;
  desde: string;
  hasta: string;
}

/**
 * Lo que ya está marcado en un día, para editarle el horario, borrarlo o
 * (si es un rango o "todos los <día>") liberar solo ese día. Se abre al tocar un día marcado en
 * el calendario o una hora roja en la agenda.
 */
export default function BloqueosDelDia({
  titulo,
  fecha,
  bloqueos,
  nombreGrupo,
  onReemplazado,
  onBorrado,
  onCerrar,
  onAgregar,
}: {
  titulo: string;
  fecha: string;
  bloqueos: Bloqueo[];
  nombreGrupo: Map<string, string>;
  onReemplazado: (id: string, nuevos: Bloqueo[]) => void;
  onBorrado: (id: string) => void;
  onCerrar: () => void;
  onAgregar?: () => void;
}) {
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reemplazar(b: Bloqueo, nuevos: Parameters<typeof reemplazarBloqueo>[0]["nuevos"]) {
    setTrabajando(true);
    setError(null);
    const result = await reemplazarBloqueo({ id: b.id, nuevos });
    setTrabajando(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setEdicion(null);
    onReemplazado(b.id, result.bloqueos);
  }

  async function borrar(b: Bloqueo) {
    setTrabajando(true);
    setError(null);
    const formData = new FormData();
    formData.set("bloqueo_id", b.id);
    const result = await eliminarBloqueo(formData);
    setTrabajando(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onBorrado(b.id);
  }

  async function guardarEdicion(b: Bloqueo) {
    if (!edicion) return;
    if (!edicion.todoElDia && (!edicion.desde || !edicion.hasta)) {
      setError("Completá el desde y el hasta.");
      return;
    }
    await reemplazar(b, [
      {
        tipo: b.tipo,
        fecha_desde: b.fecha_desde,
        fecha_hasta: b.fecha_hasta,
        dia_semana: b.dia_semana,
        hora_desde: edicion.todoElDia ? null : edicion.desde,
        hora_hasta: edicion.todoElDia ? null : edicion.hasta,
        excepciones: b.excepciones ?? [],
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-danger-500/20 bg-danger-500/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{titulo}</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-zinc-500 hover:text-white">
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      {bloqueos.length === 0 && <p className="text-sm text-zinc-500">No tenés nada marcado este día.</p>}

      {bloqueos.map((b) => {
        const editando = edicion?.id === b.id;
        return (
          <div key={b.id} className="flex flex-col gap-2 border-t border-danger-500/10 pt-3 first-of-type:border-0 first-of-type:pt-0">
            <div>
              <p className="text-sm text-zinc-200">{describirBloqueo(b)}</p>
              <p className="text-xs text-zinc-500">
                {b.grupo_id ? `Solo en ${nombreGrupo.get(b.grupo_id) ?? "un grupo"}` : "Todos mis grupos"}
                {b.nota && ` · ${b.nota}`}
              </p>
            </div>

            {editando ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {[
                    { valor: true, label: "Todo el día" },
                    { valor: false, label: "En ciertos horarios" },
                  ].map((op) => (
                    <button
                      key={op.label}
                      type="button"
                      onClick={() => setEdicion({ ...edicion, todoElDia: op.valor })}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        edicion.todoElDia === op.valor
                          ? "border-primary-500/40 bg-primary-500/15 text-primary-400"
                          : "border-border bg-white/5 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
                {!edicion.todoElDia && (
                  <div className="flex items-center gap-2">
                    <select
                      value={edicion.desde}
                      onChange={(e) => {
                        const desde = e.target.value;
                        setEdicion({ ...edicion, desde, hasta: edicion.hasta > desde ? edicion.hasta : "" });
                      }}
                      aria-label="Desde"
                      className={selectClass}
                    >
                      <option value="" disabled className="bg-surface">
                        Desde
                      </option>
                      {HORARIOS.slice(0, -1).map((hr) => (
                        <option key={hr} value={hr} className="bg-surface">
                          {hr}
                        </option>
                      ))}
                    </select>
                    <span className="shrink-0 text-xs text-zinc-500">a</span>
                    <select
                      value={edicion.hasta}
                      onChange={(e) => setEdicion({ ...edicion, hasta: e.target.value })}
                      aria-label="Hasta"
                      className={selectClass}
                    >
                      <option value="" disabled className="bg-surface">
                        Hasta
                      </option>
                      {HORARIOS.slice(1)
                        .filter((hr) => !edicion.desde || hr > edicion.desde)
                        .map((hr) => (
                          <option key={hr} value={hr} className="bg-surface">
                            {hr}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => guardarEdicion(b)} disabled={trabajando}>
                    {trabajando ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEdicion(null)} disabled={trabajando}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={trabajando}
                  onClick={() =>
                    setEdicion({
                      id: b.id,
                      todoElDia: !b.hora_desde,
                      desde: b.hora_desde?.slice(0, 5) ?? "",
                      hasta: b.hora_hasta?.slice(0, 5) ?? "",
                    })
                  }
                >
                  Editar horario
                </Button>
                {b.tipo !== "puntual" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={trabajando}
                    onClick={() => reemplazar(b, liberarDia(b, fecha))}
                  >
                    Liberar solo este día
                  </Button>
                )}
                <Button type="button" size="sm" variant="danger" disabled={trabajando} onClick={() => borrar(b)}>
                  {b.tipo === "rango" ? "Borrar todo el rango" : b.tipo === "recurrente" ? "Borrar (todas las semanas)" : "Borrar"}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {onAgregar && (
        <button
          type="button"
          onClick={onAgregar}
          className="self-start text-xs font-semibold text-primary-400 hover:text-primary-300"
        >
          + Marcar otro horario este día
        </button>
      )}

      {error && <p className="text-sm text-danger-400">{error}</p>}
    </div>
  );
}
