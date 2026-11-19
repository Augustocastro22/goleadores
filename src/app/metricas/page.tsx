import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContexto } from "@/lib/grupo";
import { getMetricas, puedeVerMetricas } from "@/lib/metricas";
import { createAdminClient } from "@/lib/supabase/admin";
import MetricasVista from "./MetricasVista";

export const metadata: Metadata = {
  title: "Métricas · Goleadores",
  robots: { index: false },
};

// Uso de toda la app, solo para el dueño (METRICAS_EMAILS). Para el resto
// la pantalla no existe.
export default async function MetricasPage() {
  const { user } = await getContexto();
  if (!puedeVerMetricas(user?.email)) notFound();

  const metricas = await getMetricas(createAdminClient());
  return <MetricasVista m={metricas} />;
}
