"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push/send";

const MOTIVOS = ["borrar_cuenta", "mis_datos", "otro"] as const;
const MAX_MENSAJES_POR_HORA = 3;

/**
 * Guarda un mensaje del formulario de contacto (tabla mensajes_contacto, ver
 * 0018_borrado_cuenta.sql). Se puede usar sin sesión. Si está configurada la
 * variable CONTACTO_AVISAR_A (ids de usuario separados por coma), les manda
 * una notificación push avisando que llegó un mensaje.
 */
export async function enviarMensajeContacto(formData: FormData) {
  // Campo trampa: invisible para personas, los bots suelen completarlo.
  if (String(formData.get("sitio_web") ?? "")) return { success: true };

  const motivo = String(formData.get("motivo") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const mensaje = String(formData.get("mensaje") ?? "").trim();

  if (!MOTIVOS.includes(motivo as (typeof MOTIVOS)[number])) return { error: "Elegí el motivo." };
  if (!nombre || nombre.length > 100) return { error: "Poné tu nombre." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return { error: "Poné un email válido, así te podemos responder." };
  }
  if (!mensaje) return { error: "Escribí tu mensaje." };
  if (mensaje.length > 2000) return { error: "El mensaje puede tener hasta 2000 caracteres." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("mensajes_contacto")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", haceUnaHora);
  if ((count ?? 0) >= MAX_MENSAJES_POR_HORA) {
    return { error: "Ya recibimos varios mensajes tuyos. Probá de nuevo en un rato." };
  }

  const { error } = await admin
    .from("mensajes_contacto")
    .insert({ user_id: user?.id ?? null, motivo, nombre, email, mensaje });
  if (error) return { error: "No se pudo enviar el mensaje. Probá de nuevo." };

  await avisarPorMail({ motivo, nombre, email, mensaje });

  const avisarA = (process.env.CONTACTO_AVISAR_A ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (avisarA.length > 0) {
    await enviarPush(avisarA, {
      title: "Nuevo mensaje de contacto",
      body: `${nombre}: ${motivo === "borrar_cuenta" ? "pide borrar su cuenta" : mensaje.slice(0, 80)}`,
      url: "/perfil",
    });
  }

  return { success: true };
}

const MOTIVO_LABEL: Record<string, string> = {
  borrar_cuenta: "Pide borrar su cuenta",
  mis_datos: "Consulta sobre sus datos",
  otro: "Otra consulta",
};

/**
 * Manda el mensaje por mail a quien administra la app, vía Resend. El
 * destino sale de CONTACTO_EMAIL_DESTINO, una variable solo del servidor:
 * nunca llega al navegador ni está en el código. Con "reply_to" del que
 * escribió, responder el mail le contesta directo. Si faltan las variables
 * o el envío falla, el mensaje igual quedó guardado en la tabla.
 */
async function avisarPorMail(m: { motivo: string; nombre: string; email: string; mensaje: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const destino = process.env.CONTACTO_EMAIL_DESTINO;
  if (!apiKey || !destino) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CONTACTO_EMAIL_REMITENTE ?? "Goleadores <onboarding@resend.dev>",
        to: [destino],
        reply_to: m.email,
        subject: `[Goleadores] ${MOTIVO_LABEL[m.motivo] ?? "Contacto"}: ${m.nombre}`,
        text: `${MOTIVO_LABEL[m.motivo] ?? m.motivo}\n\nDe: ${m.nombre} <${m.email}>\n\n${m.mensaje}\n\n—\nRespondé este mail para contestarle. El mensaje también quedó en la tabla mensajes_contacto de Supabase.`,
      }),
    });
    if (!res.ok) console.error("Error mandando mail de contacto:", res.status, await res.text());
  } catch (err) {
    console.error("Error mandando mail de contacto:", err);
  }
}
