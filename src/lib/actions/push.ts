"use server";

import { createClient } from "@/lib/supabase/server";

export interface SuscripcionPushInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function suscribirPush({ endpoint, p256dh, auth }: SuscripcionPushInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint, p256dh, auth }, { onConflict: "endpoint" });

  if (error) return { error: error.message };
  return { success: true };
}

export async function desuscribirPush(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}
