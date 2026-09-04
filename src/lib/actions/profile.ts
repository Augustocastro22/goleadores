"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export async function updateProfile(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellido = String(formData.get("apellido") ?? "").trim();
  const apodo = String(formData.get("apodo") ?? "").trim();

  if (!nombre || !apellido || !apodo) {
    return { error: "Completá nombre, apellido y apodo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("profiles")
    .update({ nombre, apellido, apodo })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/perfil");
  return { success: true };
}

export async function uploadAvatar(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Elegí una foto." };
  if (file.size > MAX_AVATAR_BYTES) return { error: "La foto no puede superar los 5 MB." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  // El archivo ya llega redimensionado/comprimido a JPEG desde el cliente,
  // así que siempre pisa el mismo path en vez de acumular archivos viejos.
  const path = `${user.id}/avatar.jpg`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });

  if (uploadError) return { error: uploadError.message };

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const foto_url = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ foto_url })
    .eq("id", user.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/perfil");
  return { success: true, foto_url };
}
