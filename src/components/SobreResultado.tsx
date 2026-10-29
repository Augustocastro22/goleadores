"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Card from "@/components/ui/Card";

export interface GanadorSobre {
  id: string;
  apodo: string;
  nombre: string;
  apellido: string;
  fotoUrl: string | null;
  votos?: number;
}

/** Colores de cada sobre: dorado para el mejor, rojo para el peor (clases completas para Tailwind). */
const TEMAS = {
  mvp: {
    etiqueta: "MVP",
    sobre: "from-gold-400/40 via-gold-500/20 to-surface-2 border-gold-400/50",
    solapa: "from-gold-400/70 to-gold-500/40",
    sello: "bg-gold-400 text-black",
    luz: "bg-gold-400",
    carta: "from-gold-400/35 via-gold-500/10 to-surface border-gold-400/50",
    anillo: "ring-2 ring-gold-400/70",
    texto: "text-gold-400",
  },
  peor: {
    etiqueta: "PEOR",
    sobre: "from-danger-500/40 via-danger-500/15 to-surface-2 border-danger-400/50",
    solapa: "from-danger-400/70 to-danger-500/40",
    sello: "bg-danger-500 text-white",
    luz: "bg-danger-500",
    carta: "from-danger-500/35 via-danger-500/10 to-surface border-danger-400/50",
    anillo: "ring-2 ring-danger-400/70",
    texto: "text-danger-400",
  },
} as const;
type Tema = (typeof TEMAS)[keyof typeof TEMAS];

const EVENTO = "sobre-abierto";
const clave = (id: string) => `sobre:${id}`;

export function yaAbierto(id: string): boolean {
  try {
    return localStorage.getItem(clave(id)) === "1";
  } catch {
    return false;
  }
}

