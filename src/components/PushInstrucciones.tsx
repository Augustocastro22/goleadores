import type { Plataforma, PushEstado } from "@/lib/push/use-push-subscription";

const fuerte = "font-medium text-zinc-300";

/**
 * Qué hacer para poder activar las notificaciones, según el caso: instalar la
 * app en iPhone, salir del navegador de Instagram, o desbloquearlas. Para los
 * demás estados no muestra nada.
 */
export default function PushInstrucciones({
  estado,
  plataforma,
  className = "",
}: {
  estado: PushEstado;
  plataforma: Plataforma;
  className?: string;
}) {
  if (estado === "requiere-instalar") {
    return (
      <div className={className}>
        <p>En iPhone las notificaciones solo llegan si agregás Goleadores a tu pantalla de inicio:</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5">
          <li>
            Tocá <span className={fuerte}>Compartir</span> (el cuadradito con la flecha para arriba; si no
            lo ves, está en el menú <span className={fuerte}>⋯</span>).
          </li>
          <li>
            Elegí <span className={fuerte}>Agregar a inicio</span> (si no aparece, deslizá la lista para abajo).
          </li>
          <li>Abrí Goleadores desde el ícono nuevo y activá las notificaciones desde ahí.</li>
        </ol>
      </div>
    );
  }

  if (estado === "navegador-app") {
    return (
      <p className={className}>
        Estás en el navegador de otra app (Instagram, Facebook o TikTok), que no deja recibir
        notificaciones. Tocá <span className={fuerte}>{plataforma === "android" ? "⋮" : "⋯"}</span> arriba a la
        derecha →{" "}
        <span className={fuerte}>Abrir en el navegador</span>
        {plataforma === "ios" ? " (Safari), agregala a inicio" : ""} y activalas desde ahí.
      </p>
    );
  }

  if (estado === "denegado") {
    return (
      <p className={className}>
        Las notificaciones están bloqueadas.{" "}
        {plataforma === "ios" ? (
          <>
            Para habilitarlas andá a <span className={fuerte}>Ajustes → Notificaciones → Goleadores</span> y
            activá <span className={fuerte}>Permitir notificaciones</span>.
          </>
        ) : plataforma === "android" ? (
          <>
            Tocá el <span className={fuerte}>candadito</span> al lado de la dirección →{" "}
            <span className={fuerte}>Permisos → Notificaciones → Permitir</span> y recargá la página. Si
            usás la app desde el ícono: mantenelo apretado → <span className={fuerte}>Información de la app → Notificaciones</span>.
          </>
        ) : (
          <>
            Hacé clic en el <span className={fuerte}>candado</span> (o el ícono de ajustes) al lado de la
            dirección → <span className={fuerte}>Notificaciones → Permitir</span> y recargá la página.
          </>
        )}
      </p>
    );
  }

  if (estado === "no-soportado") {
    return (
      <p className={className}>
        {plataforma === "ios"
          ? "Tu iPhone no soporta notificaciones de apps web: actualizalo a iOS 16.4 o más nuevo."
          : "Este navegador no soporta notificaciones. Probá desde Chrome, Safari, Edge o Firefox."}
      </p>
    );
  }

  return null;
}
