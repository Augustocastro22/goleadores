"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { IconGoal } from "@/components/icons";
import Marcador from "@/components/Marcador";
import GolesInput from "@/components/GolesInput";
import MarcadorEditable from "@/components/MarcadorEditable";
import RepartoGoles from "@/components/RepartoGoles";
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
  jugado,
  marcadorDesafio,
  votacion,
  nosotros = "Nosotros",
  interno = false,
}: {
  /** El nombre del primer equipo: "Nosotros", o el del grupo cuando juegan entre ellos. */
  nosotros?: string;
  /** Entre ellos: los dos equipos son del grupo (si no, el segundo es un rival de afuera). */
  interno?: boolean;
  partidoId: string;
  rival: string;
  fecha: string;
  lugar: string;
  equipo1: Jugador[];
  equipo2: Jugador[];
  golesOtrosInit: number;
  golesRivalInit: number;
  isAdmin: boolean;
  /** Ya tiene goles cargados: se muestra para leer y el admin lo abre con "Editar goles". */
  jugado: boolean;
  /**
   * En un desafío el marcador sale del resultado del desafío (el acordado, o
   * la versión de este grupo): no se cargan los goles del rival ni "otros",
   * se calculan. null = todavía no hay resultado del desafío. Si después el
   * resultado cambia, la base recalcula "otros" y el rival
   * (aplicar_marcador_desafio); si los goles quedan de más se avisa acá.
   */
  marcadorDesafio?: {
    mios: number | null;
    rival: number | null;
    /** El otro grupo todavía no confirmó: mios/rival son la última propuesta de este grupo. */
    aConfirmar: boolean;
  };
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
  // El resultado de cada equipo se carga primero; los goles de los jugadores se reparten adentro de él
  // y lo que no se reparte queda en "Otros" (invitados, que no cuentan para la tabla).
  const sumaEquipo = (lista: Jugador[]) => lista.reduce((total, j) => total + j.goles, 0);
  const [resultado1, setResultado1] = useState(() => golesOtrosInit + sumaEquipo(equipo1));
  const [resultado2, setResultado2] = useState(() => golesRivalInit + sumaEquipo(equipo2));
  // Lo último guardado: para saber si hay algo que guardar al editar un partido ya cargado.
  const [guardado, setGuardado] = useState(() => ({
    goles: JSON.stringify([...equipo1, ...equipo2].map((j) => [j.jugadorId, j.goles])),
    resultado1: golesOtrosInit + sumaEquipo(equipo1),
    resultado2: golesRivalInit + sumaEquipo(equipo2),
  }));
  const [votar, setVotar] = useState<VotarEnPartido>({ mvp: true, peor: true });
  const [editando, setEditando] = useState(isAdmin && !jugado);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const golesDeJugadores = useMemo(
    () => equipo1.reduce((total, j) => total + (goles[j.jugadorId] ?? 0), 0),
    [equipo1, goles]
  );
  const golesDeJugadores2 = useMemo(
    () => equipo2.reduce((total, j) => total + (goles[j.jugadorId] ?? 0), 0),
    [equipo2, goles]
  );
  // Lo que queda sin repartir va a "Otros"; si los jugadores suman de más, el resultado no cierra.
  const golesOtros = Math.max(0, resultado1 - golesDeJugadores);
  const golesRival = Math.max(0, resultado2 - golesDeJugadores2);
  const deMas1 = golesDeJugadores - resultado1;
  const deMas2 = golesDeJugadores2 - resultado2;
  const noCierra = !esDesafio && (deMas1 > 0 || deMas2 > 0);
  const golesEquipo1 = resultado1;
  const golesEquipo2 = resultado2;

  // En un desafío: lo que no suman los jugadores son "otros".
  const otrosDesafio =
    marcadorDesafio?.mios != null ? Math.max(0, marcadorDesafio.mios - golesDeJugadores) : 0;
  const golesDeMas = marcadorDesafio?.mios != null && golesDeJugadores > marcadorDesafio.mios;
  const esperandoResultado = esDesafio && marcadorDesafio.mios == null;

  // Leyendo, primero los que hicieron goles; editando, el orden de siempre.
  const ordenar = (lista: Jugador[]) =>
    editando ? lista : [...lista].sort((a, b) => (goles[b.jugadorId] ?? 0) - (goles[a.jugadorId] ?? 0));

  const golesActuales = JSON.stringify([...equipo1, ...equipo2].map((j) => [j.jugadorId, goles[j.jugadorId] ?? 0]));
  const sinCambios =
    jugado &&
    golesActuales === guardado.goles &&
    resultado1 === guardado.resultado1 &&
    resultado2 === guardado.resultado2;

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
      setGuardado({ goles: golesActuales, resultado1, resultado2 });
      if (jugado) setEditando(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-500">
          <span className="truncate">{fecha}</span>
          <span className="truncate">{lugar}</span>
        </div>
        {!esDesafio ? (
          editando ? (
            <MarcadorEditable
              nosotros={nosotros}
              rival={rival}
              golesNosotros={resultado1}
              golesRival={resultado2}
              onChangeNosotros={setResultado1}
              onChangeRival={setResultado2}
              className="mt-4"
            />
          ) : (
            <Marcador golesNosotros={golesEquipo1} golesRival={golesEquipo2} nosotros={nosotros} rival={rival} className="mt-4" />
          )
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
          <IconGoal className="h-5 w-5 text-primary-400" /> Goles · {nosotros}
        </h2>
        <Card className="divide-y divide-border overflow-hidden py-1">
          {ordenar(equipo1).map((j) => (
            <JugadorRow
              key={j.jugadorId}
              jugador={j}
              editable={editando}
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
            <OtrosRow mostrarSiempre={editando} value={golesOtros} />
          )}
        </Card>
        {!esDesafio && editando && <RepartoGoles repartidos={golesDeJugadores} total={resultado1} />}
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

      {/* Contra un equipo de afuera (nadie del grupo en el Equipo 2) sus goles ya están en el
          marcador: la lista vacía solo se muestra para cargarlos. */}
      {!esDesafio && (interno || equipo2.length > 0) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <IconGoal className="h-5 w-5 text-gold-400" /> {interno ? `Goles · ${rival}` : `Goles de ${rival}`}
          </h2>
          <Card className="divide-y divide-border overflow-hidden py-1">
            {equipo2.length === 0 && interno && (
              <p className="px-4 py-3 text-sm text-zinc-500">Ningún jugador del grupo jugó acá.</p>
            )}
            {ordenar(equipo2).map((j) => (
              <JugadorRow
                key={j.jugadorId}
                jugador={j}
                editable={editando}
                value={goles[j.jugadorId] ?? 0}
                onChange={(v) => setGoles((prev) => ({ ...prev, [j.jugadorId]: v }))}
              />
            ))}
            <OtrosRow mostrarSiempre={editando} value={golesRival} />
          </Card>
          {editando && equipo2.length > 0 && <RepartoGoles repartidos={golesDeJugadores2} total={resultado2} />}
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

      {isAdmin && !editando && (
        <Button type="button" variant="secondary" onClick={() => setEditando(true)} className="w-full">
          Editar goles
        </Button>
      )}

      {isAdmin && editando && (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={handleGuardar}
            disabled={saving || esperandoResultado || golesDeMas || noCierra || sinCambios}
            className="w-full"
          >
            {saving ? "Guardando..." : "Guardar goles"}
          </Button>
          {marcadorDesafio?.aConfirmar && marcadorDesafio.mios != null && (
            <p className="text-sm text-zinc-500">
              El otro grupo todavía no confirmó el resultado. Si cambia, revisá los goles.
            </p>
          )}
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
  editable,
  value,
  onChange,
}: {
  jugador: Jugador;
  editable: boolean;
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
      {editable ? (
        <GolesInput value={value} onChange={onChange} />
      ) : (
        <GolesLectura goles={value} />
      )}
    </div>
  );
}

/** Los goles de alguien, para leer: una pelotita por gol (hasta 3) y el número; sin goles, apagado. */
function GolesLectura({ goles }: { goles: number }) {
  if (goles === 0) return <span className="text-lg font-bold tabular-nums text-zinc-700">0</span>;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="flex -space-x-1">
        {Array.from({ length: Math.min(goles, 3) }, (_, i) => (
          <IconGoal key={i} className="h-4 w-4 rounded-full bg-surface text-primary-400" />
        ))}
      </span>
      <span className="text-lg font-bold tabular-nums text-white">{goles}</span>
    </span>
  );
}

/** Los goles que no se repartieron entre jugadores: invitados o de alguien que no está cargado. Se calculan solos. */
function OtrosRow({ mostrarSiempre, value }: { mostrarSiempre: boolean; value: number }) {
  // Leyendo, sin goles de otros no hace falta la fila.
  if (!mostrarSiempre && value === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-zinc-500">
        Otros <span className="text-zinc-600">(invitados no registrados; no cuentan para la tabla)</span>
      </span>
      <GolesLectura goles={value} />
    </div>
  );
}
