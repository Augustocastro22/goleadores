-- Goleadores: esquema inicial (tablas, RLS, triggers, funciones de stats, storage)
-- Ejecutar completo en el SQL Editor de Supabase (Project > SQL Editor > New query).

-- ─────────────────────────────────────────────────────────────────────────
-- Tipos
-- ─────────────────────────────────────────────────────────────────────────
create type public.user_role as enum ('admin', 'jugador');
create type public.voto_tipo as enum ('MVP', 'PEOR');

-- ─────────────────────────────────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  apellido text not null default '',
  apodo text not null default '',
  foto_url text,
  rol public.user_role not null default 'jugador',
  created_at timestamptz not null default now()
);

create table public.partidos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  lugar text not null,
  rival text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.partido_jugadores (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos (id) on delete cascade,
  jugador_id uuid not null references public.profiles (id) on delete cascade,
  goles int not null default 0 check (goles >= 0),
  unique (partido_id, jugador_id)
);

create table public.votos (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos (id) on delete cascade,
  jugador_votado_id uuid not null references public.profiles (id) on delete cascade,
  jugador_que_vota_id uuid not null references public.profiles (id) on delete cascade,
  tipo public.voto_tipo not null,
  created_at timestamptz not null default now(),
  unique (partido_id, jugador_que_vota_id, tipo),
  check (jugador_votado_id <> jugador_que_vota_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Alta automática de perfil al registrarse (nombre/apellido/apodo vienen
-- del signup como user_metadata)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, apellido, apodo, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellido', ''),
    coalesce(new.raw_user_meta_data ->> 'apodo', split_part(new.email, '@', 1)),
    'jugador'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- Helper: ¿el usuario actual es admin?
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'admin'
  );
$$;

-- Evita que un jugador se autoasigne el rol admin al editar su propio perfil
-- desde la app. Si auth.uid() es null (SQL Editor / consola de Supabase),
-- se permite el cambio: es cómo se promueve al primer admin.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol is distinct from old.rol and auth.uid() is not null and not public.is_admin() then
    new.rol := old.rol;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_role_escalation();

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.partidos enable row level security;
alter table public.partido_jugadores enable row level security;
alter table public.votos enable row level security;

-- profiles: cualquier usuario logueado puede ver a todos (para elegir
-- jugadores, ver tablas, etc.); cada uno edita solo el suyo, admin edita todos
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- partidos: lectura para todos los logueados, escritura solo admin
create policy "partidos_select_authenticated"
  on public.partidos for select
  to authenticated
  using (true);

create policy "partidos_insert_admin"
  on public.partidos for insert
  to authenticated
  with check (public.is_admin());

create policy "partidos_update_admin"
  on public.partidos for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "partidos_delete_admin"
  on public.partidos for delete
  to authenticated
  using (public.is_admin());

-- partido_jugadores: lectura para todos los logueados, escritura solo admin
create policy "partido_jugadores_select_authenticated"
  on public.partido_jugadores for select
  to authenticated
  using (true);

create policy "partido_jugadores_insert_admin"
  on public.partido_jugadores for insert
  to authenticated
  with check (public.is_admin());

create policy "partido_jugadores_update_admin"
  on public.partido_jugadores for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "partido_jugadores_delete_admin"
  on public.partido_jugadores for delete
  to authenticated
  using (public.is_admin());

-- votos: cada uno ve sus propios votos emitidos (admin ve todos); solo puede
-- insertar un voto propio, para un jugador distinto de sí mismo, y ambos
-- (quien vota y a quien vota) deben haber participado de ese partido
create policy "votos_select_own_or_admin"
  on public.votos for select
  to authenticated
  using (jugador_que_vota_id = auth.uid() or public.is_admin());

create policy "votos_insert_own"
  on public.votos for insert
  to authenticated
  with check (
    jugador_que_vota_id = auth.uid()
    and jugador_votado_id <> jugador_que_vota_id
    and exists (
      select 1 from public.partido_jugadores pj
      where pj.partido_id = votos.partido_id and pj.jugador_id = votos.jugador_votado_id
    )
    and exists (
      select 1 from public.partido_jugadores pj2
      where pj2.partido_id = votos.partido_id and pj2.jugador_id = votos.jugador_que_vota_id
    )
  );

create policy "votos_delete_admin"
  on public.votos for delete
  to authenticated
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- Funciones de estadísticas (SECURITY DEFINER: agregan sin exponer votos
-- individuales, ya que la tabla votos tiene RLS restrictiva)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.get_goleadores()
returns table (
  jugador_id uuid,
  nombre text,
  apellido text,
  apodo text,
  foto_url text,
  goles bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url,
         coalesce(sum(pj.goles), 0) as goles
  from public.profiles p
  left join public.partido_jugadores pj on pj.jugador_id = p.id
  group by p.id
  order by goles desc, p.apellido asc;
$$;

create or replace function public.get_ranking_votos(p_tipo public.voto_tipo)
returns table (
  jugador_id uuid,
  nombre text,
  apellido text,
  apodo text,
  foto_url text,
  votos bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url,
         count(v.id) as votos
  from public.profiles p
  left join public.votos v on v.jugador_votado_id = p.id and v.tipo = p_tipo
  group by p.id
  order by votos desc, p.apellido asc;
$$;

grant execute on function public.get_goleadores() to authenticated;
grant execute on function public.get_ranking_votos(public.voto_tipo) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Storage: bucket de avatars, público de lectura, cada usuario solo puede
-- escribir dentro de su propia carpeta (<uid>/archivo.ext)
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_own_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_own_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_own_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────
-- Para promover al primer admin (vos), después de registrarte corré:
--   update public.profiles set rol = 'admin' where id =
--     (select id from auth.users where email = 'tu-email@ejemplo.com');
-- ─────────────────────────────────────────────────────────────────────────
