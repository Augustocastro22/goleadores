import Link from "next/link";
import {
  aceptarResultadoDesafio,
  cortarResultadoDesafio,
  proponerFechaDesafio,
  proponerResultadoDesafio,
  responderFechaDesafio,
  suspenderDesafio,
} from "@/lib/actions/desafios";
import {
  diaDe,
  ESTADO_DESAFIO_LABEL,
  puedeCancelar,
  puedeCargarResultado,
  puedeConfirmarResultado,
  puedeCortar,
  puedeReprogramar,
  puedeResponderFecha,
  puedeSuspender,
  type DesafioVista,
} from "@/lib/desafios";
import { urlConGrupo } from "@/lib/grupo-cookie";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import GrupoLogo from "@/components/ui/GrupoLogo";
import { buttonClass } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import HoraSelect from "@/components/HoraSelect";
import { CancelarDesafio } from "../desafios/AccionesDesafio";
import { ESTADO_VARIANT, novedadesDesafio } from "../desafios/DesafioCard";

/** Una propuesta de resultado, vista desde este grupo. */
export interface PropuestaResultado {
  id: string;
  mia: boolean;
  mios: number;
  rival: number;
  estado: "pendiente" | "aceptada" | "reemplazada" | "cortada";
  createdAt: string;
}

const ESTADO_PROPUESTA: Record<PropuestaResultado["estado"], string> = {
  pendiente: "esperando respuesta",
  aceptada: "aceptada",
  reemplazada: "corregida",
  cortada: "sin acuerdo",
};

/**
 * El desafío en la página del partido: estado, fecha propuesta, resultado
 * entre los dos grupos y todo lo que puede hacer el admin (suspender,
 * reprogramar, cargar/confirmar el resultado, cancelar).
 */
