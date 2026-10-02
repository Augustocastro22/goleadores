# Goleadores

App para llevar las estadísticas de los partidos de fútbol entre amigos: goles, MVP y Peor Jugador por partido, con tablas históricas. Soporta varios grupos: cada uno tiene sus propios partidos, estadísticas, encuestas, reglas y admins, y un grupo nunca ve los datos de otro.

**Stack:** Next.js (App Router) + Supabase (auth, base de datos, storage) + Vercel.

## 1. Crear el proyecto de Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta (o iniciá sesión) y un **New project**.
2. Elegí nombre, contraseña de base de datos y región (la más cercana), y esperá a que termine de aprovisionarse (1-2 min).
3. Andá a **SQL Editor** → **New query** y ejecutá, en orden, cada archivo de [`supabase/migrations/`](supabase/migrations) (primero `0001_init.sql`, después `0002_resultado.sql`, etc.). El primero crea las tablas, las políticas de RLS, las funciones de estadísticas y el bucket de fotos de perfil; los siguientes son cambios incrementales sobre ese esquema.
4. Andá a **Project Settings → API** y copiá:
   - **Project URL**
   - **anon public key**

## 2. Configurar el proyecto local

Copiá `.env.local.example` a `.env.local` y completá con los valores del paso anterior:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

Instalá dependencias (ya están instaladas si vas a seguir en esta misma carpeta) y corré el servidor:

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## 3. Crear tu grupo

1. En la app, andá a **Registrate** y creá tu cuenta (nombre, apellido, apodo, email, contraseña).
2. Como todavía no estás en ningún grupo, la app te lleva a **/grupos**: ahí creás el grupo y quedás como su admin. En el mismo formulario elegís las reglas: si el grupo vota Mejor y Peor Jugador (y con qué mínimo de jugadores) y si el link de invitación pide aprobación. Todo se puede cambiar después desde **Admin**.
3. En **Admin → Grupo** está el link de invitación (`/unirse/<codigo>`). Mandalo por WhatsApp: quien lo abre se registra o inicia sesión y queda como jugador del grupo. Si el link se filtra, generá uno nuevo desde ahí (el anterior deja de funcionar). Si preferís controlar quién entra, activá **Pedir aprobación para entrar**: el que abre el link queda pendiente, a los admins les llega una notificación y lo aceptan o rechazan en **Admin → Miembros**.

Una misma cuenta puede estar en hasta 5 grupos (por ejemplo el del jueves y el de la empresa) y tener un rol distinto en cada uno; se cambia de grupo tocando el nombre arriba a la izquierda. El admin puede subirle un escudo al grupo en **Admin → Grupo**.

## 4. Cómo se usa

- **Perfil**: cada jugador edita su nombre, apellido, apodo y foto (se redimensiona y comprime en el navegador antes de subirse, y siempre reemplaza la foto anterior).
- **Disponibilidad**: cada jugador marca en su perfil los días que no puede jugar, para todos sus grupos o solo para uno.
- **Grupos**: todo lo que sigue es por grupo. El rol (admin/jugador) también: ser admin de un grupo no da permisos en otro.
- **Partidos**: el admin carga fecha, hora, lugar, rival y los convocados, normalmente antes de jugarse. Hasta que se cargan los goles, el partido es solo un evento (fecha/hora/lugar/convocados, sin resultado ni votación). Cuando termina de jugarse, el admin entra al detalle y carga los goles de cada jugador; recién ahí el partido pasa a "jugado", se calcula el resultado y se abre la votación.
- **Votación** (si el grupo la tiene activada en Admin → Reglas; si no, el grupo solo lleva goles y partidos): una vez jugado el partido, cualquier jugador que haya participado puede votar Mejor Jugador y Peor Jugador (una vez por categoría y partido, y no puede votarse a sí mismo).
- **Estadísticas**: tabla de goleadores históricos, ranking de MVP y ranking de Peor Jugador, calculadas siempre en vivo con funciones agregadas (no hay contadores guardados que se puedan desincronizar).

## 5. Deploy en Vercel

