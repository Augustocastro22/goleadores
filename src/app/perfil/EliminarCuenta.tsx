"use client";

import { useState } from "react";
import Link from "next/link";
import { eliminarCuenta } from "@/lib/actions/cuenta";
import { PALABRA_CONFIRMACION } from "@/lib/cuenta";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import SubmitButton from "@/components/SubmitButton";
import ActionForm from "@/components/ActionForm";

export default function EliminarCuenta() {
  const [abierto, setAbierto] = useState(false);

  return (
    <Card className="flex flex-col gap-3 p-6">
      <div>
        <p className="font-semibold text-white">Eliminar mi cuenta</p>
        <p className="mt-1 text-xs text-zinc-500">
          Se borran tu email, tu contraseña, tu nombre, tu foto, tu disponibilidad y tus
          notificaciones, y salís de todos tus grupos. Tus goles y votos en partidos ya jugados
          quedan como &quot;Jugador eliminado&quot;, para no cambiar los resultados del resto. Más
          detalle en la{" "}
          <Link href="/privacidad" className="text-zinc-400 underline hover:text-white">
            política de privacidad
          </Link>
          .
        </p>
      </div>

      {!abierto ? (
        <Button type="button" variant="danger" size="sm" className="self-start" onClick={() => setAbierto(true)}>
          Eliminar mi cuenta
        </Button>
      ) : (
        <ActionForm action={eliminarCuenta} className="flex flex-col gap-3 border-t border-border pt-3">
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            <span>
              Esto no se puede deshacer. Para confirmar, escribí{" "}
              <span className="font-bold text-danger-400">{PALABRA_CONFIRMACION}</span>:
            </span>
            <Input type="text" name="confirmacion" required autoComplete="off" autoCapitalize="characters" />
          </label>
          <div className="flex gap-2">
            <SubmitButton pendingText="Eliminando..." variant="danger" size="sm">
              Eliminar definitivamente
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </ActionForm>
      )}
    </Card>
  );
}
