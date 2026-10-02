-- Borrado de cuenta (ver eliminarCuenta en src/lib/actions/cuenta.ts).
--
-- Cuando alguien borra su cuenta se elimina su usuario de auth (email y
-- contraseña) y todo lo que lo identifica, pero el perfil queda anonimizado
-- ("Jugador eliminado") para que sus goles, convocatorias y votos sigan
-- existiendo: si se borraran, cambiarían los resultados de partidos ya
-- jugados y las estadísticas del resto del grupo.
--
-- Para eso el perfil deja de borrarse en cascada con el usuario de auth:
-- se quita la FK profiles.id -> auth.users. El alta sigue igual (el trigger
-- handle_new_user crea el perfil con el mismo id que el usuario).

do $$
declare
  c text;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end $$;

-- Cuándo se borró la cuenta (null = cuenta activa).
alter table public.profiles add column eliminado_en timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- Votos secretos de verdad: hasta ahora el admin del grupo podía leer los
-- votos individuales consultando la base directamente (la app nunca los
-- mostraba). Ahora cada uno ve solo los suyos. Los conteos y resultados
-- salen de funciones SECURITY DEFINER y del servidor (service role), así
-- que no cambia nada de lo que se ve en la app.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "votos_select_own_or_admin" on public.votos;
create policy "votos_select_own"
  on public.votos for select
  to authenticated
  using (jugador_que_vota_id = auth.uid());

drop policy if exists "desempate_votos_select_own_or_admin" on public.desempate_votos;
create policy "desempate_votos_select_own"
  on public.desempate_votos for select
  to authenticated
  using (jugador_que_vota_id = auth.uid());

drop policy if exists "encuesta_votos_select_own_or_admin" on public.encuesta_votos;
create policy "encuesta_votos_select_own"
  on public.encuesta_votos for select
  to authenticated
  using (jugador_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- Formulario de contacto (/contacto): el canal para consultas y pedidos
-- sobre datos personales (por ejemplo, borrar la cuenta de alguien que ya
-- no puede entrar). Se puede usar sin sesión. RLS activada y sin políticas:
-- nadie la lee ni la escribe desde la app con su sesión; el servidor
-- inserta con la service role (ver src/lib/actions/contacto.ts) y los
-- mensajes se leen desde el panel de Supabase.
-- ─────────────────────────────────────────────────────────────────────────
create table public.mensajes_contacto (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Si estaba logueado. Los perfiles no se borran (ver arriba), así que
  -- alcanza con la referencia.
  user_id uuid references public.profiles (id),
  motivo text not null check (motivo in ('borrar_cuenta', 'mis_datos', 'otro')),
  nombre text not null check (length(nombre) between 1 and 100),
  email text not null check (length(email) between 3 and 200),
  mensaje text not null check (length(mensaje) between 1 and 2000),
  atendido boolean not null default false
);

create index mensajes_contacto_email_idx on public.mensajes_contacto (email, created_at desc);

alter table public.mensajes_contacto enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- Login con Google: el alta automática del perfil ahora también toma el
-- nombre que manda Google (full_name/name), porque esa gente no pasa por el
-- formulario de registro. La foto de Google no se usa: el perfil arranca sin
-- foto y cada uno sube la suya. Con el registro por email sigue igual
-- (nombre, apellido y apodo vienen del formulario).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_completo text := trim(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', ''));
  v_primero text := split_part(v_completo, ' ', 1);
  v_resto text := trim(substr(v_completo, length(split_part(v_completo, ' ', 1)) + 1));
begin
  insert into public.profiles (id, nombre, apellido, apodo)
  values (
    new.id,
    coalesce(nullif(v_meta ->> 'nombre', ''), v_primero),
    coalesce(nullif(v_meta ->> 'apellido', ''), v_resto),
    coalesce(nullif(v_meta ->> 'apodo', ''), nullif(v_primero, ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
