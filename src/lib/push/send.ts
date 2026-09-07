import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

webpush.setVapidDetails(
  "mailto:augusto.castro@vcodevs.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/** Manda una notificación push a un conjunto de usuarios. No falla el flujo
 * que la dispara: cualquier error queda en logs y se ignora. */
export async function enviarPush(userIds: string[], payload: PushPayload) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;

  const supabase = createAdminClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", ids);

  if (error || !subs || subs.length === 0) return;

  const endpointsAVencer: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          endpointsAVencer.push(sub.endpoint);
        } else {
          console.error("Error enviando push:", err);
        }
      }
    })
  );

  if (endpointsAVencer.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", endpointsAVencer);
  }
}
