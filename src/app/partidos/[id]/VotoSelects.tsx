"use client";

import { useState } from "react";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import { IconGoal } from "@/components/icons";
import { votarPartido } from "@/lib/actions/votos";
import { tap } from "@/lib/haptics";

export interface Candidato {
  id: string;
  nombre: string;
  apodo: string;
  fotoUrl: string | null;
  goles: number;
}

type Categoria = "mvp" | "peor";

const TEMA: Record<Categoria, { titulo: string; aro: string; fondo: string; texto: string; marca: string }> = {
  mvp: {
    titulo: "Mejor jugador",
    aro: "bg-gold-400",
    fondo: "bg-gold-500/10 border-gold-500/40",
    texto: "text-gold-400",
    marca: "★",
  },
  peor: {
    titulo: "Peor jugador",
    aro: "bg-danger-400",
    fondo: "bg-danger-500/10 border-danger-500/40",
    texto: "text-danger-400",
    marca: "✕",
  },
};

/**
 * La votación de un partido abierto, con figuritas: se toca la cara del
 * jugador. Primero el Mejor y, si se vota, después el Peor (el que elegiste
 * como Mejor no se puede elegir como Peor). Arriba se ve lo elegido; se puede
 * volver a tocar para cambiar antes de mandar. Una vez votado, queda.
 */
export default function VotacionForm({
  partidoId,
  candidatos,
  conMvp,
  conPeor,
  votoMvpId,
  votoPeorId,
}: {
  partidoId: string;
  candidatos: Candidato[];
  conMvp: boolean;
  conPeor: boolean;
  votoMvpId: string | null;
  votoPeorId: string | null;
}) {
  const faltan: Categoria[] = [
    ...(conMvp && !votoMvpId ? (["mvp"] as const) : []),
    ...(conPeor && !votoPeorId ? (["peor"] as const) : []),
  ];
  const [elegidos, setElegidos] = useState<Record<Categoria, string | null>>({ mvp: null, peor: null });
  const [actual, setActual] = useState<Categoria>(faltan[0] ?? "mvp");
  const porId = new Map(candidatos.map((c) => [c.id, c]));

  if (faltan.length === 0) {
    const fila = (cat: Categoria, id: string | null) => {
      const c = id ? porId.get(id) : undefined;
      return (
        <div className="flex items-center gap-3">
          {c && (
            <span className={`rounded-full p-[2px] ${TEMA[cat].aro}`}>
              <Avatar src={c.fotoUrl} alt={c.apodo} size={32} className="ring-0" />
            </span>
          )}
          <span className="text-sm text-zinc-400">
            {TEMA[cat].titulo}: <span className="font-semibold text-white">{c?.apodo ?? "?"}</span>
          </span>
        </div>
      );
    };
    return (
      <Card className="flex flex-col gap-3 px-4 py-3">
        <p className="text-sm text-zinc-400">Ya votaste en este partido.</p>
        {conMvp && fila("mvp", votoMvpId)}
        {conPeor && fila("peor", votoPeorId)}
      </Card>
    );
  }
  if (candidatos.length === 0) return null;

  // El que ya está elegido (o votado antes) en la otra categoría no se puede elegir en esta.
  const otro = (cat: Categoria) => (cat === "mvp" ? (elegidos.peor ?? votoPeorId) : (elegidos.mvp ?? votoMvpId));

  function elegir(id: string) {
    tap();
    setElegidos((prev) => ({ ...prev, [actual]: prev[actual] === id ? null : id }));
    // Elegido el primero, pasa solo al siguiente que falte.
    const siguiente = faltan.find((c) => c !== actual && !elegidos[c]);
    if (siguiente && elegidos[actual] !== id) setTimeout(() => setActual(siguiente), 280);
  }

  const listo = faltan.every((c) => elegidos[c]);

  return (
    <Card className="flex flex-col gap-4 p-4">
      <ActionForm action={votarPartido} className="flex flex-col gap-4">
        <input type="hidden" name="partido_id" value={partidoId} />
        {faltan.includes("mvp") && <input type="hidden" name="mvp_jugador_id" value={elegidos.mvp ?? ""} />}
        {faltan.includes("peor") && <input type="hidden" name="peor_jugador_id" value={elegidos.peor ?? ""} />}

        {/* Lo elegido en cada categoría; tocar una la vuelve a abrir. */}
        <div className={`grid gap-2 ${faltan.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {faltan.map((cat) => {
            const c = elegidos[cat] ? porId.get(elegidos[cat]!) : undefined;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActual(cat)}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
                  actual === cat ? TEMA[cat].fondo : "border-border bg-white/5"
                }`}
              >
                {c ? (
                  <span key={c.id} className={`carta-pop rounded-full p-[2px] ${TEMA[cat].aro}`}>
                    <Avatar src={c.fotoUrl} alt={c.apodo} size={30} className="ring-0" />
                  </span>
                ) : (
                  <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border border-dashed border-white/25 text-sm ${TEMA[cat].texto}`}>
                    {TEMA[cat].marca}
                  </span>
                )}
                <span className="min-w-0">
                  <span className={`block text-[10px] font-bold tracking-wide uppercase ${TEMA[cat].texto}`}>{TEMA[cat].titulo}</span>
                  <span className="block truncate text-sm font-semibold text-white">{c?.apodo ?? "Elegí"}</span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="-mb-1 text-xs text-zinc-500">
          Tocá al <span className={`font-semibold ${TEMA[actual].texto}`}>{TEMA[actual].titulo.toLowerCase()}</span> del partido:
        </p>

        {/* Las figuritas. */}
        <div key={actual} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {candidatos.map((c, i) => {
            const elegido = elegidos[actual] === c.id;
            const bloqueado = otro(actual) === c.id;
            return (
              <button
                key={c.id}
                type="button"
                disabled={bloqueado}
                onClick={() => elegir(c.id)}
                aria-pressed={elegido}
                aria-label={`${c.apodo}${bloqueado ? " (ya lo elegiste en la otra categoría)" : ""}`}
                className={`entrada presionable relative flex flex-col items-center gap-1.5 rounded-2xl border px-1.5 pt-3 pb-2 transition disabled:cursor-not-allowed disabled:*:opacity-30 disabled:*:grayscale ${
                  elegido ? TEMA[actual].fondo : "border-border bg-white/[0.03] hover:border-border-strong"
                }`}
                style={{ "--i": i } as React.CSSProperties}
              >
                {elegido && (
                  <span className={`carta-pop absolute top-1.5 right-2 text-sm font-bold ${TEMA[actual].texto}`}>{TEMA[actual].marca}</span>
                )}
                <span className={`rounded-full p-[3px] transition ${elegido ? `${TEMA[actual].aro} scale-105` : "bg-white/10"}`}>
                  <Avatar src={c.fotoUrl} alt={c.apodo} size={52} className="ring-0" />
                </span>
                <span className="w-full truncate text-center text-xs font-semibold text-white">{c.apodo}</span>
                {c.goles > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold text-zinc-400">
                    <IconGoal className="h-3 w-3 text-primary-400" /> {c.goles}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <SubmitButton pendingText="Votando..." disabled={!listo} className="w-full">
          {listo ? "Votar" : faltan.length > 1 ? "Elegí los dos para votar" : "Elegí a uno para votar"}
        </SubmitButton>
        <p className="-mt-2 text-center text-xs text-zinc-500">Una vez que votás, el voto queda.</p>
      </ActionForm>
    </Card>
  );
}
