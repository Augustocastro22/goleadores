import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { INSTAGRAM_URL } from "@/lib/redes";

/*
 * Landing: lo que ve en goleadores.ar quien todavía no tiene cuenta (con
 * sesión, el proxy manda directo a /partidos; ver src/lib/supabase/middleware.ts).
 * Las capturas de public/landing salen del grupo de prueba.
 */

export const metadata: Metadata = {
  title: "Goleadores · La app para organizar tu equipo o grupo de fútbol",
};

const FUNCIONES = [
  {
    imagen: "convocatoria",
    titulo: "¿Quién juega?",
    texto:
      "Armás el partido y a cada uno le llega un aviso para confirmar con un toque. Ves al instante quiénes van, quiénes no y quiénes faltan responder.",
  },
  {
    imagen: "goles",
    titulo: "Goles y resultados",
    texto: "Cargás quién hizo cada gol, partido por partido, contra quien sea y en la cancha que sea.",
  },
  {
    imagen: "mvp",
    titulo: "El MVP de cada partido",
    texto: "Después del partido votan los que jugaron, y se arma el ranking del grupo.",
  },
  {
    imagen: "stats",
    titulo: "Las stats de cada jugador",
    texto: "Goles, partidos, MVP, logros y rachas: cada uno tiene su perfil.",
  },
  {
    imagen: "desafios",
    titulo: "Desafíos entre grupos",
    texto: "Desafiá a otro grupo que use Goleadores. El resultado lo acuerdan los dos y queda el récord.",
  },
];

const PASOS = [
  "Creás tu cuenta y tu grupo, con su nombre y su escudo.",
  "Mandás el link de invitación por WhatsApp.",
  "Cargás el primer partido y listo.",
];

/** Una captura de la app dentro de un celular, que se desvanece abajo. */
function Celular({ imagen, prioridad = false }: { imagen: string; prioridad?: boolean }) {
  return (
    <div className="relative mx-auto w-full max-w-[260px] rounded-[2.2rem] bg-black p-2 shadow-2xl shadow-black/60 ring-1 ring-white/15">
      <Image
        src={`/landing/${imagen}.webp`}
        alt=""
        width={780}
        height={1200}
        priority={prioridad}
        sizes="260px"
        className="rounded-[1.8rem]"
      />
      <div className="pointer-events-none absolute inset-x-2 bottom-2 h-24 rounded-b-[1.8rem] bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

function BotonesEntrar() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Link href="/signup" className={buttonClass("primary", "md", "w-full py-3 text-base")}>
        Armá tu grupo o sumate a uno
      </Link>
      <Link href="/login" className={buttonClass("ghost", "md", "w-full")}>
        Ya tengo cuenta
      </Link>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="flex flex-col items-center gap-20 pb-6">
      {/* Arriba de todo: qué es, gratis y el botón. */}
      <section className="flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-2.5">
          <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-xl" priority />
          <span className="text-xl font-extrabold tracking-tight text-white">Goleadores</span>
        </div>
        <h1 className="max-w-xl text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-5xl">
          La app para organizar tu <span className="text-primary-400">equipo o grupo de fútbol</span>
        </h1>
        <p className="max-w-md text-lg text-zinc-400">
          Convocatoria, goles, MVP y estadísticas de cada jugador.{" "}
          <span className="font-semibold text-zinc-200">Gratis y sin descargar nada.</span>
        </p>
        <BotonesEntrar />
        <p className="text-sm text-zinc-500">Fútbol 5, 7, 8, 9 u 11 · Entre amigos o contra otros equipos</p>
        <div className="mt-4 w-full">
          <Celular imagen="partidos" prioridad />
        </div>
      </section>

      {/* Qué hace, una función por bloque. */}
      <section className="flex w-full flex-col gap-16">
        {FUNCIONES.map((f, i) => (
          <div
            key={f.imagen}
            className={`flex flex-col items-center gap-6 sm:flex-row sm:gap-10 ${i % 2 ? "sm:flex-row-reverse" : ""}`}
          >
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-extrabold tracking-tight text-white">{f.titulo}</h2>
              <p className="mt-2 text-base text-zinc-400">{f.texto}</p>
            </div>
            <div className="w-full flex-1">
              <Celular imagen={f.imagen} />
            </div>
          </div>
        ))}
      </section>

      {/* Cómo empezar */}
      <section className="w-full max-w-md">
        <h2 className="mb-5 text-center text-2xl font-extrabold tracking-tight text-white">Empezá en un minuto</h2>
        <ol className="flex flex-col gap-3">
          {PASOS.map((paso, i) => (
            <li key={paso} className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/15 font-bold text-primary-400">
                {i + 1}
              </span>
              <span className="text-zinc-200">{paso}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Cierre */}
      <section className="flex w-full flex-col items-center gap-5 rounded-3xl border border-primary-500/20 bg-primary-500/5 px-6 py-10 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white">Armá tu grupo gratis</h2>
        <p className="max-w-sm text-zinc-400">Sumá a todo el equipo con un link y empezá a llevar los números de cada partido.</p>
        <BotonesEntrar />
      </section>

      <footer className="flex gap-4 text-xs text-zinc-600">
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400">
          Instagram
        </a>
        <Link href="/privacidad" className="hover:text-zinc-400">
          Política de privacidad
        </Link>
        <Link href="/contacto" className="hover:text-zinc-400">
          Contacto
        </Link>
      </footer>
    </div>
  );
}
