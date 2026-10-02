import type { Metadata } from "next";
import Link from "next/link";
import { getContexto } from "@/lib/grupo";
import Card from "@/components/ui/Card";
import ContactoForm from "./ContactoForm";

export const metadata: Metadata = {
  title: "Contacto · Goleadores",
};

export default async function ContactoPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const { supabase, user } = await getContexto();

  // Con sesión, se completa nombre y email para no tener que escribirlos.
  let nombre = "";
  if (user) {
    const { data } = await supabase.from("profiles").select("nombre, apellido").eq("id", user.id).single();
    if (data) nombre = `${data.nombre} ${data.apellido}`.trim();
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-white">Contacto</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Para consultas o pedidos sobre tus datos. Si todavía podés entrar, también podés borrar tu
        cuenta desde{" "}
        <Link href="/perfil" className="text-zinc-300 underline hover:text-white">
          Mi perfil
        </Link>
        .
      </p>
      <Card className="p-6">
        <ContactoForm nombreInicial={nombre} emailInicial={user?.email ?? ""} motivoInicial={motivo ?? ""} />
      </Card>
    </div>
  );
}
