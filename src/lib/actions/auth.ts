"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
