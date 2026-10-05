import Link from "next/link";
import { getContexto } from "@/lib/grupo";
import { logout } from "@/lib/actions/auth";
import { isRecoverySession } from "@/lib/recovery";
import Avatar from "./ui/Avatar";
import NavLinks from "./NavLinks";
import BottomNav from "./BottomNav";
import GrupoSwitcher from "./GrupoSwitcher";
import ConfirmSubmitButton from "./ConfirmSubmitButton";
import { IconLogout, IconSettings } from "./icons";

export default async function NavBar() {
  const { supabase, user, grupo, grupos } = await getContexto();

  if (!user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (isRecoverySession(session?.access_token)) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("apodo, foto_url")
    .eq("id", user.id)
    .single();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-lg">
        {/* Más ancha que el contenido (max-w-3xl) para que entren el nombre del grupo y los links. */}
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-6">
            <GrupoSwitcher
              grupos={grupos.map(({ id, nombre, logo_url }) => ({ id, nombre, logo_url }))}
              activoId={grupo?.id ?? null}
            />
            {grupo && <NavLinks />}
          </div>
          <div className="flex items-center gap-2">
            {grupo?.rol === "admin" && (
              <Link
                href="/admin"
                title="Admin"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-white"
              >
                <IconSettings className="h-5 w-5" />
              </Link>
            )}
            <Link
              href="/perfil"
              className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <Avatar src={profile?.foto_url} alt={profile?.apodo ?? "?"} size={28} />
              <span className="hidden sm:inline">{profile?.apodo ?? "Perfil"}</span>
            </Link>
            <form action={logout}>
              <ConfirmSubmitButton
                title="Salir"
                confirmMessage="¿Cerrar sesión? Para volver a entrar vas a tener que ingresar de nuevo."
                confirmLabel="Cerrar sesión"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-danger-400"
              >
                <IconLogout className="h-5 w-5" />
              </ConfirmSubmitButton>
            </form>
          </div>
        </nav>
      </header>
      {grupo && <BottomNav />}
    </>
  );
}
