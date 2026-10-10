"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { IconGoal } from "@/components/icons";
import Marcador from "@/components/Marcador";
import { guardarGolesPartido } from "@/lib/actions/partidos";
import VotacionPartidoFields, { type VotarEnPartido } from "@/components/VotacionPartidoFields";
import type { AppConfig } from "@/lib/config";

interface Jugador {
  jugadorId: string;
  nombre: string;
  apellido: string;
  apodo: string;
  fotoUrl: string | null;
  goles: number;
}

export default function GolesEditor({
  partidoId,
  rival,
  fecha,
  lugar,
  equipo1,
  equipo2,
  golesOtrosInit,
  golesRivalInit,
  isAdmin,
  marcadorDesafio,
  votacion,
}: {
  partidoId: string;
  rival: string;
  fecha: string;
  lugar: string;
  equipo1: Jugador[];
  equipo2: Jugador[];
  golesOtrosInit: number;
  golesRivalInit: number;
  isAdmin: boolean;
  /**
   * En un desafío el marcador sale del resultado del desafío (el acordado, o
   * la versión de este grupo): no se cargan los goles del rival ni "otros",
   * se calculan. null = todavía no hay resultado del desafío. Si después el
   * resultado cambia, la base recalcula "otros" y el rival
   * (aplicar_marcador_desafio); si los goles quedan de más se avisa acá.
   */
  marcadorDesafio?: { mios: number | null; rival: number | null };
  /** Solo la primera vez que se carga el resultado: el admin elige qué se vota (ver VotacionPartidoFields). */
  votacion?: {
    config: Pick<AppConfig, "vota_mvp" | "vota_peor" | "min_jugadores_votacion">;
    reglasHref: string;
  };
}) {
  const esDesafio = marcadorDesafio !== undefined;
  const router = useRouter();
  const [goles, setGoles] = useState<Record<string, number>>(() => {
    const inicial: Record<string, number> = {};
    for (const j of [...equipo1, ...equipo2]) inicial[j.jugadorId] = j.goles;
    return inicial;
  });
  const [golesOtros, setGolesOtros] = useState(golesOtrosInit);
  const [golesRival, setGolesRival] = useState(golesRivalInit);
  const [votar, setVotar] = useState<VotarEnPartido>({ mvp: true, peor: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const golesDeJugadores = useMemo(
    () => equipo1.reduce((total, j) => total + (goles[j.jugadorId] ?? 0), 0),
    [equipo1, goles]
  );
  const golesEquipo1 = golesDeJugadores + golesOtros;
  const golesEquipo2 = useMemo(
    () => equipo2.reduce((total, j) => total + (goles[j.jugadorId] ?? 0), 0) + golesRival,
    [equipo2, goles, golesRival]
  );

  // En un desafío: lo que no suman los jugadores son "otros".
  const otrosDesafio =
    marcadorDesafio?.mios != null ? Math.max(0, marcadorDesafio.mios - golesDeJugadores) : 0;
  const golesDeMas = marcadorDesafio?.mios != null && golesDeJugadores > marcadorDesafio.mios;
  const esperandoResultado = esDesafio && marcadorDesafio.mios == null;

  async function handleGuardar() {
    setSaving(true);
    setMessage(null);
    const result = await guardarGolesPartido({
      partidoId,
      goles: Object.entries(goles).map(([jugadorId, cantidad]) => ({ jugadorId, goles: cantidad })),
      golesOtros,
      golesRival,
      votar: votacion ? votar : undefined,
    });
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "ok", text: "Goles guardados." });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500">
          <span className="truncate capitalize">{fecha}</span>
          <span className="truncate">{lugar}</span>
        </div>
        {!esDesafio ? (
          <Marcador golesNosotros={golesEquipo1} golesRival={golesEquipo2} rival={rival} className="mt-4" />
        ) : marcadorDesafio.mios != null && marcadorDesafio.rival != null ? (
          <Marcador golesNosotros={marcadorDesafio.mios} golesRival={marcadorDesafio.rival} rival={rival} className="mt-4" />
        ) : (
          <p className="mt-4 text-center text-sm text-zinc-500">
            Todavía no hay resultado del desafío. Cuando se juegue, cargalo arriba y después los goles de cada uno.
          </p>
        )}
      </Card>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
          <IconGoal className="h-5 w-5 text-primary-400" /> Goles · Equipo 1 (Nosotros)
        </h2>
        <Card className="divide-y divide-border overflow-hidden py-1">
          {equipo1.map((j) => (
            <JugadorRow
              key={j.jugadorId}
              jugador={j}
              isAdmin={isAdmin}
              value={goles[j.jugadorId] ?? 0}
              onChange={(v) => setGoles((prev) => ({ ...prev, [j.jugadorId]: v }))}
            />
          ))}
          {esDesafio ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-zinc-500">
                Otros <span className="text-zinc-600">(invitados, goles en contra: lo que falta para el resultado)</span>
              </span>
              <span className="text-lg font-bold tabular-nums text-white">{otrosDesafio}</span>
            </div>
          ) : (
            <InvitadosRow isAdmin={isAdmin} value={golesOtros} onChange={setGolesOtros} />
          )}
        </Card>
        {esDesafio && marcadorDesafio.mios != null && !golesDeMas && otrosDesafio > 0 && isAdmin && (
          <p className="mt-2 text-sm text-gold-400">
            {otrosDesafio === 1 ? "Queda 1 gol" : `Quedan ${otrosDesafio} goles`} en Otros: si {otrosDesafio === 1 ? "lo hizo" : "los hizo"} alguien
            del grupo, cargáselo{otrosDesafio === 1 ? "" : "s"}.
          </p>
        )}
        {golesDeMas && (
          <p className="mt-2 text-sm text-danger-400">
            Suman {golesDeJugadores} goles, pero en el resultado del desafío hicieron {marcadorDesafio?.mios}. Hasta
            que los corrijas no se pueden cargar otros partidos.
          </p>
        )}
      </div>

      {!esDesafio && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <IconGoal className="h-5 w-5 text-gold-400" /> Goles · Equipo 2 ({rival})
          </h2>
          <Card className="divide-y divide-border overflow-hidden py-1">
            {equipo2.length === 0 && (
              <p className="px-4 py-3 text-sm text-zinc-500">Ningún jugador del grupo jugó acá.</p>
            )}
            {equipo2.map((j) => (
              <JugadorRow
                key={j.jugadorId}
                jugador={j}
                isAdmin={isAdmin}
                value={goles[j.jugadorId] ?? 0}
                onChange={(v) => setGoles((prev) => ({ ...prev, [j.jugadorId]: v }))}
              />
            ))}
            <InvitadosRow isAdmin={isAdmin} value={golesRival} onChange={setGolesRival} />
          </Card>
        </div>
      )}

      {isAdmin && votacion && !esperandoResultado && (
        <VotacionPartidoFields
          config={votacion.config}
          cantidadJugadores={equipo1.length + equipo2.length}
          value={votar}
          onChange={setVotar}
          reglasHref={votacion.reglasHref}
        />
      )}

      {isAdmin && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={handleGuardar}
            disabled={saving || esperandoResultado || golesDeMas}
            className="w-full"
          >
            {saving ? "Guardando..." : "Guardar goles"}
          </Button>          {message && (
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
      )}
    </div>
  );
}

function JugadorRow({
  jugador,
  isAdmin,
  value,
  onChange,
}: {
  jugador: Jugador;
  isAdmin: boolean;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={jugador.fotoUrl} alt={jugador.apodo} size={32} />
        <span className="truncate text-sm text-zinc-200">
          {jugador.nombre} {jugador.apellido} <span className="text-zinc-500">({jugador.apodo})</span>
        </span>
      </div>
      {isAdmin ? (
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-16 shrink-0 rounded-lg border border-border bg-white/5 px-2 py-1.5 text-center text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
        />
      ) : (
        <span className="text-lg font-bold tabular-nums text-white">{value}</span>
      )}
    </div>
  );
}

function InvitadosRow({
  isAdmin,
  value,
  onChange,
}: {
  isAdmin: boolean;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-zinc-500">
        Invitados no registrados <span className="text-zinc-600">(no cuentan para la tabla)</span>
      </span>
      {isAdmin ? (
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-16 shrink-0 rounded-lg border border-border bg-white/5 px-2 py-1.5 text-center text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
        />
      ) : (
        <span className="text-lg font-bold tabular-nums text-white">{value}</span>
      )}
    </div>
  );
}
