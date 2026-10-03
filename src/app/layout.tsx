import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPCION =
  "Armá los partidos con tus amigos, cargá los goles, votá al mejor y al peor, y seguí las estadísticas del grupo.";

export const metadata: Metadata = {
  // Base para las URLs absolutas de la vista previa (la imagen de opengraph-image.tsx).
  metadataBase: new URL("https://goleadores.ar"),
  title: "Goleadores",
  description: DESCRIPCION,
  // Lo que muestran WhatsApp y compañía al compartir un link.
  openGraph: {
    title: "Goleadores",
    description: DESCRIPCION,
    siteName: "Goleadores",
    locale: "es_AR",
    type: "website",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Goleadores",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#08090c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col text-zinc-100">
        <RegisterServiceWorker />
        <NavBar />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 md:pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
