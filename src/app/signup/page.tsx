import Link from "next/link";
import { signup } from "@/lib/actions/auth";
import Card from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import BotonGoogle from "@/components/BotonGoogle";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const vieneDeInvitacion = next?.startsWith("/unirse/");
  const vieneDeDesafio = next?.startsWith("/desafiar/");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">⚽</span>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Crear cuenta</h1>
        <p className="text-sm text-zinc-500">
          {vieneDeInvitacion
            ? "Creá tu cuenta y te sumamos al grupo"
            : vieneDeDesafio
              ? "Creá tu cuenta para mandar el desafío"
              : "Sumate para votar y ver tus estadísticas"}
        </p>
      </div>

      <Card className="w-full max-w-sm p-6">
        {error && (
          <p className="mb-4 rounded-xl border border-danger-500/20 bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-400">
            {error}
          </p>
        )}
        <div className="mb-4">
          <BotonGoogle next={next} />
        </div>
        <form action={signup} className="flex flex-col gap-4">
          {next && <input type="hidden" name="next" value={next} />}
          <div className="grid grid-cols-2 gap-3">
            <Label>
              Nombre
              <Input type="text" name="nombre" required />
            </Label>
            <Label>
              Apellido
              <Input type="text" name="apellido" required />
            </Label>
          </div>
          <Label>
            Apodo
            <Input type="text" name="apodo" required />
          </Label>
          <Label>
            Email
            <Input type="email" name="email" required />
          </Label>
          <Label>
            Contraseña
            <Input type="password" name="password" required minLength={6} />
          </Label>
          <label className="flex items-start gap-2.5 text-xs text-zinc-400">
            <input
              type="checkbox"
              name="acepta_privacidad"
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500"
            />
            <span>
              Leí y acepto la{" "}
              <Link href="/privacidad" target="_blank" className="text-primary-400 underline hover:text-primary-300">
                política de privacidad
              </Link>
              .
            </span>
          </label>
          <Button type="submit" className="mt-2 w-full">
            Crear cuenta
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-sm text-zinc-500">
        ¿Ya tenés cuenta?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-primary-400 hover:text-primary-300">
          Iniciá sesión
        </Link>
      </p>
    </div>
  );
}
