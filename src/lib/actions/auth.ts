"use server";

import { redirect } from "next/navigation";
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

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback`,
  });

  // No confirmamos ni negamos si el email existe, por seguridad.
  return { success: true };
}

export async function actualizarPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return { error: "La contraseña tiene que tener al menos 6 caracteres." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "El link de recuperación venció. Pedí uno nuevo." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/partidos");
}
