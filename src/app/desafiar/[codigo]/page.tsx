import type { Metadata } from "next";
import Link from "next/link";
import { getContexto } from "@/lib/grupo";
import { getGrupoDeDesafio } from "@/lib/invitacion";
import { crearDesafio } from "@/lib/actions/desafios";
import { hoyArgentina } from "@/lib/confirmacion";
import Card from "@/components/ui/Card";
import GrupoLogo from "@/components/ui/GrupoLogo";
import { buttonClass } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import HoraSelect from "@/components/HoraSelect";

/** Vista previa del link (la imagen está en opengraph-image.tsx, al lado). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>;
}): Promise<Metadata> {
  const { codigo } = await params;
  const grupo = await getGrupoDeDesafio(codigo);
  if (!grupo) return {};

  const title = `Desafiá a ${grupo.nombre}`;
  const description = `${grupo.nombre} los desafía a jugar un partido en Goleadores. Elegí cuándo y dónde y mandales el desafío.`;
  return {
    title,
    description,
    // Va completo: el openGraph de una página reemplaza al del layout, no se combina.
    openGraph: { title, description, siteName: "Goleadores", locale: "es_AR", type: "website" },
  };
}

/**
 * Link de desafío (/desafiar/<codigo>): lo comparte el admin de un grupo
 * para que otro grupo lo desafíe. Se ve sin sesión (muestra el grupo y
 * manda a entrar); con sesión, el admin elige desde cuál de sus grupos
 * desafía y manda el desafío desde acá.
 */
export default async function DesafiarPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const [{ user, grupos, grupo: activo }, rival] = await Promise.all([getContexto(), getGrupoDeDesafio(codigo)]);

  if (!rival) {
    return (
      <Card className="mx-auto max-w-sm p-6 text-center">
        <p className="mb-1 font-bold text-white">Link inválido</p>
        <p className="mb-4 text-sm text-zinc-500">
          Este link de desafío no existe o el grupo lo renovó. Pediles el link nuevo.
        </p>
        <Link href="/partidos" className={buttonClass("secondary", "sm")}>
          Ir a partidos
        </Link>
      </Card>
    );
  }

  // Desde qué grupos puede desafiar: donde es admin, menos el propio rival.
  const misGruposAdmin = grupos.filter((g) => g.rol === "admin" && g.id !== rival.id);
  const esMiPropioGrupo = grupos.some((g) => g.id === rival.id);
  const preseleccionado = misGruposAdmin.find((g) => g.id === activo?.id) ?? misGruposAdmin[0];
  const next = encodeURIComponent(`/desafiar/${codigo}`);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <Card className="w-full max-w-sm p-6">
        <div className="text-center">
          <GrupoLogo src={rival.logoUrl} nombre={rival.nombre} size={88} className="mx-auto" />
          <p className="mt-4 text-sm text-zinc-500">Desafiá a</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{rival.nombre}</h1>
          <p className="mt-1 mb-5 text-sm text-zinc-500">
            {rival.jugados === 0
              ? "Todavía no jugó desafíos"
              : `${rival.jugados} ${rival.jugados === 1 ? "desafío jugado" : "desafíos jugados"} · ${rival.sinVerificar} sin verificar`}
          </p>
        </div>

        {!user ? (
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm text-zinc-400">
              Para desafiarlos tenés que ser admin de un grupo en Goleadores. Entrá con tu cuenta y volvés
              acá solo.
            </p>
            <Link href={`/login?next=${next}`} className={buttonClass("primary", "md", "w-full")}>
              Entrar
            </Link>
            <Link href={`/signup?next=${next}`} className={buttonClass("secondary", "md", "w-full")}>
              Crear mi cuenta
            </Link>
          </div>
        ) : misGruposAdmin.length === 0 ? (
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm text-zinc-400">
              {esMiPropioGrupo && grupos.every((g) => g.id === rival.id || g.rol !== "admin")
                ? "Es el link de desafío de tu propio grupo: pasáselo al admin del grupo con el que quieran jugar."
                : "Solo el admin de un grupo puede mandar un desafío. Pasale este link al admin de tu grupo."}
            </p>
            <Link href="/partidos" className={buttonClass("secondary", "md", "w-full")}>
              Ir a partidos
            </Link>
          </div>
        ) : (
          <ActionForm action={crearDesafio} className="flex flex-col gap-3">
            <input type="hidden" name="codigo" value={codigo} />
            {misGruposAdmin.length === 1 ? (
              <input type="hidden" name="grupo_id" value={misGruposAdmin[0].id} />
            ) : (
              <Label>
                Desafiar desde
                <select
                  name="grupo_id"
                  defaultValue={preseleccionado?.id}
                  className="w-full appearance-none rounded-xl border border-border bg-white/5 px-3.5 py-2.5 text-white outline-none transition focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/20"
                >
                  {misGruposAdmin.map((g) => (
                    <option key={g.id} value={g.id} className="bg-surface">
                      {g.nombre}
                    </option>
                  ))}
                </select>
              </Label>
            )}
            <div className="flex gap-3">
              <Label className="flex-1">
                Fecha
                <Input type="date" name="fecha" required min={hoyArgentina()} />
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
              {misGruposAdmin.length === 1 ? `Lo mandan como ${misGruposAdmin[0].nombre}. ` : ""}
              Le llega a los admins de {rival.nombre}. Si aceptan, el partido aparece en Partidos de los dos
              grupos.
            </p>
            <SubmitButton pendingText="Enviando…" className="w-full">
              Mandar desafío
            </SubmitButton>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
