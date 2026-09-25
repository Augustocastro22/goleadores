"use client";

import { useState } from "react";
import type { Profile, RankingRow } from "@/lib/types";
import PlantelGrid from "./PlantelGrid";
import FormacionBuilder from "./FormacionBuilder";

type Tab = "plantel" | "formacion";

export default function JugadoresTabs({
  jugadores,
  goleadores,
  mvpRows,
  peorRows,
  tabInicial,
}: {
  jugadores: Profile[];
  goleadores: RankingRow[];
  mvpRows: RankingRow[];
  peorRows: RankingRow[];
  tabInicial: Tab;
}) {
  const [tab, setTab] = useState<Tab>(tabInicial);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          {tab === "plantel" ? "Jugadores" : "Armar formación"}
        </h1>
      </div>
      <p className="mb-4 text-sm text-zinc-500">
        {tab === "plantel"
          ? "El plantel completo del grupo."
          : "Elegí cuántos juegan, la formación, ubicá al plantel y descargá la imagen para mandar por el grupo."}
      </p>

      <div className="mb-5 inline-flex rounded-xl border border-border bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setTab("plantel")}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            tab === "plantel" ? "bg-primary-500/15 text-primary-400" : "text-zinc-400 hover:text-white"
          }`}
        >
          Plantel
        </button>
        <button
          type="button"
          onClick={() => setTab("formacion")}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            tab === "formacion" ? "bg-primary-500/15 text-primary-400" : "text-zinc-400 hover:text-white"
          }`}
        >
          Formación
        </button>
      </div>

      {tab === "plantel" ? (
        <PlantelGrid
          jugadores={jugadores}
          goleadores={goleadores}
          mvpRows={mvpRows}
          peorRows={peorRows}
        />
      ) : (
        <FormacionBuilder jugadores={jugadores} />
      )}
    </div>
  );
}