1. Subí este repo a GitHub (o el proveedor que uses).
2. En [vercel.com/new](https://vercel.com/new), importá el repo.
3. En **Environment Variables** cargá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los mismos valores de tu `.env.local`.
4. Deploy. Vercel detecta Next.js automáticamente.

No hace falta configurar nada más del lado de Supabase para producción: la misma URL/keys sirven para local y para Vercel.

## 6. Notificaciones push

La app manda una notificación push (Web Push, sin app nativa) cuando: se crea un partido nuevo, se abre la votación (al cargar los goles) y se cierra la votación (cuando termina de votar todo el mundo, o a los 7 días si no votaron todos).

1. Ejecutá la migración [`0008_push_notifications.sql`](supabase/migrations/0008_push_notifications.sql) en el SQL Editor de Supabase (agrega la tabla de suscripciones y los flags de notificación en `partidos`).
2. En **Project Settings → API** de Supabase copiá la **service_role secret key** y ponela en `SUPABASE_SERVICE_ROLE_KEY` (local: `.env.local`; producción: variables de entorno de Vercel). **Nunca** la expongas al cliente ni la subas a git.
3. Las claves VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`) y el `CRON_SECRET` ya vienen generados en `.env.local`; para producción, copiá esos mismos valores a las variables de entorno de Vercel (o generá un par nuevo con `npx web-push generate-vapid-keys` si preferís).
4. En Vercel, el cron que cierra votaciones vencidas (`vercel.json`) se activa solo al hacer deploy; no requiere nada adicional.
5. Cada jugador activa las notificaciones desde **Perfil → Notificaciones**, aceptando el permiso del navegador.

**iPhone:** Safari solo entrega push a partir de iOS 16.4, y únicamente si la app fue agregada a la pantalla de inicio (Compartir → Agregar a inicio). Si solo la tienen abierta en una pestaña normal, no les va a llegar nada. En Android/Chrome funciona directo, sin instalar nada.

## 7. Panel de admin

En `/admin` (ícono de ajustes arriba a la derecha, solo visible para los admins del grupo activo) se comparte el link de invitación y se renombra el grupo, se configuran las reglas del grupo, se editan los datos de los partidos (fecha, hora, lugar, rival) y se ven los miembros con su email y último ingreso, pudiendo dar o quitar el rol de admin o sacarlos del grupo.

Requiere ejecutar la migración [`0015_admin_config.sql`](supabase/migrations/0015_admin_config.sql) en el SQL Editor de Supabase (agrega la tabla `config` y la columna `partidos.con_votacion`).

## 8. Multi-grupo

La migración [`0016_multi_grupo.sql`](supabase/migrations/0016_multi_grupo.sql) agrega las tablas `grupos` y `grupo_miembros`, pone `grupo_id` en partidos, encuestas y configuración, y reescribe todas las políticas de RLS para que el acceso dependa de ser miembro (o admin) de cada grupo. Si ya tenías datos, los mueve a un primer grupo llamado "Goleadores" con todos los perfiles como miembros y el mismo rol que tenían. El rol global `profiles.rol` desaparece.

Hay que correrla **justo antes de deployar** el código que la usa: el código viejo no funciona con la base nueva ni al revés.

## Estructura del proyecto

```
supabase/migrations/0001_init.sql   Esquema completo (tablas, RLS, triggers, funciones, storage)
src/lib/supabase/                   Clientes de Supabase (browser, server, middleware/proxy)
src/lib/actions/                    Server actions (auth, perfil, partidos, votos, push)
src/lib/push/                       Envío de notificaciones push (web-push)
public/sw.js, public/manifest.json  Service worker y manifest de la PWA
src/app/login, /signup              Autenticación
src/app/perfil                      Editar perfil y foto
src/app/partidos                    Listado, alta (admin) y detalle (goles + votación)
src/app/estadisticas                Las tres tablas de estadísticas
src/app/grupos, /unirse             Crear grupo, sumarse con link de invitación, cambiar de grupo
src/app/admin                       Invitación, reglas, edición de partidos y miembros (admin del grupo)
src/lib/grupo.ts                    Grupo activo (cookie) y membresías del usuario
```