export default function DesafioPanel({
  desafio: d,
  grupoId,
  isAdmin,
  hoy,
  propuestas,
  golesDeJugadores,
  partidoJugado,
}: {
  desafio: DesafioVista;
  grupoId: string;
  isAdmin: boolean;
  hoy: string;
  propuestas: PropuestaResultado[];
  /** Goles cargados de los jugadores del grupo (para avisar si no coinciden con el marcador). */
  golesDeJugadores: number;
  /** Si este grupo ya cargó los goles de sus jugadores. */
  partidoJugado: boolean;
}) {
  const ocultos = (
    <>
      <input type="hidden" name="desafio_id" value={d.id} />
      <input type="hidden" name="grupo_id" value={grupoId} />
    </>
  );
  const cargarResultado = isAdmin && puedeCargarResultado(d);
  const confirmarResultado = isAdmin && puedeConfirmarResultado(d);
  const novedades = novedadesDesafio(d);
  const golesDeMas = d.marcador_mios !== null && golesDeJugadores > d.marcador_mios;
  const faltanGoles = isAdmin && !partidoJugado && d.marcador_mios !== null;

  return (
    <section className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <GrupoLogo src={d.rival_logo_url} nombre={d.rival_nombre} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">Desafío vs {d.rival_nombre}</p>
            <p className="truncate text-xs text-zinc-500">
              {d.soy_desafiante ? "Los desafiaron ustedes" : "Los desafiaron a ustedes"} ·{" "}
              <Link href={urlConGrupo("/partidos/desafios", grupoId)} className="text-primary-400 hover:text-primary-300">
                Ver desafíos
              </Link>
            </p>
          </div>
          <Badge variant={ESTADO_VARIANT[d.estado]}>{ESTADO_DESAFIO_LABEL[d.estado]}</Badge>
        </div>
        {novedades.map((linea) => (
          <p key={linea} className="text-sm text-gold-400">
            {linea}
          </p>
        ))}
        {faltanGoles && (
          <p className="text-sm text-primary-400">Ahora cargá los goles de cada uno (abajo).</p>
        )}
        {golesDeMas && (
          <p className="text-sm text-danger-400">
            Los goles cargados de los jugadores ({golesDeJugadores}) son más que los del resultado del desafío (
            {d.marcador_mios}). Corregí los goles.
          </p>
        )}

        {isAdmin && puedeResponderFecha(d) && (
          <div className="flex flex-wrap gap-2">
            <ActionForm action={responderFechaDesafio} className="flex flex-col gap-1">
              {ocultos}
              <input type="hidden" name="acepta" value="true" />
              <SubmitButton size="sm" pendingText="Aceptando…">
                Aceptar fecha
              </SubmitButton>
            </ActionForm>
            <ActionForm action={responderFechaDesafio} className="flex flex-col gap-1">
              {ocultos}
              <input type="hidden" name="acepta" value="false" />
              <SubmitButton size="sm" variant="ghost" pendingText="Rechazando…">
                No podemos
              </SubmitButton>
            </ActionForm>
          </div>
        )}
        {d.propuesta_fecha && d.propuesta_vence_en && (
          <p className="text-xs text-zinc-500">Si nadie responde, la fecha nueva se acepta sola el {diaDe(d.propuesta_vence_en)}.</p>
        )}
      </Card>

      {(cargarResultado || confirmarResultado || propuestas.length > 0) && (
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-bold text-white">Resultado del desafío</h2>
          <p className="text-xs text-zinc-500">
            Lo carga cualquiera de los dos grupos y el otro lo confirma o lo corrige. Los goles de cada
            jugador los carga cada grupo abajo, como siempre.
          </p>

          {confirmarResultado && (
            <ActionForm action={aceptarResultadoDesafio} className="flex flex-col gap-1">
              {ocultos}
              <SubmitButton size="sm" pendingText="Confirmando…" className="self-start">
                Confirmar {d.resultado_pendiente_mios}-{d.resultado_pendiente_rival}
              </SubmitButton>
            </ActionForm>
          )}
          {d.resultado_pendiente_vence_en && (
            <p className="text-xs text-zinc-500">
              Si nadie responde, se confirma solo el {diaDe(d.resultado_pendiente_vence_en)}.
            </p>
          )}

          {cargarResultado && (
            <ActionForm action={proponerResultadoDesafio} className="flex flex-col gap-3">
              {ocultos}
              <div className="flex items-end gap-3">
                <Label className="flex-1">
                  Ustedes
                  <Input type="number" name="goles_mios" required min={0} max={99} inputMode="numeric" />
                </Label>
                <Label className="flex-1">
                  {d.rival_nombre}
                  <Input type="number" name="goles_rival" required min={0} max={99} inputMode="numeric" />
                </Label>
              </div>
              <SubmitButton size="sm" variant={confirmarResultado ? "secondary" : "primary"} pendingText="Guardando…" className="self-start">
                {d.resultado_estado === "sin_cargar"
                  ? "Cargar resultado"
                  : confirmarResultado
                    ? "No, fue otro resultado"
                    : "Corregir lo que cargamos"}
              </SubmitButton>
            </ActionForm>
          )}

          {isAdmin && puedeCortar(d) && (
            <ActionForm action={cortarResultadoDesafio} className="flex flex-col gap-1">
              {ocultos}
              <ConfirmSubmitButton
                confirmMessage={`¿Cortar sin acuerdo? El partido queda sin verificar: cuenta para cada grupo con su resultado, pero no para el historial contra ${d.rival_nombre}.`}
                confirmLabel="Cortar"
                className={buttonClass("ghost", "sm", "self-start !px-0 !text-danger-400")}
              >
                No nos ponemos de acuerdo
              </ConfirmSubmitButton>
            </ActionForm>
          )}

          {propuestas.length > 0 && (
            <ul className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-zinc-500">
              <li className="text-zinc-600">Lo que cargó cada uno (ustedes – {d.rival_nombre}):</li>
              {propuestas.map((p) => (
                <li key={p.id}>
                  <span className="font-semibold tabular-nums text-zinc-300">
                    {p.mios}-{p.rival}
                  </span>{" "}
                  · {p.mia ? "ustedes" : d.rival_nombre} · {ESTADO_PROPUESTA[p.estado]} · {diaDe(p.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {isAdmin && (puedeSuspender(d) || puedeReprogramar(d) || puedeCancelar(d, hoy)) && (
        <Card className="flex flex-col gap-3 p-4">
          {puedeReprogramar(d) && (
            <details className="group">
              <summary className="cursor-pointer list-none text-sm font-semibold text-primary-400 hover:text-primary-300 [&::-webkit-details-marker]:hidden">
                {d.propuesta_es_mia ? "Proponer otra fecha distinta" : "Proponer otra fecha"}
              </summary>
              <ActionForm action={proponerFechaDesafio} className="mt-3 flex flex-col gap-3">
                {ocultos}
                <div className="flex gap-3">
                  <Label className="flex-1">
                    Fecha
                    <Input type="date" name="fecha" required min={hoy} />
                  </Label>
                  <Label className="w-28 shrink-0">
                    Hora
                    <HoraSelect defaultValue={d.hora?.slice(0, 5) ?? ""} />
                  </Label>
                </div>
                <Label>
                  Lugar
                  <Input type="text" name="lugar" required maxLength={100} defaultValue={d.lugar} />
                </Label>
                <p className="text-xs text-zinc-500">
                  La fecha cambia cuando {d.rival_nombre} la acepte (o sola en 3 días si no responde).
                </p>
                <SubmitButton size="sm" pendingText="Mandando…" className="self-start">
                  Proponer fecha
                </SubmitButton>
              </ActionForm>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            {puedeSuspender(d) && (
              <ActionForm action={suspenderDesafio} className="flex flex-col gap-1">
                {ocultos}
                <ConfirmSubmitButton
                  confirmMessage={`¿Suspender el partido contra ${d.rival_nombre}? Se avisa a los convocados de los dos grupos. Después pueden proponer otra fecha.`}
                  confirmLabel="Suspender"
                  className={buttonClass("secondary", "sm")}
                >
                  Suspender partido
                </ConfirmSubmitButton>
              </ActionForm>
            )}
            {puedeCancelar(d, hoy) && (
              <CancelarDesafio desafioId={d.id} grupoId={grupoId} rival={d.rival_nombre} estado={d.estado} />
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
