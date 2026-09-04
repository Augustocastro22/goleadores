import Link from "next/link";
import { signup } from "@/lib/actions/auth";
import Card from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">⚽</span>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Crear cuenta</h1>
        <p className="text-sm text-zinc-500">Sumate para votar y ver tus estadísticas</p>
      </div>

      <Card className="w-full max-w-sm p-6">
        {error && (
          <p className="mb-4 rounded-xl border border-danger-500/20 bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-400">
            {error}
          </p>
        )}
        <form action={signup} className="flex flex-col gap-4">
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
          <Button type="submit" className="mt-2 w-full">
            Crear cuenta
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-sm text-zinc-500">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-semibold text-primary-400 hover:text-primary-300">
          Iniciá sesión
        </Link>
      </p>
    </div>
  );
}
