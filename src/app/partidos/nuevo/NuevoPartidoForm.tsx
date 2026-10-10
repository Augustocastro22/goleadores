"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { createPartido } from "@/lib/actions/partidos";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import HoraSelect from "@/components/HoraSelect";
import CanchaInput from "@/components/CanchaInput";
import Avatar from "@/components/ui/Avatar";
import { Input, Label } from "@/components/ui/Input";
import { IconGoal } from "@/components/icons";
import Marcador from "@/components/Marcador";
import VotacionPartidoFields, { type VotarEnPartido } from "@/components/VotacionPartidoFields";
import type { AppConfig } from "@/lib/config";
import EquipoPicker, { type EquipoElegido } from "./EquipoPicker";

type Modo = "programar" | "jugado";

/**
 * Alta de un partido. Dos modos: programar uno que se va a jugar (se convoca
 * y se avisa) o cargar uno que ya se jugó (quiénes jugaron y los goles, todo
 * junto, sin convocatoria). El modo va en el campo "modo" (ver createPartido).
 */
export default function NuevoPartidoForm({
  jugadores,
  hoy,
  pideConfirmacion,
  canchas,
  config,
}: {
  jugadores: Profile[];
  /** Fecha de hoy en Argentina, para limitar el calendario según el modo. */
  hoy: string;
  pideConfirmacion: boolean;
  /** Las canchas del grupo, para elegir el lugar. */
  canchas: { nombre: string }[];
  /** Reglas de votación del grupo, para elegir qué se vota si ya se jugó. */
  config: Pick<AppConfig, "vota_mvp" | "vota_peor" | "min_jugadores_votacion">;
}) {
  const [modo, setModo] = useState<Modo>("programar");
  const [equipos, setEquipos] = useState<Record<string, EquipoElegido>>({});
  const [rival, setRival] = useState("");
  const [votar, setVotar] = useState<VotarEnPartido>({ mvp: true, peor: true });
  const jugado = modo === "jugado";

  return (
    <ActionForm action={createPartido} className="flex flex-col gap-4">
      <input type="hidden" name="modo" value={modo} />
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-white/5 p-1">
        {(
          [
            ["programar", "Programar"],
            ["jugado", "Ya se jugó"],
          ] as const
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setModo(valor)}
            aria-pressed={modo === valor}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              modo === valor
                ? "bg-white/10 text-white shadow"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>
      <p className="-mt-1 text-xs text-zinc-500">
        {jugado
          ? "Para cargar un partido que se olvidaron de cargar antes: marcá quiénes jugaron y los goles. No se manda convocatoria; al guardar les llega el resultado."
          : pideConfirmacion
            ? "A los convocados les llega un aviso para que confirmen si juegan."
            : "A los convocados les llega un aviso de que están convocados."}
      </p>

      <div className="flex gap-3">
        <Label className="min-w-0 flex-1">
          Fecha
          {/* El key la vacía al cambiar de modo: una fecha válida en uno no lo es en el otro. */}
          <Input
            key={modo}
            type="date"
            name="fecha"
            required
            {...(jugado ? { max: hoy } : { min: hoy })}
          />
        </Label>
        <Label className="w-28 shrink-0">
          Hora
          <HoraSelect />
        </Label>
      </div>
      <Label>
        Lugar
        <CanchaInput canchas={canchas} required />
      </Label>
      <Label>
        Rival / nombre del Equipo 2
        <Input
          type="text"
          name="rival"
          required
          value={rival}
          onChange={(e) => setRival(e.target.value)}
        />
      </Label>

      <div>
        <p className="mb-1 text-sm font-medium text-zinc-300">
          {jugado ? "Quiénes jugaron" : "Convocados"}
        </p>
        <p className="mb-2 text-xs text-zinc-500">
          {jugado
            ? "Marcá en qué equipo jugó cada uno; los que no jugaron, dejalos sin marcar."
            : "Marcá a quién convocás y en qué equipo."}{" "}
          Un jugador del grupo puede jugar en el Equipo 2 y sus goles cuentan
          igual en la tabla histórica.
        </p>
        <div className="flex flex-col gap-2">
          {jugadores.map((jugador) => (
            <div
              key={jugador.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/5 px-3.5 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={jugador.foto_url} alt={jugador.apodo} size={28} />
                <span className="block truncate text-sm text-zinc-200">
                  {jugador.nombre} {jugador.apellido}{" "}
                  <span className="text-zinc-500">({jugador.apodo})</span>
                </span>
              </div>
              <EquipoPicker
                jugadorId={jugador.id}
                apodo={jugador.apodo}
                equipo={equipos[jugador.id] ?? ""}
                onChange={(equipo) =>
                  setEquipos((prev) => ({ ...prev, [jugador.id]: equipo }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      {jugado && (
        <>
          <GolesFields jugadores={jugadores} equipos={equipos} rival={rival} />
          <VotacionPartidoFields
            config={config}
            cantidadJugadores={Object.values(equipos).filter((e) => e === "1" || e === "2").length}
            value={votar}
            onChange={setVotar}
            reglasHref="/admin?tab=config"
          />
        </>
      )}

      <SubmitButton
        pendingText={jugado ? "Guardando..." : "Creando..."}
        className="mt-2"
      >
        {jugado ? "Guardar partido jugado" : "Crear partido"}
      </SubmitButton>
    </ActionForm>
  );
}

/**
 * Goles de cada uno de los que jugaron (campos "goles-<id>") y de los
 * invitados no registrados de cada equipo ("goles_otros" y "goles_rival").
 */
function GolesFields({
  jugadores,
  equipos,
  rival,
}: {
  jugadores: Profile[];
  equipos: Record<string, EquipoElegido>;
  rival: string;
}) {
  const [goles, setGoles] = useState<Record<string, number>>({});
  const [golesOtros, setGolesOtros] = useState(0);
  const [golesRival, setGolesRival] = useState(0);

  const delEquipo = (e: "1" | "2") =>
    jugadores.filter((j) => equipos[j.id] === e);
  const total = (e: "1" | "2", invitados: number) =>
    delEquipo(e).reduce((suma, j) => suma + (goles[j.id] ?? 0), 0) + invitados;
  const nombreRival = rival.trim() || "Equipo 2";

  const equipo = (
    e: "1" | "2",
    titulo: string,
    invitados: number,
    setInvitados: (v: number) => void,
  ) => (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-white/5">
      <p className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-400">
        <IconGoal
          className={`h-4 w-4 ${e === "1" ? "text-primary-400" : "text-gold-400"}`}
        />{" "}
        {titulo}
      </p>
      {delEquipo(e).map((j) => (
        <GolesRow
          key={j.id}
          name={`goles-${j.id}`}
          label={j.apodo}
          value={goles[j.id] ?? 0}
          onChange={(v) => setGoles((prev) => ({ ...prev, [j.id]: v }))}
        />
      ))}
      <GolesRow
        name={e === "1" ? "goles_otros" : "goles_rival"}
        label="Invitados no registrados"
        detalle="No cuentan para la tabla"
        value={invitados}
        onChange={setInvitados}
      />
    </div>
  );

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-300">Goles</p>
      <Marcador
        golesNosotros={total("1", golesOtros)}
        golesRival={total("2", golesRival)}
        rival={nombreRival}
        className="mb-4 mt-1"
      />
      <div className="flex flex-col gap-3">
        {equipo("1", "Equipo 1 (Nosotros)", golesOtros, setGolesOtros)}
        {equipo("2", `Equipo 2 (${nombreRival})`, golesRival, setGolesRival)}
      </div>
    </div>
  );
}

function GolesRow({
  name,
  label,
  detalle,
  value,
  onChange,
}: {
  name: string;
  label: string;
  detalle?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 px-3.5 py-2">
      <span className="min-w-0 text-sm text-zinc-200">
        <span className="block truncate">{label}</span>
        {detalle && <span className="block text-xs text-zinc-500">{detalle}</span>}
      </span>
      <input
        type="number"
        name={name}
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-16 shrink-0 rounded-lg border border-border bg-white/5 px-2 py-1.5 text-center text-sm text-white outline-none focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
      />
    </label>
  );
}
