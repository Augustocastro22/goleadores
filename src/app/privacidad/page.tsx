import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import Card from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Política de privacidad · Goleadores",
};

export default function PrivacidadPage() {
  const actualizada = new Date(LEGAL.actualizada + "T00:00:00").toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const contacto = (
    <Link href="/contacto" className="text-primary-400 hover:text-primary-300">
      el formulario de contacto
    </Link>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-white">Política de privacidad</h1>
      <p className="mb-6 text-sm text-zinc-500">Última actualización: {actualizada}</p>

      <Card className="flex flex-col gap-6 p-6 text-sm leading-relaxed text-zinc-300 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white [&_li]:ml-4 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        <section>
          <p>
            Goleadores es una app para llevar las estadísticas de partidos de fútbol entre amigos.
            Acá contamos qué datos tuyos guardamos, para qué, quién los ve y cómo podés pedir que
            los borremos. Lo escribimos en simple a propósito.
          </p>
        </section>

        <section>
          <h2>Quién es responsable de tus datos</h2>
          <p>
            {LEGAL.responsable}, que administra la app. Para cualquier consulta o pedido sobre tus
            datos escribinos por {contacto}.
          </p>
        </section>

        <section>
          <h2>Qué datos guardamos</h2>
          <ul>
            <li>
              <strong className="text-white">Tu cuenta:</strong> email, contraseña (guardada
              cifrada, nadie la puede ver), nombre, apellido, apodo y, si la subís, tu foto. Si entrás con Google, de tu cuenta de Google solo tomamos tu
              nombre y tu email (no tenemos acceso a tu contraseña de Google ni a nada más).
            </li>
            <li>
              <strong className="text-white">Lo que pasa en tus grupos:</strong> a qué grupos
              pertenecés y con qué rol, los partidos en los que te convocaron, tus goles, tus
              votos de Mejor y Peor Jugador, las encuestas que creás y tus votos en ellas.
            </li>
            <li>
              <strong className="text-white">Tu disponibilidad,</strong> si cargás los días en
              que no podés jugar.
            </li>
            <li>
              <strong className="text-white">Notificaciones:</strong> si las activás, un
              identificador de tu navegador para poder mandártelas.
            </li>
            <li>
              <strong className="text-white">Si nos escribís por el formulario de contacto:</strong>{" "}
              tu nombre, tu email y tu mensaje, solo para responderte.
            </li>
            <li>
              <strong className="text-white">Datos técnicos:</strong> cookies necesarias para
              mantener tu sesión abierta y recordar qué grupo estás mirando. No usamos cookies de
              publicidad ni de seguimiento.
            </li>
          </ul>
        </section>

        <section>
          <h2>Para qué los usamos</h2>
          <p>
            Solo para que la app funcione: mostrar partidos, resultados, rankings y encuestas de
            tus grupos, avisarte novedades si activaste las notificaciones, y que el admin de cada
            grupo pueda armar la convocatoria. No vendemos tus datos ni los usamos para publicidad.
          </p>
        </section>

        <section>
          <h2>Quién ve tus datos</h2>
          <ul>
            <li>
              <strong className="text-white">Los miembros de tus grupos</strong> ven tu nombre,
              apodo, foto, partidos, goles y los rankings. Un grupo nunca ve los datos de otro.
            </li>
            <li>
              <strong className="text-white">Tus votos de Mejor y Peor Jugador son secretos:</strong>{" "}
              los demás solo ven los resultados, no a quién votaste.
            </li>
            <li>
              <strong className="text-white">El admin de cada grupo</strong> además ve tu email,
              cuándo entraste por última vez y tu disponibilidad (la general y la que marcaste
              para ese grupo).
            </li>
            <li>
              <strong className="text-white">Proveedores que hacen funcionar la app:</strong>{" "}
              Supabase (base de datos, cuentas y archivos) y Vercel (donde está publicada la app).
              Si activás las notificaciones, pasan por el servicio de tu navegador (Google, Apple o
              Mozilla). Estos proveedores pueden tener servidores fuera de Argentina; al usar la
              app aceptás que tus datos se guarden ahí, con las medidas de seguridad que ellos
              ofrecen.
            </li>
          </ul>
        </section>

        <section>
          <h2>Cuánto tiempo los guardamos</h2>
          <p>
            Mientras tengas tu cuenta. Si te vas de un grupo, lo que jugaste en ese grupo sigue
            figurando en su historial (partidos, goles y rankings), marcado como que ya no estás.
          </p>
        </section>

        <section>
          <h2>Cómo borrar tu cuenta</h2>
          <p>
            Desde{" "}
            <Link href="/perfil" className="text-primary-400 hover:text-primary-300">
              Mi perfil → Eliminar mi cuenta
            </Link>
            . Al hacerlo se borran tu email, tu contraseña, tu nombre, tu foto, tu disponibilidad
            y tus notificaciones, y salís de todos tus grupos. Los grupos donde eras el único
            miembro se borran enteros.
          </p>
          <p className="mt-2">
            Tus goles, convocatorias y votos en partidos ya jugados quedan a nombre de
            &quot;Jugador eliminado&quot;, sin ningún dato que te identifique. Así no cambian los
            resultados ni las estadísticas del resto del grupo.
          </p>
          <p className="mt-2">
            Si sos el único admin de un grupo con más gente, primero tenés que hacer admin a otro
            miembro. Si no podés entrar a tu cuenta, escribinos por {contacto} con el email con el que te
            registraste y la borramos nosotros.
          </p>
        </section>

        <section>
          <h2>Tus derechos</h2>
          <p>
            Podés pedirnos en cualquier momento acceso a tus datos, que los corrijamos o que los
            borremos, escribiéndonos por {contacto}. Casi todo lo podés hacer vos desde la app: editar tu
            perfil, borrar tu disponibilidad o eliminar tu cuenta.
          </p>
          <p className="mt-2">
            Como titular de los datos personales, tenés la facultad de ejercer el derecho de
            acceso a ellos en forma gratuita a intervalos no inferiores a seis meses, salvo que
            acredites un interés legítimo al efecto, conforme a lo establecido en el artículo 14,
            inciso 3 de la Ley N° 25.326. La Agencia de Acceso a la Información Pública, en su
            carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las
            denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por
            incumplimiento de las normas vigentes en materia de protección de datos personales.
          </p>
        </section>

        <section>
          <h2>Menores de edad</h2>
          <p>
            Si tenés menos de 13 años, necesitás que tu madre, padre o tutor esté de acuerdo antes
            de crear tu cuenta.
          </p>
        </section>

        <section>
          <h2>Cambios en esta política</h2>
          <p>
            Si cambiamos algo importante lo vamos a avisar en la app, y la fecha de arriba se
            actualiza.
          </p>
        </section>
      </Card>
    </div>
  );
}
