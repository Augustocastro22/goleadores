import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La tipografía de las imágenes para compartir se lee del disco: que viaje con el deploy.
  outputFileTracingIncludes: {
    "/api/compartir": ["./src/lib/compartir/fonts/**"],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
