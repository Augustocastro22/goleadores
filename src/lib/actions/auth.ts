"use server";

import { redirect } from "next/navigation";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/partidos");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellido = String(formData.get("apellido") ?? "").trim();
  const apodo = String(formData.get("apodo") ?? "").trim();

  if (!nombre || !apellido || !apodo) {
    redirect(`/signup?error=${encodeURIComponent("Completá nombre, apellido y apodo.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre, apellido, apodo } },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (!data.session) {
    // El proyecto tiene "Confirm email" activado: la cuenta se creó pero
    // todavía no hay sesión hasta que confirme el mail.
    redirect(
      "/login?error=" +
        encodeURIComponent("Cuenta creada. Revisá tu email para confirmarla antes de entrar.")
    );
  }

  redirect("/partidos");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function solicitarRecuperacion(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Ingresá tu email." };

  const siteUrl = await getSiteUrl();

  // @supabase/ssr fuerza flowType "pkce" en sus clientes sin importar qué
  // opción le pases, y ese modo necesita una cookie guardada en el mismo
  // navegador que pidió el reset (falla si el link se abre en otro
  // navegador/dispositivo/app de mail). Para el link de recuperación
  // usamos el cliente base de supabase-js, que sí respeta flowType
  // "implicit": el link resultante trae el token en el propio link, sin
  // depender de nada guardado localmente.
  const supabase = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", persistSession: false } }
  );

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/actualizar-password`,
  });

  // No confirmamos ni negamos si el email existe, por seguridad.
  return { success: true };
}

export async function actualizarPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const accessToken = String(formData.get("access_token") ?? "");
  const refreshToken = String(formData.get("refresh_token") ?? "");
  if (password.length < 6) return { error: "La contraseña tiene que tener al menos 6 caracteres." };
  if (!accessToken || !refreshToken) {
    return { error: "El link de recuperación venció. Pedí uno nuevo." };
  }

  const supabase = await createClient();

  // Estos tokens vienen del link (fragmento de la URL, nunca pasó por
  // nuestro servidor todavía) y son autosuficientes: al establecerlos acá
  // el cliente SSR los guarda como cookies normales de sesión.
  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (setSessionError) return { error: "El link de recuperación venció. Pedí uno nuevo." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "El link de recuperación venció. Pedí uno nuevo." };

  const { error } = await supabase.auth.updateUser({ password });
  // Si ya tenía esa contraseña, Supabase lo rechaza (same_password) — no
  // hace falta tratarlo como error, total ya es la que quiere usar.
  if (error && error.code !== "same_password") return { error: error.message };

  // La sesión de recuperación queda marcada como tal para siempre; la
  // reemplazamos por una sesión normal para que no quede atrapado en esta
  // pantalla después de definir la contraseña.
  await supabase.auth.signOut();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (signInError) redirect("/login");

  redirect("/partidos");
}
