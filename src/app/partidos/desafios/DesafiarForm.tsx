"use client";

import { useState, useTransition } from "react";
import { buscarGrupoParaDesafiar, crearDesafio } from "@/lib/actions/desafios";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import GrupoLogo from "@/components/ui/GrupoLogo";
import { Input, Label } from "@/components/ui/Input";
import HoraSelect from "@/components/HoraSelect";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";

/**
 * Desafiar a otro grupo en dos pasos: primero se pega el código y se ve a
 * qué grupo corresponde (nombre y escudo), después se completa cuándo y
 * dónde y se manda.
 */
export default function DesafiarForm({ hoy }: { hoy: string }) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [rival, setRival] = useState<{
    nombre: string;
    logoUrl: string | null;
    jugados: number;
    sinVerificar: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, startBuscar] = useTransition();

  function buscar() {
    setError(null);
    startBuscar(async () => {
      const res = await buscarGrupoParaDesafiar(codigo);
      if (res.error) setError(res.error);
      else if (res.grupo) setRival(res.grupo);
    });
  }

  function cerrar() {
    setAbierto(false);
    setCodigo("");
    setRival(null);
    setError(null);
  }

  if (!abierto) {
    return (
      <Button type="button" onClick={() => setAbierto(true)} className="w-full">
        Desafiar a un grupo
      </Button>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-bold text-white">Desafiar a un grupo</h2>
        <button type="button" onClick={cerrar} className="text-xs font-semibold text-zinc-400 hover:text-white">
          Cancelar
        </button>
      </div>

      {!rival ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            buscar();
          }}
        >
          <Label>
            Link o código de desafío del otro grupo
            <Input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
              autoComplete="off"
              placeholder="Te lo pasa un admin del otro grupo"
            />
          </Label>
          {error && <p className="text-sm text-danger-400">{error}</p>}
          <Button type="submit" disabled={buscando} className="self-start">
            {buscando ? "Buscando…" : "Buscar"}
          </Button>
        </form>
      ) : (
        <ActionForm action={crearDesafio} className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-white/5 px-3.5 py-2.5">
            <GrupoLogo src={rival.logoUrl} nombre={rival.nombre} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{rival.nombre}</p>
              <p className="truncate text-xs text-zinc-500">
                {rival.jugados === 0
                  ? "Todavía no jugó desafíos"
                  : `${rival.jugados} ${rival.jugados === 1 ? "desafío jugado" : "desafíos jugados"} · ${rival.sinVerificar} sin verificar`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRival(null)}
              className="shrink-0 text-xs font-semibold text-primary-400 hover:text-primary-300"
            >
              Cambiar
            </button>
          </div>
          <input type="hidden" name="codigo" value={codigo} />
          <div className="flex gap-3">
            <Label className="flex-1">
              Fecha
              <Input type="date" name="fecha" required min={hoy} />
            </Label>
            <Label className="w-28 shrink-0">
              Hora
              <HoraSelect />
            </Label>
          </div>
          <Label>
            Lugar
            <Input type="text" name="lugar" required maxLength={100} />
          </Label>
          <p className="text-xs text-zinc-500">
            Le llega a los admins de {rival.nombre}. Si aceptan, el partido aparece en Partidos de los
            dos grupos y cada uno arma su convocatoria.
          </p>
          <SubmitButton pendingText="Enviando…" className="self-start">
            Mandar desafío
          </SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}
