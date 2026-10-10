"use client";

import { useId, useState } from "react";
import { canchaExacta, filtrarCanchas } from "@/lib/canchas";
import { Input } from "@/components/ui/Input";

/**
 * Campo de lugar con las canchas del grupo: al tocarlo se despliegan, al
 * escribir se filtran, y si es una nueva queda "+ Agregar" (la base la crea
 * al guardar el partido). Manda el texto como `name`, igual que un input.
 */
export default function CanchaInput({
  canchas,
  name = "lugar",
  defaultValue = "",
  required,
}: {
  canchas: { nombre: string }[];
  name?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const listId = useId();
  const [valor, setValor] = useState(defaultValue);
  const [abierto, setAbierto] = useState(false);
  const [marcada, setMarcada] = useState(-1);

  const opciones = filtrarCanchas(canchas, valor);
  const exacta = canchaExacta(canchas, valor);
  const nueva = valor.trim() && !exacta ? valor.trim() : null;
  // Las opciones en orden: las canchas y, al final, "+ Agregar".
  const total = opciones.length + (nueva ? 1 : 0);

  function elegir(nombre: string) {
    setValor(nombre);
    setAbierto(false);
    setMarcada(-1);
  }

  return (
    <div className="relative">
      <Input
        type="text"
        name={name}
        required={required}
        maxLength={100}
        autoComplete="off"
        role="combobox"
        aria-expanded={abierto && total > 0}
        aria-controls={listId}
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          setAbierto(true);
          setMarcada(-1);
        }}
        onFocus={() => setAbierto(true)}
        // Si escribió una que ya existe con otras mayúsculas o tildes, queda como está guardada.
        onBlur={() => {
          setAbierto(false);
          if (exacta) setValor(exacta.nombre);
        }}
        onKeyDown={(e) => {
          if (!abierto || total === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setMarcada((i) => (i + 1) % total);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setMarcada((i) => (i <= 0 ? total - 1 : i - 1));
          } else if (e.key === "Enter" && marcada >= 0) {
            e.preventDefault();
            elegir(marcada < opciones.length ? opciones[marcada].nombre : nueva!);
          } else if (e.key === "Escape") {
            setAbierto(false);
          }
        }}
      />
      {abierto && total > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {opciones.map((c, i) => (
            <li
              key={c.nombre}
              role="option"
              aria-selected={i === marcada}
              // mousedown y no click: el click llega después del blur, cuando la lista ya se cerró.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(c.nombre);
              }}
              className={`cursor-pointer px-3.5 py-2 text-sm text-zinc-200 ${i === marcada ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              {c.nombre}
            </li>
          ))}
          {nueva && (
            <li
              role="option"
              aria-selected={marcada === opciones.length}
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(nueva);
              }}
              className={`cursor-pointer px-3.5 py-2 text-sm text-primary-400 ${marcada === opciones.length ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              + Agregar “{nueva}”
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
