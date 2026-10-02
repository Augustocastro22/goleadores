import Link from "next/link";
import { getContexto } from "@/lib/grupo";
import { logout } from "@/lib/actions/auth";
import { isRecoverySession } from "@/lib/recovery";
import Avatar from "./ui/Avatar";
import GrupoLogo from "./ui/GrupoLogo";
import NavLinks from "./NavLinks";
import BottomNav from "./BottomNav";
import { IconChevronRight, IconLogout, IconSettings } from "./icons";

export default async function NavBar() {
  const { supabase, user, grupo } = await getContexto();

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
        <nav className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-6">
            <Link
              href="/grupos"
              title="Cambiar de grupo"
              className="flex min-w-0 items-center gap-1.5 text-base font-extrabold tracking-tight text-white"
            >
              {grupo ? (
                <GrupoLogo src={grupo.logo_url} nombre={grupo.nombre} size={28} />
              ) : (
                <span className="text-lg">⚽</span>
              )}
              <span className="max-w-[45vw] truncate sm:max-w-56">{grupo?.nombre ?? "Goleadores"}</span>
              <IconChevronRight className="h-4 w-4 shrink-0 rotate-90 text-zinc-500" />
            </Link>
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
              <button
                type="submit"
                title="Salir"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-danger-400"
              >
                <IconLogout className="h-5 w-5" />
              </button>
            </form>
          </div>
        </nav>
      </header>
      {grupo && <BottomNav />}
    </>
  );
}
