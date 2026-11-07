/**
 * Confetti sin librerías: papelitos (spans) que salen de un punto, caen
 * girando y se borran solos (la animación está en globals.css,
 * .confetti-papel). Para festejos: una victoria, el MVP. Con
 * prefers-reduced-motion no hace nada.
 */
const COLORES = {
  cancha: ["#34d399", "#10b981", "#f4f4f5", "#fbbf24"],
  oro: ["#fbbf24", "#f59e0b", "#fde68a", "#f4f4f5"],
};

export function lanzarConfetti({
  desde,
  cantidad = 70,
  paleta = "cancha",
}: {
  /** De dónde sale (coordenadas de la pantalla); por defecto, arriba al centro. */
  desde?: { x: number; y: number };
  cantidad?: number;
  paleta?: keyof typeof COLORES;
} = {}) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const origen = desde ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.3 };
  const colores = COLORES[paleta];
  const fragmento = document.createDocumentFragment();
  const papeles: HTMLElement[] = [];

  for (let i = 0; i < cantidad; i++) {
    const papel = document.createElement("span");
    papel.className = "confetti-papel";
    const angulo = Math.random() * Math.PI * 2;
    const fuerza = 80 + Math.random() * 220;
    const ancho = 5 + Math.random() * 5;
    papel.style.left = `${origen.x}px`;
    papel.style.top = `${origen.y}px`;
    papel.style.width = `${ancho}px`;
    papel.style.height = `${ancho * (0.4 + Math.random() * 0.6)}px`;
    papel.style.background = colores[i % colores.length];
    // Sale para cualquier lado y la "gravedad" lo baja: más abajo que arriba.
    papel.style.setProperty("--cx", `${Math.cos(angulo) * fuerza}px`);
    papel.style.setProperty("--cy", `${Math.sin(angulo) * fuerza * 0.6 + 260 + Math.random() * 160}px`);
    papel.style.setProperty("--cr", `${(Math.random() - 0.5) * 900}deg`);
    papel.style.setProperty("--cd", `${1.1 + Math.random() * 0.8}s`);
    fragmento.appendChild(papel);
    papeles.push(papel);
  }
  document.body.appendChild(fragmento);
  window.setTimeout(() => papeles.forEach((p) => p.remove()), 2200);
}
