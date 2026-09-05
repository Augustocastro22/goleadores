import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { isRecoverySession } from "@/lib/recovery";
import Avatar from "./ui/Avatar";
import NavLinks from "./NavLinks";
import BottomNav from "./BottomNav";
import { IconLogout } from "./icons";

export default async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
          <div className="flex items-center gap-6">
            <Link
              href="/partidos"
              className="flex items-center gap-1.5 text-base font-extrabold tracking-tight text-white"
            >
              <span className="text-lg">⚽</span> Goleadores
            </Link>
            <NavLinks />
          </div>
          <div className="flex items-center gap-2">
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
      <BottomNav />
    </>
  );
}
