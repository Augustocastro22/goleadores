import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Partido } from "@/lib/types";
import Card from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { IconChevronRight, IconPlus } from "@/components/icons";

export default async function PartidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  const { data: partidos } = await supabase
    .from("partidos")
    .select("*")
    .order("fecha", { ascending: false })
    .returns<Partido[]>();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Partidos</h1>
        {profile?.rol === "admin" && (
          <Link href="/partidos/nuevo" className={buttonClass("primary", "sm")}>
            <IconPlus className="h-4 w-4" /> Nuevo
          </Link>
        )}
      </div>

      {!partidos || partidos.length === 0 ? (
        <Card className="px-5 py-10 text-center text-sm text-zinc-500">
          Todavía no hay partidos cargados.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {partidos.map((partido) => {
            const fecha = new Date(partido.fecha + "T00:00:00");
            return (
              <Link key={partido.id} href={`/partidos/${partido.id}`} className="block">
                <Card className="flex items-center justify-between gap-4 px-4 py-4 transition hover:border-border-strong hover:bg-surface-2/80">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white/5 py-2">
                      <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                        {fecha.toLocaleDateString("es-AR", { month: "short" })}
                      </span>
                      <span className="text-lg font-bold text-white">{fecha.getDate()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">vs {partido.rival}</p>
                      <p className="truncate text-sm text-zinc-500">{partido.lugar}</p>
                    </div>
                  </div>
                  <IconChevronRight className="h-5 w-5 shrink-0 text-zinc-600" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
