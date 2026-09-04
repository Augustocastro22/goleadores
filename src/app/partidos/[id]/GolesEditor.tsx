"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { IconGoal } from "@/components/icons";
import { guardarGolesPartido } from "@/lib/actions/partidos";

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
}) {
  const router = useRouter();
  const [goles, setGoles] = useState<Record<string, number>>(() => {
    const inicial: Record<string, number> = {};
    for (const j of [...equipo1, ...equipo2]) inicial[j.jugadorId] = j.goles;
    return inicial;
  });
  const [golesOtros, setGolesOtros] = useState(golesOtrosInit);
  const [golesRival, setGolesRival] = useState(golesRivalInit);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const golesEquipo1 = useMemo(
    () => equipo1.reduce((total, j) => total + (goles[j.jugadorId] ?? 0), 0) + golesOtros,
    [equipo1, goles, golesOtros]
  );
  const golesEquipo2 = useMemo(
    () => equipo2.reduce((total, j) => total + (goles[j.jugadorId] ?? 0), 0) + golesRival,
    [equipo2, goles, golesRival]
  );

  async function handleGuardar() {
    setSaving(true);
    setMessage(null);
    const result = await guardarGolesPartido({
      partidoId,
      goles: Object.entries(goles).map(([jugadorId, cantidad]) => ({ jugadorId, goles: cantidad })),
      golesOtros,
      golesRival,
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
        <div className="mt-4 flex items-center justify-center gap-4 sm:gap-6">
          <p className="flex-1 truncate text-right text-sm font-semibold text-zinc-300 sm:text-base">
            Nosotros
          </p>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-white/5 px-5 py-2.5">
            <span className="text-3xl font-extrabold tabular-nums text-white">{golesEquipo1}</span>
            <span className="text-lg font-bold text-zinc-600">–</span>
            <span className="text-3xl font-extrabold tabular-nums text-white">{golesEquipo2}</span>
          </div>
          <p className="flex-1 truncate text-left text-sm font-semibold text-zinc-300 sm:text-base">
            {rival}
          </p>
        </div>
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
          <InvitadosRow
            isAdmin={isAdmin}
            value={golesOtros}
            onChange={setGolesOtros}
          />
        </Card>
      </div>

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

      {isAdmin && (
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={handleGuardar} disabled={saving} className="w-full">
            {saving ? "Guardando..." : "Guardar goles"}
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
