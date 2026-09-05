import Link from "next/link";
import { login } from "@/lib/actions/auth";
import Card from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">⚽</span>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Goleadores</h1>
        <p className="text-sm text-zinc-500">Entrá para ver partidos y estadísticas</p>
      </div>

      <Card className="w-full max-w-sm p-6">
        {error && (
          <p className="mb-4 rounded-xl border border-danger-500/20 bg-danger-500/10 px-3.5 py-2.5 text-sm text-danger-400">
            {error}
          </p>
        )}
        <form action={login} className="flex flex-col gap-4">
          <Label>
            Email
            <Input type="email" name="email" required />
          </Label>
          <Label>
            Contraseña
            <Input type="password" name="password" required minLength={6} />
          </Label>
          <Button type="submit" className="mt-2 w-full">
            Entrar
          </Button>
        </form>
        <Link
          href="/recuperar"
          className="mt-3 block text-center text-sm text-zinc-500 hover:text-zinc-300"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </Card>

      <p className="mt-6 text-sm text-zinc-500">
        ¿No tenés cuenta?{" "}
        <Link href="/signup" className="font-semibold text-primary-400 hover:text-primary-300">
          Registrate
        </Link>
      </p>
    </div>
  );
}
