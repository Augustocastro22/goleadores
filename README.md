# Goleadores

App para llevar las estadísticas de los partidos de fútbol entre amigos: goles, MVP y Peor Jugador por partido, con tablas históricas.

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

## 3. Crear tu usuario admin

1. En la app, andá a **Registrate** y creá tu cuenta (nombre, apellido, apodo, email, contraseña). Por defecto todos los usuarios nuevos quedan con rol `jugador`.
2. En el **SQL Editor** de Supabase corré (reemplazando el email):

```sql
update public.profiles set rol = 'admin'
where id = (select id from auth.users where email = 'tu-email@ejemplo.com');
```

3. Volvé a iniciar sesión (o refrescá) y ya vas a ver la opción **+ Nuevo partido** en la lista de partidos.

Para el resto de tus amigos: cada uno se registra solo desde `/signup`, no hace falta que vos les crees la cuenta.

## 4. Cómo se usa

- **Perfil**: cada jugador edita su nombre, apellido, apodo y foto (se redimensiona y comprime en el navegador antes de subirse, y siempre reemplaza la foto anterior).
- **Partidos**: el admin carga fecha, lugar, rival y quiénes jugaron. Desde el detalle del partido el admin carga los goles de cada jugador.
- **Votación**: dentro del detalle de un partido, cualquier jugador que haya participado puede votar Mejor Jugador y Peor Jugador (una vez por categoría y partido, y no puede votarse a sí mismo).
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
```
