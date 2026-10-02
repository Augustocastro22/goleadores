-- Multi-grupo: la app deja de ser de un solo grupo de amigos. Cada partido,
-- encuesta y ajuste de configuración pertenece a un grupo, y el rol
-- (admin/jugador) pasa a ser por grupo en vez de global: un mismo jugador
-- puede ser admin de un grupo y jugador en otro.
--
-- Los datos que ya existen se migran a un primer grupo ("Goleadores") con
-- todos los perfiles actuales como miembros, manteniendo el rol que tenían.
--
-- Cualquiera puede crear un grupo (queda como admin) y sumarse a otro con
-- el código de invitación (link /unirse/<codigo>). Si el admin activa
-- "pedir aprobación", el link no suma directo: deja una solicitud que el
-- admin acepta o rechaza. Todo el acceso se controla por RLS según la
-- membresía: un grupo no ve nada de otro, y una solicitud pendiente no da
-- acceso a nada.

-- ─────────────────────────────────────────────────────────────────────────
-- Tablas nuevas
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.generar_codigo_invitacion()
returns text
language sql
volatile
as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
$$;

create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 60),
  codigo_invitacion text not null unique default public.generar_codigo_invitacion(),
  requiere_aprobacion boolean not null default false,
  logo_url text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.grupo_miembros (
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  jugador_id uuid not null references public.profiles (id) on delete cascade,
  rol public.user_role not null default 'jugador',
  created_at timestamptz not null default now(),
  primary key (grupo_id, jugador_id)
);

create index grupo_miembros_jugador_idx on public.grupo_miembros (jugador_id);

-- Pedidos para entrar a un grupo con aprobación. Mientras está acá, la
-- persona NO es miembro (no aparece en grupo_miembros), así que no ve nada.
create table public.grupo_solicitudes (
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  jugador_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (grupo_id, jugador_id)
);

create index grupo_solicitudes_jugador_idx on public.grupo_solicitudes (jugador_id);

alter table public.grupos enable row level security;
alter table public.grupo_miembros enable row level security;
alter table public.grupo_solicitudes enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- grupo_id en las tablas que cuelgan directo de un grupo. partido_jugadores,
-- votos y desempates se resuelven a través de su partido; encuesta_opciones
-- y encuesta_votos a través de su encuesta.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.partidos add column grupo_id uuid references public.grupos (id) on delete cascade;
alter table public.encuestas add column grupo_id uuid references public.grupos (id) on delete cascade;
alter table public.config add column grupo_id uuid references public.grupos (id) on delete cascade;

