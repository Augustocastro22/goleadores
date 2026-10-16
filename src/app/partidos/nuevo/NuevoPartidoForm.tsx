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
import GolesInput from "@/components/GolesInput";
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
  /** Reglas del grupo: cómo juegan (y nombres de los equipos) y qué se vota si ya se jugó. */
  config: Pick<
    AppConfig,
    "vota_mvp" | "vota_peor" | "min_jugadores_votacion" | "modo_juego" | "nombre_equipo_1" | "nombre_equipo_2"
  >;
}) {
  const [modo, setModo] = useState<Modo>("programar");
  // Entre ellos (dos equipos del grupo) o contra otro equipo: lo que juega el
  // grupo normalmente, y cada partido puede ser la excepción.
  const [interno, setInterno] = useState(config.modo_juego === "entre_nosotros");
  const [equipos, setEquipos] = useState<Record<string, EquipoElegido>>({});
  const [rival, setRival] = useState("");
  const [votar, setVotar] = useState<VotarEnPartido>({ mvp: true, peor: true });
  const jugado = modo === "jugado";
  const nombres: [string, string] = interno
    ? [config.nombre_equipo_1, config.nombre_equipo_2]
    : ["Nosotros", rival.trim() || "Rival"];

  function cambiarInterno(valor: boolean) {
    setInterno(valor);
    // Contra otro equipo nadie del grupo va al segundo: los que estaban ahí quedan sin marcar.
    if (!valor) setEquipos((prev) => Object.fromEntries(Object.entries(prev).map(([id, e]) => [id, e === "2" ? "" : e])));
  }

  return (
    <ActionForm action={createPartido} className="flex flex-col gap-4">
      <input type="hidden" name="modo" value={modo} />
      <input type="hidden" name="interno" value={interno ? "1" : "0"} />
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
      {interno ? (
        // Entre ellos el "rival" es el segundo equipo del grupo.
        <input type="hidden" name="rival" value={config.nombre_equipo_2} />
      ) : (
        <div className="flex flex-col gap-1.5">
          {/* El cambio de modo, discreto y en la misma línea: se ve antes de armar nada. */}
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="rival" className="text-sm font-medium text-zinc-300">
              Rival
            </label>
            <CambiarModo interno={interno} onCambiar={cambiarInterno} />
          </div>
          <Input
            id="rival"
            type="text"
            name="rival"
            required
            placeholder="Contra quién juegan"
            value={rival}
            onChange={(e) => setRival(e.target.value)}
          />
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-300">
            {interno
              ? `${config.nombre_equipo_1} vs ${config.nombre_equipo_2}`
              : jugado
                ? "Quiénes jugaron"
                : "Convocados"}
          </p>
          {interno && <CambiarModo interno={interno} onCambiar={cambiarInterno} />}
        </div>
        <p className="mb-2 text-xs text-zinc-500">
          {interno
            ? jugado
              ? "Marcá en qué equipo jugó cada uno; los que no jugaron, dejalos sin marcar."
              : "Marcá a quién convocás y en qué equipo."
            : jugado
              ? "Marcá quiénes jugaron."
              : "Marcá a quién convocás."}
        </p>
        <div className="flex flex-col gap-2">
          {jugadores.map((jugador) => (
            <div
              key={jugador.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-border bg-white/5 px-3.5 py-2.5"
            >
              {/* Al menos este ancho para el nombre: si los botones no entran al lado, bajan a otra línea. */}
              <div className="flex min-w-[9rem] flex-1 items-center gap-3">
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
                soloUno={!interno}
                nombres={nombres}
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
          <GolesFields jugadores={jugadores} equipos={equipos} nombres={nombres} interno={interno} />
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
  nombres,
  interno,
}: {
  jugadores: Profile[];
  equipos: Record<string, EquipoElegido>;
  /** Los nombres de los dos lados ("Nosotros" y el rival, o los dos equipos del grupo). */
  nombres: [string, string];
  /** Entre ellos: el segundo equipo también tiene jugadores del grupo. */
  interno: boolean;
}) {
  const [goles, setGoles] = useState<Record<string, number>>({});
  const [golesOtros, setGolesOtros] = useState(0);
  const [golesRival, setGolesRival] = useState(0);

  const delEquipo = (e: "1" | "2") =>
    jugadores.filter((j) => equipos[j.id] === e);
  const total = (e: "1" | "2", invitados: number) =>
    delEquipo(e).reduce((suma, j) => suma + (goles[j.id] ?? 0), 0) + invitados;

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
        nosotros={nombres[0]}
        rival={nombres[1]}
        className="mb-4 mt-1"
      />
      <div className="flex flex-col gap-3">
        {equipo("1", nombres[0], golesOtros, setGolesOtros)}
        {interno ? (
          equipo("2", nombres[1], golesRival, setGolesRival)
        ) : (
          // Contra otro equipo: solo cuántos goles hizo el rival.
          <div className="rounded-xl border border-border bg-white/5">
            <GolesRow name="goles_rival" label={`Goles de ${nombres[1]}`} value={golesRival} onChange={setGolesRival} />
          </div>
        )}
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
      <GolesInput name={name} value={value} onChange={onChange} />
    </label>
  );
}

/** El link para que este partido sea la excepción: entre ellos en un grupo que juega contra otros, o al revés. */
function CambiarModo({ interno, onCambiar }: { interno: boolean; onCambiar: (interno: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCambiar(!interno)}
      className="shrink-0 text-xs font-semibold text-primary-400 hover:text-primary-300"
    >
      {interno ? "¿Contra otro equipo?" : "¿Juegan entre ustedes?"}
    </button>
  );
}
