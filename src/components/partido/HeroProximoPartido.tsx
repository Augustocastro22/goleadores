import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { IconChevronRight } from "@/components/icons";
import type { Profile, Respuesta } from "@/lib/types";
import CuentaRegresiva from "./CuentaRegresiva";

export interface ConvocadoHero {
  jugadorId: string;
  respuesta: Respuesta;
  perfil: Pick<Profile, "apodo" | "foto_url">;
}

/**
 * Arriba de la lista de partidos: el próximo, en grande. Cuánto falta (en
 * vivo), cuántos confirmaron (un aro que se llena), las caras de los que van
 * y qué respondiste vos. El día del partido se enciende: "Hoy · Match day".
 */
export default function HeroProximoPartido({
  href,
  titulo,
  fecha,
  hora,
  diaTexto,
  lugar,
  convocados,
  miId,
  conConfirmacion,
  esHoy,
}: {
  href: string;
  titulo: string;
  fecha: string;
  hora: string | null;
  /** "sáb 21/11" */
  diaTexto: string;
  lugar: string;
  convocados: ConvocadoHero[];
  miId: string;
  conConfirmacion: boolean;
  esHoy: boolean;
}) {
  const juegan = conConfirmacion ? convocados.filter((c) => c.respuesta === "juega") : convocados;
  const total = convocados.length;
  const proporcion = total > 0 ? juegan.length / total : 0;
  const yo = convocados.find((c) => c.jugadorId === miId);
  const caras = juegan.slice(0, 6);

  const estado = !yo
    ? { texto: "No estás convocado", clase: "text-zinc-500" }
    : !conConfirmacion || yo.respuesta === "juega"
      ? { texto: "✓ Vas a jugar", clase: "text-primary-400" }
      : yo.respuesta === "no_juega"
        ? { texto: "Dijiste que no vas", clase: "text-danger-400" }
        : { texto: "Confirmá si jugás →", clase: "text-gold-400 font-semibold" };

  return (
    <Link
      href={href}
      transitionTypes={["adelante"]}
      className={`presionable entrada relative mb-5 block overflow-hidden rounded-3xl border p-5 ${
        esHoy ? "match-day border-primary-400/50" : "border-border"
      }`}
      style={{
        background:
          "linear-gradient(160deg, rgba(16,185,129,0.16), rgba(19,20,24,0.92) 55%), repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 28px, transparent 28px 56px), #131418",
      }}
    >
      {/* Media cancha de fondo, apenas marcada. */}
      <span aria-hidden className="pointer-events-none absolute -right-16 -bottom-16 h-56 w-56 rounded-full border-2 border-white/[0.06]" />
      <span aria-hidden className="pointer-events-none absolute top-0 right-24 bottom-0 w-[2px] bg-white/[0.05]" />

      <div className="relative flex items-center justify-between gap-2">
        {esHoy ? (
          <span className="flex items-center gap-2 rounded-full bg-primary-500/15 px-2.5 py-1 text-[11px] font-bold tracking-widest text-primary-400 uppercase">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-400" />
            </span>
            Hoy · Match day
          </span>
        ) : (
          <span className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">Próximo partido</span>
        )}
        <span className="text-xs font-medium text-zinc-400 capitalize">
          {diaTexto}
          {hora ? ` · ${hora.slice(0, 5)}` : ""}
        </span>
      </div>

      <p className="relative mt-3 text-2xl leading-tight font-extrabold tracking-tight text-white">{titulo}</p>
      <p className="relative mt-0.5 truncate text-sm text-zinc-400">{lugar}</p>

      <div className="relative mt-4 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Faltan</span>
          <CuentaRegresiva fecha={fecha} hora={hora} />
        </div>
        {/* Cuántos van: el aro se llena al entrar. */}
        <div
          className="aro relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
          style={{ "--objetivo": proporcion } as React.CSSProperties}
          aria-label={`${juegan.length} de ${total} confirmados`}
        >
          <span className="flex h-[52px] w-[52px] flex-col items-center justify-center rounded-full bg-[#15161b]">
            <span className="text-base leading-none font-extrabold tabular-nums text-white">
              {juegan.length}
              <span className="text-xs font-semibold text-zinc-500">/{total}</span>
            </span>
            <span className="mt-0.5 text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">van</span>
          </span>
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {caras.map((c, i) => (
              <span key={c.jugadorId} className="entrada rounded-full ring-2 ring-[#15161b]" style={{ "--i": i + 3 } as React.CSSProperties}>
                <Avatar src={c.perfil.foto_url} alt={c.perfil.apodo} size={28} />
              </span>
            ))}
          </div>
          {juegan.length > caras.length && (
            <span className="ml-2 text-xs font-semibold text-zinc-400">+{juegan.length - caras.length}</span>
          )}
          {juegan.length === 0 && <span className="text-xs text-zinc-500">Todavía no confirmó nadie</span>}
        </div>
        <span className={`flex items-center gap-1 text-sm ${estado.clase}`}>
          {estado.texto}
          <IconChevronRight className="h-4 w-4 opacity-60" />
        </span>
      </div>
    </Link>
  );
}