-- La disponibilidad sigue siendo de cada jugador, pero ahora un bloqueo
-- puede valer para todos sus grupos (grupo_id null, como hasta ahora) o
-- solo para uno (ej: "los jueves no puedo con este grupo porque juego con
-- el otro").
alter table public.bloqueos_disponibilidad
  add column grupo_id uuid references public.grupos (id) on delete cascade;

-- ─────────────────────────────────────────────────────────────────────────
-- Migración de los datos existentes al primer grupo
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_grupo uuid;
begin
  if exists (select 1 from public.profiles) then
    insert into public.grupos (nombre, created_by)
    values (
      'Goleadores',
      (select id from public.profiles where rol = 'admin' order by created_at limit 1)
    )
    returning id into v_grupo;

    insert into public.grupo_miembros (grupo_id, jugador_id, rol, created_at)
    select v_grupo, id, rol, created_at from public.profiles;

    update public.partidos set grupo_id = v_grupo;
    update public.encuestas set grupo_id = v_grupo;
    update public.config set grupo_id = v_grupo;
  end if;
end $$;

-- En una instalación nueva (sin perfiles) quedan filas de config sin grupo
-- (el valor por defecto que insertó 0015): no sirven, el código ya tiene
-- sus propios defaults.
delete from public.config where grupo_id is null;

alter table public.partidos alter column grupo_id set not null;
alter table public.encuestas alter column grupo_id set not null;
alter table public.config alter column grupo_id set not null;

create index partidos_grupo_idx on public.partidos (grupo_id, fecha desc);
create index encuestas_grupo_idx on public.encuestas (grupo_id, created_at desc);

-- La configuración pasa a ser por grupo.
alter table public.config drop constraint config_pkey;
alter table public.config add primary key (grupo_id, clave);

-- ─────────────────────────────────────────────────────────────────────────
-- Helpers de membresía (SECURITY DEFINER para que las políticas puedan
-- consultar grupo_miembros/partidos sin recursión de RLS)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.es_miembro(p_grupo_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.grupo_miembros
    where grupo_id = p_grupo_id and jugador_id = auth.uid()
  );
$$;

create or replace function public.es_admin_grupo(p_grupo_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.grupo_miembros
    where grupo_id = p_grupo_id and jugador_id = auth.uid() and rol = 'admin'
  );
$$;

-- ¿p_jugador_id es miembro de p_grupo_id? (no depende del usuario actual)
create or replace function public.jugador_en_grupo(p_grupo_id uuid, p_jugador_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.grupo_miembros
    where grupo_id = p_grupo_id and jugador_id = p_jugador_id
  );
$$;

-- Límite anti-abuso: una persona puede pertenecer a lo sumo a 5 grupos
-- (contando los que creó y a los que se sumó). Para cambiarlo, tocá el
-- número acá: lo usan el trigger de abajo y unirse_grupo.
create or replace function public.limite_grupos()
returns int
language sql
immutable
as $$
  select 5;
$$;

-- Se aplica a cualquier alta en grupo_miembros: crear un grupo, sumarse
-- con el link o que un admin acepte una solicitud.
create or replace function public.check_limite_grupos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.grupo_miembros where jugador_id = new.jugador_id)
      >= public.limite_grupos() then
    if new.jugador_id = auth.uid() then
      raise exception 'Ya estás en el máximo de % grupos. Salí de alguno para sumarte a otro.',
        public.limite_grupos();
    else
      raise exception 'Esta persona ya está en el máximo de % grupos.', public.limite_grupos();
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_limite_grupos
  before insert on public.grupo_miembros
  for each row execute procedure public.check_limite_grupos();

