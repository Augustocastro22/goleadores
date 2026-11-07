import { ViewTransition } from "react";

/**
 * Esqueletos de carga (los loading.tsx de cada sección): la forma de la
 * pantalla con un brillo que pasa, para que al tocar algo la respuesta sea
 * inmediata. Al llegar el contenido, el esqueleto se va rápido
 * (esqueleto-sale en globals.css).
 */
export function Esqueleto({ className = "" }: { className?: string }) {
  // Redondeado chico por defecto, salvo que se pida otro (avatar redondo, tarjeta).
  return <div aria-hidden className={`esqueleto ${/\brounded-/.test(className) ? "" : "rounded-lg"} ${className}`} />;
}

function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition exit="esqueleto-sale" default="none">
      <div role="status" aria-label="Cargando" className="flex flex-col gap-4">
        {children}
      </div>
    </ViewTransition>
  );
}

function Tarjeta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-surface/80 ${className}`}>{children}</div>;
}

/** Título de la pantalla y, a la derecha, botones. */
function Encabezado({ botones = 0 }: { botones?: number }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <Esqueleto className="h-7 w-36" />
      <div className="flex gap-2">
        {Array.from({ length: botones }, (_, i) => (
          <Esqueleto key={i} className="h-8 w-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Una fila de lista: avatar o fecha, dos líneas de texto y algo a la derecha. */
function Fila({ cuadrado = false }: { cuadrado?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Esqueleto className={cuadrado ? "h-12 w-14 rounded-xl" : "h-8 w-8 rounded-full"} />
      <div className="flex flex-1 flex-col gap-2">
        <Esqueleto className="h-3.5 w-2/5" />
        <Esqueleto className="h-3 w-3/5" />
      </div>
      <Esqueleto className="h-5 w-10" />
    </div>
  );
}

export function EsqueletoLista({ filas = 6, cuadrado = false }: { filas?: number; cuadrado?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: filas }, (_, i) => (
        <Tarjeta key={i}>
          <Fila cuadrado={cuadrado} />
        </Tarjeta>
      ))}
    </div>
  );
}

export function EsqueletoPartidos() {
  return (
    <Pantalla>
      <Encabezado botones={2} />
      <Tarjeta className="grid grid-cols-3 gap-2 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Esqueleto className="h-7 w-8" />
            <Esqueleto className="h-3 w-14" />
          </div>
        ))}
      </Tarjeta>
      <EsqueletoLista cuadrado />
    </Pantalla>
  );
}

export function EsqueletoPartido() {
  return (
    <Pantalla>
      <Esqueleto className="h-5 w-24" />
      <Tarjeta className="flex flex-col items-center gap-4 p-6">
        <div className="flex w-full justify-between">
          <Esqueleto className="h-3 w-28" />
          <Esqueleto className="h-3 w-20" />
        </div>
        <div className="flex w-full items-center justify-center gap-4">
          <Esqueleto className="h-4 w-20" />
          <Esqueleto className="h-14 w-32 rounded-2xl" />
          <Esqueleto className="h-4 w-20" />
        </div>
      </Tarjeta>
      <Esqueleto className="mt-2 h-5 w-32" />
      <Tarjeta className="divide-y divide-border">
        {[0, 1, 2, 3, 4].map((i) => (
          <Fila key={i} />
        ))}
      </Tarjeta>
    </Pantalla>
  );
}

export function EsqueletoJugadores() {
  return (
    <Pantalla>
      <Encabezado />
      <Esqueleto className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Tarjeta key={i} className="flex flex-col items-center gap-3 p-5">
            <Esqueleto className="h-[72px] w-[72px] rounded-full" />
            <Esqueleto className="h-3.5 w-3/4" />
            <Esqueleto className="h-3 w-1/2" />
          </Tarjeta>
        ))}
      </div>
    </Pantalla>
  );
}

export function EsqueletoPerfil() {
  return (
    <Pantalla>
      <Esqueleto className="h-5 w-24" />
      <Tarjeta className="flex flex-col items-center gap-3 p-6">
        <Esqueleto className="h-24 w-24 rounded-full" />
        <Esqueleto className="h-5 w-40" />
        <Esqueleto className="h-3.5 w-24" />
        <div className="mt-2 grid w-full grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Esqueleto className="h-6 w-8" />
              <Esqueleto className="h-3 w-12" />
            </div>
          ))}
        </div>
      </Tarjeta>
      <EsqueletoLista filas={4} />
    </Pantalla>
  );
}

export function EsqueletoEstadisticas() {
  return (
    <Pantalla>
      <Encabezado />
      <Esqueleto className="h-5 w-28" />
      <Tarjeta className="divide-y divide-border">
        {Array.from({ length: 6 }, (_, i) => (
          <Fila key={i} />
        ))}
      </Tarjeta>
      <Esqueleto className="mt-2 h-5 w-40" />
      <Tarjeta className="flex items-end justify-center gap-3 p-6">
        <Esqueleto className="h-20 w-20 rounded-xl" />
        <Esqueleto className="h-28 w-20 rounded-xl" />
        <Esqueleto className="h-16 w-20 rounded-xl" />
      </Tarjeta>
    </Pantalla>
  );
}

export function EsqueletoCancha() {
  return (
    <Pantalla>
      <Esqueleto className="h-5 w-24" />
      <Esqueleto className="h-7 w-40" />
      <Tarjeta className="flex gap-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Esqueleto key={i} className="h-8 w-20 rounded-xl" />
        ))}
      </Tarjeta>
      <Esqueleto className="mx-auto aspect-[5/7] w-full max-w-sm rounded-2xl" />
    </Pantalla>
  );
}

export function EsqueletoSimple() {
  return (
    <Pantalla>
      <Encabezado botones={1} />
      <EsqueletoLista filas={4} />
    </Pantalla>
  );
}
