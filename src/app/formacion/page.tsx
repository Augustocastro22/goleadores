import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import FormacionBuilder from "./FormacionBuilder";

export default async function FormacionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jugadores } = await supabase
    .from("profiles")
    .select("*")
    .order("nombre")
    .returns<Profile[]>();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-white">Armar formación</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Elegí cuántos juegan, la formación, ubicá al plantel y descargá la imagen para mandar por
        el grupo.
      </p>
      <FormacionBuilder jugadores={jugadores ?? []} />
    </div>
  );
}