create or replace function public.grupo_de_partido(p_partido_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select grupo_id from public.partidos where id = p_partido_id;
$$;

create or replace function public.grupo_de_encuesta(p_encuesta_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select grupo_id from public.encuestas where id = p_encuesta_id;
$$;

-- ¿El usuario actual puede ver el perfil de p_jugador_id? Sí si comparten
-- algún grupo, si p_jugador_id jugó algún partido de un grupo del usuario
-- (así un jugador que se fue del grupo sigue apareciendo en el historial
-- de los partidos que jugó), o si pidió entrar a un grupo del que el
-- usuario es admin (para saber a quién está aceptando).
create or replace function public.puede_ver_perfil(p_jugador_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    p_jugador_id = auth.uid()
    or exists (
      select 1
      from public.grupo_miembros yo
      join public.grupo_miembros otro on otro.grupo_id = yo.grupo_id
      where yo.jugador_id = auth.uid() and otro.jugador_id = p_jugador_id
    )
    or exists (
      select 1
      from public.partido_jugadores pj
      join public.partidos pa on pa.id = pj.partido_id
      join public.grupo_miembros yo on yo.grupo_id = pa.grupo_id
      where yo.jugador_id = auth.uid() and pj.jugador_id = p_jugador_id
    )
    or exists (
      select 1
      from public.grupo_solicitudes s
      join public.grupo_miembros yo on yo.grupo_id = s.grupo_id and yo.rol = 'admin'
      where yo.jugador_id = auth.uid() and s.jugador_id = p_jugador_id
    );
$$;

-- ¿El usuario actual es admin de algún grupo del que p_jugador_id es
-- miembro? (para ver su disponibilidad al armar la convocatoria)
create or replace function public.es_admin_de(p_jugador_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.grupo_miembros yo
    join public.grupo_miembros otro on otro.grupo_id = yo.grupo_id
    where yo.jugador_id = auth.uid() and yo.rol = 'admin' and otro.jugador_id = p_jugador_id
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Alta de grupos y membresías (solo vía estas funciones: no hay política de
-- insert directa sobre grupos ni grupo_miembros)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.crear_grupo(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  -- Si ya está en el máximo de grupos, el trigger de grupo_miembros corta
  -- el insert de abajo y se deshace también el grupo recién creado.
  insert into public.grupos (nombre, created_by)
  values (trim(p_nombre), auth.uid())
  returning id into v_grupo;

  insert into public.grupo_miembros (grupo_id, jugador_id, rol)
  values (v_grupo, auth.uid(), 'admin');

  return v_grupo;
end;
$$;

-- Usa un código de invitación. Devuelve null si el código no existe, o
-- {"grupo_id": ..., "estado": "miembro" | "pendiente"}: "miembro" si entró
-- (o ya era miembro), "pendiente" si el grupo pide aprobación y quedó la
-- solicitud cargada para que la vea el admin.
create or replace function public.unirse_grupo(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo uuid;
  v_requiere_aprobacion boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select id, requiere_aprobacion into v_grupo, v_requiere_aprobacion
  from public.grupos
  where codigo_invitacion = trim(p_codigo);
  if v_grupo is null then
    return null;
  end if;

  if public.jugador_en_grupo(v_grupo, auth.uid()) then
    return jsonb_build_object('grupo_id', v_grupo, 'estado', 'miembro');
  end if;

  if v_requiere_aprobacion then
    -- Mismo límite que el trigger, chequeado antes para no dejar una
    -- solicitud que después no se va a poder aceptar.
    if (select count(*) from public.grupo_miembros where jugador_id = auth.uid())
        >= public.limite_grupos() then
      raise exception 'Ya estás en el máximo de % grupos. Salí de alguno para sumarte a otro.',
        public.limite_grupos();
    end if;

    insert into public.grupo_solicitudes (grupo_id, jugador_id)
    values (v_grupo, auth.uid())
    on conflict (grupo_id, jugador_id) do nothing;
    return jsonb_build_object('grupo_id', v_grupo, 'estado', 'pendiente');
  end if;

  insert into public.grupo_miembros (grupo_id, jugador_id, rol)
  values (v_grupo, auth.uid(), 'jugador')
  on conflict (grupo_id, jugador_id) do nothing;

  return jsonb_build_object('grupo_id', v_grupo, 'estado', 'miembro');
end;
$$;

-- El admin acepta una solicitud: pasa a ser miembro (jugador). Devuelve
-- false si la solicitud ya no existía (la canceló o la aceptó otro admin).
-- Para rechazar alcanza con borrar la fila (ver política de delete).
create or replace function public.aceptar_solicitud(p_grupo_id uuid, p_jugador_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_grupo(p_grupo_id) then
    raise exception 'Solo el admin del grupo puede aceptar solicitudes';
  end if;

  delete from public.grupo_solicitudes
  where grupo_id = p_grupo_id and jugador_id = p_jugador_id;
  if not found then
    return false;
  end if;

  insert into public.grupo_miembros (grupo_id, jugador_id, rol)
  values (p_grupo_id, p_jugador_id, 'jugador')
  on conflict (grupo_id, jugador_id) do nothing;

  return true;
end;
$$;

-- Para la pantalla de invitación: nombre y escudo del grupo, cantidad de
-- miembros, si pide aprobación y si el usuario ya tiene una solicitud
-- pendiente, antes de sumarse (todavía no es miembro, así que RLS no lo
-- dejaría ver).
create or replace function public.get_grupo_por_codigo(p_codigo text)
returns table (
  id uuid,
  nombre text,
  logo_url text,
  miembros bigint,
  requiere_aprobacion boolean,
  pendiente boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.id,
    g.nombre,
    g.logo_url,
    (select count(*) from public.grupo_miembros gm where gm.grupo_id = g.id),
    g.requiere_aprobacion,
    exists (
      select 1 from public.grupo_solicitudes s
      where s.grupo_id = g.id and s.jugador_id = auth.uid()
    )
  from public.grupos g
  where g.codigo_invitacion = trim(p_codigo);
$$;

grant execute on function public.crear_grupo(text) to authenticated;
grant execute on function public.unirse_grupo(text) to authenticated;
grant execute on function public.aceptar_solicitud(uuid, uuid) to authenticated;
grant execute on function public.get_grupo_por_codigo(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Fuera el rol global
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "partidos_select_authenticated" on public.partidos;
drop policy if exists "partidos_insert_admin" on public.partidos;
drop policy if exists "partidos_update_admin" on public.partidos;
drop policy if exists "partidos_delete_admin" on public.partidos;
drop policy if exists "partido_jugadores_select_authenticated" on public.partido_jugadores;
drop policy if exists "partido_jugadores_insert_admin" on public.partido_jugadores;
drop policy if exists "partido_jugadores_update_admin" on public.partido_jugadores;
drop policy if exists "partido_jugadores_delete_admin" on public.partido_jugadores;
drop policy if exists "votos_select_own_or_admin" on public.votos;
drop policy if exists "votos_insert_own" on public.votos;
drop policy if exists "votos_delete_admin" on public.votos;
drop policy if exists "desempates_select_elegible_o_resuelto" on public.desempates;
drop policy if exists "desempates_delete_admin" on public.desempates;
drop policy if exists "desempate_votos_select_own_or_admin" on public.desempate_votos;
drop policy if exists "desempate_votos_insert_own" on public.desempate_votos;
drop policy if exists "desempate_votos_delete_admin" on public.desempate_votos;
drop policy if exists "bloqueos_select_own_or_admin" on public.bloqueos_disponibilidad;
drop policy if exists "bloqueos_insert_own" on public.bloqueos_disponibilidad;
drop policy if exists "encuestas_select_authenticated" on public.encuestas;
drop policy if exists "encuestas_insert_own" on public.encuestas;
drop policy if exists "encuestas_delete_creador_o_admin" on public.encuestas;
drop policy if exists "encuesta_opciones_select_authenticated" on public.encuesta_opciones;
drop policy if exists "encuesta_opciones_insert_creador" on public.encuesta_opciones;
drop policy if exists "encuesta_opciones_delete_creador_o_admin" on public.encuesta_opciones;
drop policy if exists "encuesta_votos_select_own_or_admin" on public.encuesta_votos;
drop policy if exists "encuesta_votos_insert_own" on public.encuesta_votos;
drop policy if exists "encuesta_votos_delete_creador_o_admin" on public.encuesta_votos;
drop policy if exists "config_select_authenticated" on public.config;
drop policy if exists "config_insert_admin" on public.config;
drop policy if exists "config_update_admin" on public.config;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
drop function if exists public.prevent_role_escalation();
drop function if exists public.is_admin();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, apellido, apodo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellido', ''),
    coalesce(new.raw_user_meta_data ->> 'apodo', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

alter table public.profiles drop column rol;

-- ─────────────────────────────────────────────────────────────────────────
-- Políticas nuevas
-- ─────────────────────────────────────────────────────────────────────────

-- grupos: lo ven sus miembros (y quien pidió entrar, solo para ver el
-- nombre en "solicitudes pendientes"); el admin lo renombra, regenera el
-- código o activa la aprobación.
create policy "grupos_select_miembro_o_solicitante"
  on public.grupos for select
  to authenticated
  using (
    public.es_miembro(id)
    or exists (
      select 1 from public.grupo_solicitudes s
      where s.grupo_id = grupos.id and s.jugador_id = auth.uid()
    )
  );

create policy "grupos_update_admin"
  on public.grupos for update
  to authenticated
  using (public.es_admin_grupo(id))
  with check (public.es_admin_grupo(id));

-- grupo_miembros: los miembros se ven entre sí; el admin cambia roles y
-- saca gente; cada uno puede irse solo.
create policy "grupo_miembros_select_miembro"
  on public.grupo_miembros for select
  to authenticated
  using (public.es_miembro(grupo_id));

create policy "grupo_miembros_update_admin"
  on public.grupo_miembros for update
  to authenticated
  using (public.es_admin_grupo(grupo_id))
  with check (public.es_admin_grupo(grupo_id));

create policy "grupo_miembros_delete_admin_o_propio"
  on public.grupo_miembros for delete
  to authenticated
  using (jugador_id = auth.uid() or public.es_admin_grupo(grupo_id));

-- grupo_solicitudes: las ve quien la hizo y el admin del grupo; se
-- cargan solo vía unirse_grupo. Borrar = cancelar (el que la hizo) o
-- rechazar (el admin); aceptar es vía aceptar_solicitud.
create policy "grupo_solicitudes_select_propia_o_admin"
  on public.grupo_solicitudes for select
  to authenticated
  using (jugador_id = auth.uid() or public.es_admin_grupo(grupo_id));

create policy "grupo_solicitudes_delete_propia_o_admin"
  on public.grupo_solicitudes for delete
  to authenticated
  using (jugador_id = auth.uid() or public.es_admin_grupo(grupo_id));

-- profiles: cada uno ve a la gente de sus grupos y edita solo el suyo.
create policy "profiles_select_compartido"
  on public.profiles for select
  to authenticated
  using (public.puede_ver_perfil(id));

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- partidos: los ven los miembros del grupo, los gestiona su admin.
create policy "partidos_select_miembro"
  on public.partidos for select
  to authenticated
  using (public.es_miembro(grupo_id));

create policy "partidos_insert_admin"
  on public.partidos for insert
  to authenticated
  with check (public.es_admin_grupo(grupo_id));

create policy "partidos_update_admin"
  on public.partidos for update
  to authenticated
  using (public.es_admin_grupo(grupo_id))
  with check (public.es_admin_grupo(grupo_id));

create policy "partidos_delete_admin"
  on public.partidos for delete
  to authenticated
  using (public.es_admin_grupo(grupo_id));

-- partido_jugadores: igual que su partido, y solo se puede convocar a
-- miembros del grupo.
create policy "partido_jugadores_select_miembro"
  on public.partido_jugadores for select
  to authenticated
  using (public.es_miembro(public.grupo_de_partido(partido_id)));

create policy "partido_jugadores_insert_admin"
  on public.partido_jugadores for insert
  to authenticated
  with check (
    public.es_admin_grupo(public.grupo_de_partido(partido_id))
    and public.jugador_en_grupo(public.grupo_de_partido(partido_id), jugador_id)
  );

create policy "partido_jugadores_update_admin"
  on public.partido_jugadores for update
  to authenticated
  using (public.es_admin_grupo(public.grupo_de_partido(partido_id)))
  with check (public.es_admin_grupo(public.grupo_de_partido(partido_id)));

create policy "partido_jugadores_delete_admin"
  on public.partido_jugadores for delete
  to authenticated
  using (public.es_admin_grupo(public.grupo_de_partido(partido_id)));

-- votos: mismas reglas que antes, con el "admin" acotado al grupo del partido.
create policy "votos_select_own_or_admin"
  on public.votos for select
  to authenticated
  using (
    jugador_que_vota_id = auth.uid()
    or public.es_admin_grupo(public.grupo_de_partido(partido_id))
  );

create policy "votos_insert_own"
  on public.votos for insert
  to authenticated
  with check (
    jugador_que_vota_id = auth.uid()
    and jugador_votado_id <> jugador_que_vota_id
    and public.es_miembro(public.grupo_de_partido(partido_id))
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
  using (public.es_admin_grupo(public.grupo_de_partido(partido_id)));

-- desempates
create policy "desempates_select_elegible_o_resuelto"
  on public.desempates for select
  to authenticated
  using (
    public.es_miembro(public.grupo_de_partido(partido_id))
    and (
      resuelto
      or auth.uid() = any(elegibles)
      or public.es_admin_grupo(public.grupo_de_partido(partido_id))
    )
  );

create policy "desempates_delete_admin"
  on public.desempates for delete
  to authenticated
  using (public.es_admin_grupo(public.grupo_de_partido(partido_id)));

create policy "desempate_votos_select_own_or_admin"
  on public.desempate_votos for select
  to authenticated
  using (
    jugador_que_vota_id = auth.uid()
    or exists (
      select 1 from public.desempates d
      where d.id = desempate_votos.desempate_id
        and public.es_admin_grupo(public.grupo_de_partido(d.partido_id))
    )
  );

create policy "desempate_votos_insert_own"
  on public.desempate_votos for insert
  to authenticated
  with check (
    jugador_que_vota_id = auth.uid()
    and exists (
      select 1 from public.desempates d
      where d.id = desempate_votos.desempate_id
        and not d.resuelto
        and auth.uid() = any(d.elegibles)
        and desempate_votos.jugador_votado_id = any(d.candidatos)
    )
  );

create policy "desempate_votos_delete_admin"
  on public.desempate_votos for delete
  to authenticated
  using (
    exists (
      select 1 from public.desempates d
      where d.id = desempate_votos.desempate_id
        and public.es_admin_grupo(public.grupo_de_partido(d.partido_id))
    )
  );

-- bloqueos_disponibilidad: son de cada jugador. Uno general (sin grupo)
-- lo ve el admin de cualquier grupo del jugador; uno de un grupo puntual,
-- solo el admin de ese grupo.
create policy "bloqueos_select_own_or_admin"
  on public.bloqueos_disponibilidad for select
  to authenticated
  using (
    jugador_id = auth.uid()
    or (grupo_id is null and public.es_admin_de(jugador_id))
    or (
      grupo_id is not null
      and public.es_admin_grupo(grupo_id)
      and public.jugador_en_grupo(grupo_id, jugador_id)
    )
  );

create policy "bloqueos_insert_own"
  on public.bloqueos_disponibilidad for insert
  to authenticated
  with check (
    jugador_id = auth.uid()
    and (grupo_id is null or public.es_miembro(grupo_id))
  );

-- encuestas
create policy "encuestas_select_miembro"
  on public.encuestas for select
  to authenticated
  using (public.es_miembro(grupo_id));

create policy "encuestas_insert_miembro"
  on public.encuestas for insert
  to authenticated
  with check (creado_por = auth.uid() and public.es_miembro(grupo_id));

create policy "encuestas_delete_creador_o_admin"
  on public.encuestas for delete
  to authenticated
  using (creado_por = auth.uid() or public.es_admin_grupo(grupo_id));

create policy "encuesta_opciones_select_miembro"
  on public.encuesta_opciones for select
  to authenticated
  using (public.es_miembro(public.grupo_de_encuesta(encuesta_id)));

create policy "encuesta_opciones_insert_creador"
  on public.encuesta_opciones for insert
  to authenticated
  with check (
    exists (
      select 1 from public.encuestas e
      where e.id = encuesta_opciones.encuesta_id and e.creado_por = auth.uid()
    )
  );

create policy "encuesta_opciones_delete_creador_o_admin"
  on public.encuesta_opciones for delete
  to authenticated
  using (
    public.es_admin_grupo(public.grupo_de_encuesta(encuesta_id))
    or exists (
      select 1 from public.encuestas e
      where e.id = encuesta_opciones.encuesta_id and e.creado_por = auth.uid()
    )
  );

create policy "encuesta_votos_select_own_or_admin"
  on public.encuesta_votos for select
  to authenticated
  using (
    jugador_id = auth.uid()
    or public.es_admin_grupo(public.grupo_de_encuesta(encuesta_id))
  );

create policy "encuesta_votos_insert_own"
  on public.encuesta_votos for insert
  to authenticated
  with check (
    jugador_id = auth.uid()
    and public.es_miembro(public.grupo_de_encuesta(encuesta_id))
    and exists (
      select 1 from public.encuesta_opciones eo
      where eo.id = encuesta_votos.opcion_id and eo.encuesta_id = encuesta_votos.encuesta_id
    )
  );

create policy "encuesta_votos_delete_creador_o_admin"
  on public.encuesta_votos for delete
  to authenticated
  using (
    public.es_admin_grupo(public.grupo_de_encuesta(encuesta_id))
    or exists (
      select 1 from public.encuestas e
      where e.id = encuesta_votos.encuesta_id and e.creado_por = auth.uid()
    )
  );

-- config
create policy "config_select_miembro"
  on public.config for select
  to authenticated
  using (public.es_miembro(grupo_id));

create policy "config_insert_admin"
  on public.config for insert
  to authenticated
  with check (public.es_admin_grupo(grupo_id));

create policy "config_update_admin"
  on public.config for update
  to authenticated
  using (public.es_admin_grupo(grupo_id))
  with check (public.es_admin_grupo(grupo_id));

-- ─────────────────────────────────────────────────────────────────────────
-- Funciones de estadísticas: ahora reciben el grupo, y todas las que son
-- SECURITY DEFINER verifican que quien llama sea miembro (si no, no
-- devuelven nada).
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.get_goleadores();
drop function if exists public.get_ranking_votos(public.voto_tipo);

create or replace function public.get_goleadores(p_grupo_id uuid)
returns table (
  jugador_id uuid,
  nombre text,
  apellido text,
  apodo text,
  foto_url text,
  goles bigint,
  partidos_jugados bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url,
         coalesce(sum(pj.goles) filter (where pa.jugado), 0) as goles,
         count(pj.id) filter (where pa.jugado) as partidos_jugados
  from public.grupo_miembros gm
  join public.profiles p on p.id = gm.jugador_id
  left join public.partido_jugadores pj
    on pj.jugador_id = p.id
    and pj.partido_id in (select id from public.partidos where grupo_id = p_grupo_id)
  left join public.partidos pa on pa.id = pj.partido_id
  where gm.grupo_id = p_grupo_id and public.es_miembro(p_grupo_id)
  group by p.id
  order by goles desc, p.apellido asc;
$$;

create or replace function public.get_ranking_votos(p_grupo_id uuid, p_tipo public.voto_tipo)
returns table (
  jugador_id uuid,
  nombre text,
  apellido text,
  apodo text,
  foto_url text,
  veces_elegido bigint,
  partidos_jugados bigint
)
language sql
security definer
stable
set search_path = public
as $$
  with cerrados as (
    select pa.id
    from public.partidos pa
    where
      pa.grupo_id = p_grupo_id
      and pa.jugado
      and (
        pa.fecha < (current_date - 7)
        or (
          (select count(*) from public.votos v where v.partido_id = pa.id and v.tipo = 'MVP')
            >= greatest((select count(*) from public.partido_jugadores pj where pj.partido_id = pa.id), 1)
          and
          (select count(*) from public.votos v where v.partido_id = pa.id and v.tipo = 'PEOR')
            >= greatest((select count(*) from public.partido_jugadores pj where pj.partido_id = pa.id), 1)
        )
      )
  ),
  conteo_por_partido as (
    select v.partido_id, v.jugador_votado_id, count(*) as votos
    from public.votos v
    where v.tipo = p_tipo and v.partido_id in (select id from cerrados)
    group by v.partido_id, v.jugador_votado_id
  ),
  maximos as (
    select partido_id, max(votos) as max_votos
    from conteo_por_partido
    group by partido_id
  ),
  desempatados as (
    select partido_id, ganador_id
    from public.desempates
    where tipo = p_tipo and resuelto and ganador_id is not null
      and partido_id in (select id from cerrados)
  ),
  ganadores as (
    select cp.jugador_votado_id, cp.partido_id
    from conteo_por_partido cp
    join maximos m on m.partido_id = cp.partido_id and m.max_votos = cp.votos
    where not exists (select 1 from desempatados d where d.partido_id = cp.partido_id)
    union all
    select ganador_id as jugador_votado_id, partido_id
    from desempatados
  )
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url,
         count(g.partido_id) as veces_elegido,
         (
           select count(*)
           from public.partido_jugadores pj
           join public.partidos pa on pa.id = pj.partido_id
           where pj.jugador_id = p.id and pa.jugado and pa.grupo_id = p_grupo_id
         ) as partidos_jugados
  from public.grupo_miembros gm
  join public.profiles p on p.id = gm.jugador_id
  left join ganadores g on g.jugador_votado_id = p.id
  where gm.grupo_id = p_grupo_id and public.es_miembro(p_grupo_id)
  group by p.id
  order by veces_elegido desc, p.apellido asc;
$$;

grant execute on function public.get_goleadores(uuid) to authenticated;
grant execute on function public.get_ranking_votos(uuid, public.voto_tipo) to authenticated;

create or replace function public.get_estado_votacion(p_partido_id uuid)
returns table (
  total_participantes bigint,
  votos_mvp bigint,
  votos_peor bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    (select count(*) from public.partido_jugadores where partido_id = p_partido_id) as total_participantes,
    (select count(*) from public.votos where partido_id = p_partido_id and tipo = 'MVP') as votos_mvp,
    (select count(*) from public.votos where partido_id = p_partido_id and tipo = 'PEOR') as votos_peor
  where public.es_miembro(public.grupo_de_partido(p_partido_id));
$$;

create or replace function public.get_ganadores_votacion(p_partido_id uuid, p_tipo public.voto_tipo)
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
  with conteo as (
    select v.jugador_votado_id, count(*) as votos
    from public.votos v
    where v.partido_id = p_partido_id and v.tipo = p_tipo
    group by v.jugador_votado_id
  ), maximo as (
    select coalesce(max(votos), 0) as max_votos from conteo
  ), definido as (
    select ganador_id
    from public.desempates
    where partido_id = p_partido_id and tipo = p_tipo and resuelto and ganador_id is not null
  )
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url, c.votos
  from conteo c
  join public.profiles p on p.id = c.jugador_votado_id
  cross join maximo m
  where c.votos = m.max_votos and m.max_votos > 0
    and (not exists (select 1 from definido) or p.id = (select ganador_id from definido))
    and public.es_miembro(public.grupo_de_partido(p_partido_id));
$$;

create or replace function public.get_desglose_votos(p_partido_id uuid, p_tipo public.voto_tipo)
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
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url, count(*) as votos
  from public.votos v
  join public.profiles p on p.id = v.jugador_votado_id
  where v.partido_id = p_partido_id and v.tipo = p_tipo
    and public.es_miembro(public.grupo_de_partido(p_partido_id))
  group by p.id
  order by votos desc, p.apellido asc;
$$;

create or replace function public.get_resultados_encuesta(p_encuesta_id uuid)
returns table (opcion_id uuid, votos bigint)
language sql
security definer
stable
set search_path = public
as $$
  select eo.id as opcion_id, count(ev.id) as votos
  from public.encuesta_opciones eo
  left join public.encuesta_votos ev on ev.opcion_id = eo.id
  where eo.encuesta_id = p_encuesta_id
    and public.es_miembro(public.grupo_de_encuesta(p_encuesta_id))
  group by eo.id;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Storage: bucket de escudos de grupo, público de lectura (se muestran en
-- la invitación antes de sumarse). Solo el admin del grupo escribe, y solo
-- dentro de la carpeta de su grupo (<grupo_id>/logo.png).
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create or replace function public.es_admin_carpeta_logo(p_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.grupo_miembros
    where grupo_id::text = (storage.foldername(p_name))[1]
      and jugador_id = auth.uid()
      and rol = 'admin'
  );
$$;

create policy "logos_public_read"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "logos_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'logos' and public.es_admin_carpeta_logo(name));

create policy "logos_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'logos' and public.es_admin_carpeta_logo(name));

create policy "logos_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'logos' and public.es_admin_carpeta_logo(name));
