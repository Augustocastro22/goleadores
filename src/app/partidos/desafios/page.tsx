import Link from "next/link";
import { requireGrupo } from "@/lib/grupo";
import { getCanchas } from "@/lib/canchas";
import { getSiteUrl } from "@/lib/site-url";
import { hoyArgentina } from "@/lib/confirmacion";
import { seccionDesafio, type DesafioVista, type SeccionDesafio } from "@/lib/desafios";
import { regenerarCodigoDesafio } from "@/lib/actions/desafios";
import Card from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import ActionForm from "@/components/ActionForm";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { IconChevronRight } from "@/components/icons";
import DesafiarForm from "./DesafiarForm";
import CodigoDesafio from "./CodigoDesafio";
import DesafioCard from "./DesafioCard";

const SECCIONES: { id: SeccionDesafio; titulo: string }[] = [
  { id: "responder", titulo: "Para responder" },
  { id: "proximos", titulo: "Próximos" },
  { id: "enviados", titulo: "Enviados" },
  { id: "historial", titulo: "Historial" },
];

export default async function DesafiosPage() {
  const { supabase, grupo } = await requireGrupo();
  const esAdmin = grupo.rol === "admin";
  const hoy = hoyArgentina();

  const [{ data }, { data: grupoRow }, canchas] = await Promise.all([
    supabase.rpc("get_desafios", { p_grupo_id: grupo.id }),
    esAdmin
      ? supabase.from("grupos").select("codigo_desafio").eq("id", grupo.id).single()
      : Promise.resolve({ data: null }),
    esAdmin ? getCanchas(supabase, grupo.id) : Promise.resolve([]),
  ]);
  const desafios = (data ?? []) as DesafioVista[];

  const porSeccion = new Map<SeccionDesafio, DesafioVista[]>();
  for (const d of desafios) {
    const seccion = seccionDesafio(d, hoy);
    porSeccion.set(seccion, [...(porSeccion.get(seccion) ?? []), d]);
  }
  // Lo que viene, del más cercano al más lejano.
  for (const id of ["responder", "proximos", "enviados"] as const) {
    porSeccion.get(id)?.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/partidos"
        className="inline-flex w-fit items-center gap-1 text-sm text-zinc-500 hover:text-white"
      >
        <IconChevronRight className="h-4 w-4 rotate-180" /> Partidos
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Desafíos</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Partidos contra otros grupos de Goleadores. Si el otro grupo acepta, el partido aparece en
          Partidos de los dos.
        </p>
      </div>

      {esAdmin && <DesafiarForm hoy={hoy} canchas={canchas} />}

      {desafios.length === 0 ? (
        <Card className="px-5 py-10 text-center text-sm text-zinc-500">
          Todavía no hay desafíos.
          {esAdmin && (
            <span className="mt-1 block">
              Pedile el link de desafío a un admin del otro grupo, o pasale el de ustedes (está
              abajo).
            </span>
          )}
        </Card>
      ) : (
        SECCIONES.filter((s) => porSeccion.has(s.id)).map((s) => (
          <section key={s.id}>
            <h2 className="mb-3 text-lg font-bold text-white">{s.id === "responder" && !esAdmin ? "Esperando respuesta de los admins" : s.titulo}</h2>
            <div className="flex flex-col gap-3">
              {porSeccion.get(s.id)!.map((d) => (
                <DesafioCard
                  key={d.id}
                  desafio={d}
                  hoy={hoy}
                  esAdmin={esAdmin}
                  grupoId={grupo.id}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {esAdmin && grupoRow?.codigo_desafio && (
        <Card className="p-5">
          <h2 className="mb-1 font-bold text-white">Link de desafío de {grupo.nombre}</h2>
          <p className="mb-4 text-xs text-zinc-500">
            Mandáselo por WhatsApp al admin de otro grupo: lo abre y los desafía desde ahí. Solo sirve
            para desafiar: no deja entrar al grupo ni ver nada de ustedes.
          </p>
          <CodigoDesafio
            url={`${await getSiteUrl()}/desafiar/${grupoRow.codigo_desafio}`}
            nombreGrupo={grupo.nombre}
          />
          <ActionForm action={regenerarCodigoDesafio} className="mt-3 flex flex-col gap-1">
            <ConfirmSubmitButton
              confirmMessage="¿Generar un link nuevo? El actual deja de funcionar (los desafíos que ya mandaron siguen igual)."
              confirmLabel="Generar"
              className={buttonClass("ghost", "sm", "self-start !px-2 text-xs")}
            >
              Generar link nuevo
            </ConfirmSubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