function marcarAbierto(id: string) {
  try {
    localStorage.setItem(clave(id), "1");
  } catch {
    // sin almacenamiento (ventana privada): se abre igual, solo no se acuerda
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

/** Si ya abrió ese sobre en este dispositivo (null en el servidor, donde no se sabe). */
export function useSobreAbierto(id: string): boolean | null {
  return useSyncExternalStore(
    suscribir,
    () => yaAbierto(id),
    () => null
  );
}

/** Cuántas veces se muestra a cada votado antes de clavarse en el ganador (con más votados gira más rápido). */
const VECES_POR_JUGADOR = 2;
/** Aunque haya muy pocos votados, no menos pasos que estos (si no, no parece una ruleta). */
const PASOS_MINIMOS = 6;

/**
 * Las caras que pasan por la ruleta y cuánto espera cada una. Cada votado
 * aparece más o menos las mismas veces, nunca dos seguidas la misma cara, y la
 * última es siempre el ganador. Tarda `duracion` ms en total sean pocos o
 * muchos: con pocos votados cada cara se queda más, con muchos pasan rápido.
 * Arranca veloz y frena de a poco.
 */
function armarRuleta(pool: GanadorSobre[], ganador: GanadorSobre, duracion: number) {
  const votados = pool.some((c) => c.id === ganador.id) ? pool : [...pool, ganador];
  const pasos = Math.max(PASOS_MINIMOS, votados.length * VECES_POR_JUGADOR);
  const caras: GanadorSobre[] = [];
  const veces = new Map<string, number>();
  let anterior: GanadorSobre | null = null;
  for (let k = 0; k < pasos - 1; k++) {
    // El anteúltimo no es el ganador: así el último cambio es el que lo clava.
    let opciones = votados.filter((c) => c.id !== anterior?.id && !(k === pasos - 2 && c.id === ganador.id));
    if (opciones.length === 0) opciones = votados.filter((c) => c.id !== anterior?.id);
    if (opciones.length === 0) opciones = votados;
    // Entre los posibles, el que menos veces salió: así salen todos parejo.
    const menos = Math.min(...opciones.map((c) => veces.get(c.id) ?? 0));
    const candidatos = opciones.filter((c) => (veces.get(c.id) ?? 0) === menos);
    const elegida = candidatos[Math.floor(Math.random() * candidatos.length)];
    veces.set(elegida.id, (veces.get(elegida.id) ?? 0) + 1);
    caras.push(elegida);
    anterior = elegida;
  }
  caras.push(ganador);
  const pesos = caras.map((_, k) => 1 + 9 * (k / (pasos - 1)) ** 2);
  const suma = pesos.reduce((a, b) => a + b, 0);
  return { caras, demoras: pesos.map((p) => (p / suma) * duracion) };
}

function FotoCarta({ g }: { g: GanadorSobre }) {
  if (g.fotoUrl) {
    return (
      <Image
        src={g.fotoUrl}
        alt={g.apodo}
        width={240}
        height={240}
        unoptimized
        draggable={false}
        className="aspect-square w-full rounded-xl object-cover ring-1 ring-white/10 select-none"
      />
    );
  }
  return (
    <span className="flex aspect-square w-full items-center justify-center rounded-xl bg-gradient-to-br from-primary-400/30 to-primary-600/30 text-5xl font-extrabold text-primary-300 ring-1 ring-white/10">
      {g.apodo[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/**
 * Una carta del sobre. Si `girar`, pasa por las caras de los que recibieron
 * votos hasta clavarse en el ganador; si no (ya lo había visto) sale directo.
 */
function Carta({
  ganador,
  pool,
  tema,
  ancho,
  rotacion,
  retraso,
  duracion,
  girar,
  revelado,
  onFin,
}: {
  ganador: GanadorSobre;
  pool: GanadorSobre[];
  tema: Tema;
  ancho: string;
  rotacion: number;
  retraso: number;
  duracion: number;
  girar: boolean;
  /** El sobre ya se dio por abierto (por ejemplo, al saltar): se muestra el ganador ya. */
  revelado: boolean;
  onFin: () => void;
}) {
  const [cara, setCara] = useState<GanadorSobre>(pool[0] ?? ganador);
  const [hecho, setHecho] = useState(!girar);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (!girar) return;
    const { caras, demoras } = armarRuleta(pool.length > 0 ? pool : [ganador], ganador, duracion);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = retraso;
    caras.forEach((c, k) => {
      t += demoras[k];
      timers.push(
        setTimeout(() => {
          setCara(c);
          if (k === caras.length - 1) {
            setHecho(true);
            setPop(true);
            onFin();
          }
        }, t)
      );
    });
    return () => timers.forEach(clearTimeout);
    // Corre una sola vez, al salir la carta: lo que cambie después no reinicia la ruleta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const final = revelado || hecho;
  const g = final ? ganador : cara;

  return (
    <div className="carta-sale" style={{ width: ancho, rotate: `${rotacion}deg` }}>
      <div
        className={`${pop ? "carta-pop" : ""} flex flex-col items-center rounded-2xl border bg-gradient-to-b p-2 text-center shadow-lg shadow-black/40 transition-shadow ${tema.carta} ${
          final ? tema.anillo : ""
        }`}
      >
        <span className={`mb-1 text-[10px] font-extrabold tracking-widest ${tema.texto}`}>{tema.etiqueta}</span>
        <FotoCarta g={g} />
        <p className="mt-2 w-full truncate text-sm font-extrabold text-white">{g.apodo}</p>
        <p className="w-full truncate text-[11px] text-zinc-400">{final ? `${g.nombre} ${g.apellido}` : " "}</p>
        <p className={`mt-1 text-xs font-bold tabular-nums ${tema.texto}`}>
          {final && ganador.votos != null ? `${ganador.votos} ${ganador.votos === 1 ? "voto" : "votos"}` : " "}
        </p>
      </div>
    </div>
  );
}

type Fase = "cerrado" | "abriendo" | "girando" | "abierto";

/**
 * El resultado de una votación (mejor o peor jugador) escondido en un sobre,
 * como las cartas de FIFA: se toca, el sobre vibra y tira luz, y la carta pasa
 * por las caras de los que recibieron votos hasta clavarse en el ganador (si
 * empataron, una carta por cada uno, que frenan de a una). Se acuerda en este
 * dispositivo si ya se abrió y entonces muestra directo las cartas; `children`
 * (la tabla de votos) aparece recién con el sobre abierto.
 */
export default function SobreResultado({
  id,
  titulo,
  peor = false,
  ganadores,
  candidatos,
  alAbrir,
  children,
}: {
  /** Se llama cuando termina de abrirse (para mostrar el que sigue). */
  alAbrir?: () => void;
  /** Identifica el sobre para acordarse de que ya se abrió (p. ej. `${partidoId}-mvp`). */
  id: string;
  titulo: string;
  peor?: boolean;
  ganadores: GanadorSobre[];
  /** Las caras que pasan por la ruleta: todos los que recibieron votos. */
  candidatos: GanadorSobre[];
  children?: ReactNode;
}) {
  const tema = peor ? TEMAS.peor : TEMAS.mvp;
  // null en el servidor: todavía no se sabe si ya lo abrió en este dispositivo.
  const visto = useSobreAbierto(id);
  const [fase, setFase] = useState<Fase | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const terminadas = useRef(0);

  const actual: Fase = fase ?? (visto ? "abierto" : "cerrado");

  function terminar() {
    clearTimeout(timer.current);
    setFase("abierto");
    marcarAbierto(id);
    alAbrir?.();
  }

  function abrir() {
    if (actual !== "cerrado") return;
    terminadas.current = 0;
    setFase("abriendo");
    timer.current = setTimeout(() => setFase("girando"), 1500);
  }

  if (visto === null) {
    return <Card className="min-h-64 p-4" aria-hidden />;
  }

  const n = ganadores.length;
  const ancho = n === 1 ? "11rem" : n === 2 ? "8.5rem" : "6rem";
  const giros = n === 1 ? [0] : n === 2 ? [-3, 3] : [-4, 0, 4];
  const sobreCerrado = actual === "cerrado" || actual === "abriendo";

  return (
    <Card className="flex flex-col items-center gap-4 p-4">
      <p className="self-start text-sm font-semibold text-white">{titulo}</p>

      {sobreCerrado ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <div style={{ perspective: 700 }}>
            <button
              type="button"
              onClick={abrir}
              disabled={actual === "abriendo"}
              aria-label={`Abrir el sobre: ${titulo}`}
              className={`relative block h-44 w-56 cursor-pointer outline-none disabled:cursor-default ${
                actual === "abriendo" ? "sobre-vibra" : "sobre-flota"
              }`}
            >
              {/* Luz que sale del sobre al abrirse. */}
              {actual === "abriendo" && (
                <span
                  className={`sobre-luz pointer-events-none absolute top-1/3 left-1/2 -ml-16 h-32 w-32 rounded-full opacity-0 blur-2xl ${tema.luz}`}
                />
              )}
              <span
                className={`absolute inset-0 overflow-hidden rounded-2xl border bg-gradient-to-br shadow-lg shadow-black/40 ${tema.sobre}`}
              >
                <span
                  className="absolute inset-0 bg-white/5"
                  style={{ clipPath: "polygon(0 100%, 50% 42%, 100% 100%)" }}
                />
              </span>
              <span
                className={`absolute inset-x-0 top-0 h-[58%] origin-top rounded-t-2xl bg-gradient-to-b transition-transform duration-700 ease-in ${tema.solapa}`}
                style={{
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  transform: actual === "abriendo" ? "rotateX(180deg)" : "none",
                  opacity: actual === "abriendo" ? 0.4 : 1,
                }}
              />
              <span
                className={`absolute top-[46%] left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-extrabold tracking-wide shadow-md transition-opacity duration-300 ${tema.sello} ${
                  actual === "abriendo" ? "opacity-0" : ""
                }`}
              >
                {tema.etiqueta}
              </span>
            </button>
          </div>
          {actual === "cerrado" ? (
            <p className={`text-xs font-semibold tracking-wide uppercase ${tema.texto}`}>Tocá para abrir</p>
          ) : (
            <button type="button" onClick={terminar} className="text-xs text-zinc-500 hover:text-white">
              Saltar
            </button>
          )}
        </div>
      ) : (
        <>
          {actual === "abierto" && n > 1 && (
            <p className={`text-xs font-semibold tracking-wide uppercase ${tema.texto}`}>Empate entre {n}</p>
          )}
          <div className="flex justify-center gap-2" style={{ perspective: 800 }}>
            {ganadores.map((g, i) => (
              <Carta
                key={g.id}
                ganador={g}
                pool={candidatos}
                tema={tema}
                ancho={ancho}
                rotacion={giros[i] ?? 0}
                // Frenan de a una, de izquierda a derecha.
                retraso={i * 700}
                duracion={2300}
                girar={actual === "girando"}
                revelado={actual === "abierto"}
                onFin={() => {
                  terminadas.current += 1;
                  if (terminadas.current === n) timer.current = setTimeout(terminar, 900);
                }}
              />
            ))}
          </div>
          {actual === "girando" ? (
            <button type="button" onClick={terminar} className="text-xs text-zinc-500 hover:text-white">
              Saltar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setFase("cerrado")}
              className="text-xs text-zinc-500 transition hover:text-white"
            >
              Ver de nuevo
            </button>
          )}
          {actual === "abierto" && children && <div className="w-full">{children}</div>}
        </>
      )}
    </Card>
  );
}
