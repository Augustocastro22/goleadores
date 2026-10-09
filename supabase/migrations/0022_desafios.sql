-- Desafíos entre grupos, etapa 1 (ver docs/plan-desafios.md): el admin de
-- un grupo desafía a otro con su código de desafío, el otro acepta o
-- rechaza, y al aceptar se crea un partido en cada grupo, vinculados por el
-- desafío. Cada grupo arma su convocatoria y carga sus goles como siempre;
-- el otro grupo ve el desafío (nombre, escudo, fecha, estado), nunca sus
-- jugadores ni sus votos.
--
-- Todos los cambios de un desafío van por funciones SECURITY DEFINER: al
-- aceptar se crean partidos en el grupo del otro, que RLS no permitiría.
-- Un desafío pendiente cuya fecha ya pasó se muestra como vencido y ya no
-- se puede aceptar (no hace falta guardarlo, sale de la fecha).

-- ─────────────────────────────────────────────────────────────────────────
-- Código de desafío: distinto del de invitación, que sirve para entrar al
-- grupo y no hay que pasárselo a otro grupo. Cada grupo existente recibe
-- uno propio (el default es volátil, se calcula por fila).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.grupos
  add column codigo_desafio text not null unique default public.generar_codigo_invitacion();

-- ─────────────────────────────────────────────────────────────────────────
-- Desafíos
-- ─────────────────────────────────────────────────────────────────────────
create table public.desafios (
  id uuid primary key default gen_random_uuid(),
  -- Si se borra un grupo el desafío queda (el otro grupo sigue teniendo su
  -- partido), con el nombre que tenía al momento del desafío.
  grupo_desafiante_id uuid references public.grupos (id) on delete set null,
  grupo_desafiado_id uuid references public.grupos (id) on delete set null,
  nombre_desafiante text not null,
  nombre_desafiado text not null,
  fecha date not null,
  hora time,
  lugar text not null check (length(trim(lugar)) between 1 and 100),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptado', 'rechazado', 'cancelado')),
  cancelado_por_grupo_id uuid references public.grupos (id) on delete set null,
  creado_por uuid references public.profiles (id) on delete set null,
  respondido_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (grupo_desafiante_id <> grupo_desafiado_id)
);

create index desafios_desafiante_idx on public.desafios (grupo_desafiante_id);
create index desafios_desafiado_idx on public.desafios (grupo_desafiado_id);

-- Anti-spam: entre dos grupos hay como mucho un desafío pendiente (en
-- cualquiera de los dos sentidos).
create unique index desafios_un_pendiente_por_par
  on public.desafios (
    least(grupo_desafiante_id, grupo_desafiado_id),
    greatest(grupo_desafiante_id, grupo_desafiado_id)
  )
  where estado = 'pendiente';

alter table public.desafios enable row level security;

create policy "desafios_select_miembro"
  on public.desafios for select
  to authenticated
  using (public.es_miembro(grupo_desafiante_id) or public.es_miembro(grupo_desafiado_id));

-- El partido de cada grupo apunta a su desafío (uno por grupo).
alter table public.partidos
  add column desafio_id uuid references public.desafios (id) on delete set null;

create unique index partidos_un_partido_por_desafio_y_grupo
  on public.partidos (desafio_id, grupo_id)
  where desafio_id is not null;

-- Hoy en Argentina (como hoyArgentina en src/lib/confirmacion.ts).
create or replace function public.hoy_argentina()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Lectura
-- ─────────────────────────────────────────────────────────────────────────

-- Nombre y escudo del grupo de un código de desafío, para confirmar a quién
-- se desafía. Solo con el código exacto: no permite listar ni buscar grupos.
create or replace function public.get_grupo_por_codigo_desafio(p_codigo text)
returns table (id uuid, nombre text, logo_url text)
language sql
security definer
stable
set search_path = public
as $$
  select g.id, g.nombre, g.logo_url
  from public.grupos g
  where g.codigo_desafio = trim(p_codigo);
$$;

-- Los desafíos de un grupo, vistos desde ese grupo: el rival (nombre y
-- escudo actuales, o el nombre guardado si el grupo ya no existe) y el
-- partido propio. Con p_desafio_id devuelve solo ese.
create or replace function public.get_desafios(p_grupo_id uuid, p_desafio_id uuid default null)
returns table (
  id uuid,
  estado text,
  fecha date,
  hora time,
  lugar text,
  created_at timestamptz,
  soy_desafiante boolean,
  rival_id uuid,
  rival_nombre text,
  rival_logo_url text,
  partido_id uuid,
  cancelado_por_mi_grupo boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    d.id,
    d.estado,
    d.fecha,
    d.hora,
    d.lugar,
    d.created_at,
    d.grupo_desafiante_id = p_grupo_id,
    rival.id,
    coalesce(
      rival.nombre,
      case when d.grupo_desafiante_id = p_grupo_id then d.nombre_desafiado else d.nombre_desafiante end
    ),
    rival.logo_url,
    pa.id,
    d.cancelado_por_grupo_id = p_grupo_id
  from public.desafios d
  left join public.grupos rival on rival.id = case
    when d.grupo_desafiante_id = p_grupo_id then d.grupo_desafiado_id
    else d.grupo_desafiante_id
  end
  left join public.partidos pa on pa.desafio_id = d.id and pa.grupo_id = p_grupo_id
  where public.es_miembro(p_grupo_id)
    and (d.grupo_desafiante_id = p_grupo_id or d.grupo_desafiado_id = p_grupo_id)
    and (p_desafio_id is null or d.id = p_desafio_id)
  order by d.fecha desc, d.created_at desc;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Cambios
-- ─────────────────────────────────────────────────────────────────────────

-- El admin de p_grupo_id desafía al grupo del código. Devuelve el id del
-- desafío.
create or replace function public.crear_desafio(
  p_grupo_id uuid,
  p_codigo text,
  p_fecha date,
  p_hora time,
  p_lugar text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_propio public.grupos;
  v_rival public.grupos;
  v_id uuid;
begin
  if not public.es_admin_grupo(p_grupo_id) then
    raise exception 'Solo el admin del grupo puede desafiar a otro grupo.';
  end if;

  select * into v_propio from public.grupos where id = p_grupo_id;
  select * into v_rival from public.grupos where codigo_desafio = trim(p_codigo);
  if v_rival.id is null then
    raise exception 'No hay ningún grupo con ese código de desafío.';
  end if;
  if v_rival.id = p_grupo_id then
    raise exception 'Ese es el código de tu propio grupo.';
  end if;
  if p_fecha < public.hoy_argentina() then
    raise exception 'Esa fecha ya pasó.';
  end if;
  if length(trim(coalesce(p_lugar, ''))) = 0 then
    raise exception 'Poné dónde se juega.';
  end if;
  if exists (
    select 1 from public.desafios
    where estado = 'pendiente'
      and least(grupo_desafiante_id, grupo_desafiado_id) = least(p_grupo_id, v_rival.id)
      and greatest(grupo_desafiante_id, grupo_desafiado_id) = greatest(p_grupo_id, v_rival.id)
  ) then
    raise exception 'Ya hay un desafío pendiente con %. Esperá a que se responda.', v_rival.nombre;
  end if;

  insert into public.desafios (
    grupo_desafiante_id, grupo_desafiado_id, nombre_desafiante, nombre_desafiado,
    fecha, hora, lugar, creado_por
  )
  values (
    p_grupo_id, v_rival.id, v_propio.nombre, v_rival.nombre,
    p_fecha, p_hora, trim(p_lugar), auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- El admin del grupo desafiado acepta o rechaza. Al aceptar se crea el
-- partido de cada grupo, sin convocados (cada admin arma su convocatoria).
create or replace function public.responder_desafio(p_desafio_id uuid, p_acepta boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.desafios;
begin
  select * into v from public.desafios where id = p_desafio_id for update;
  if v.id is null or not public.es_admin_grupo(v.grupo_desafiado_id) then
    raise exception 'Solo el admin del grupo desafiado puede responder.';
  end if;
  if v.estado <> 'pendiente' then
    raise exception 'Este desafío ya no está pendiente.';
  end if;
  if v.grupo_desafiante_id is null then
    raise exception 'El grupo que te desafió ya no existe.';
  end if;

  if not p_acepta then
    update public.desafios
    set estado = 'rechazado', respondido_por = auth.uid(), updated_at = now()
    where id = p_desafio_id;
    return;
  end if;

  if v.fecha < public.hoy_argentina() then
    raise exception 'La fecha del desafío ya pasó.';
  end if;

  update public.desafios
  set estado = 'aceptado', respondido_por = auth.uid(), updated_at = now()
  where id = p_desafio_id;

  insert into public.partidos (grupo_id, fecha, hora, lugar, rival, created_by, desafio_id)
  values
    (v.grupo_desafiante_id, v.fecha, v.hora, v.lugar, v.nombre_desafiado, v.creado_por, v.id),
    (v.grupo_desafiado_id, v.fecha, v.hora, v.lugar, v.nombre_desafiante, auth.uid(), v.id);
end;
$$;

-- Un admin de cualquiera de los dos grupos cancela: el desafiante mientras
-- está pendiente (el desafiado rechaza), cualquiera de los dos una vez
-- aceptado, mientras ningún grupo haya cargado el resultado. Se borran los
-- dos partidos (todavía no tienen goles ni votos).
create or replace function public.cancelar_desafio(p_desafio_id uuid, p_grupo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.desafios;
begin
  select * into v from public.desafios where id = p_desafio_id for update;
  if v.id is null
    or not public.es_admin_grupo(p_grupo_id)
    or p_grupo_id not in (v.grupo_desafiante_id, v.grupo_desafiado_id) then
    raise exception 'Solo un admin de los grupos del desafío puede cancelarlo.';
  end if;
  if v.estado = 'pendiente' and p_grupo_id <> v.grupo_desafiante_id then
    raise exception 'Para no aceptar un desafío, rechazalo.';
  end if;
  if v.estado not in ('pendiente', 'aceptado') then
    raise exception 'Este desafío ya no se puede cancelar.';
  end if;
  if exists (select 1 from public.partidos where desafio_id = p_desafio_id and jugado) then
    raise exception 'Ya se cargó el resultado de este partido, no se puede cancelar.';
  end if;

  update public.desafios
  set estado = 'cancelado', cancelado_por_grupo_id = p_grupo_id, updated_at = now()
  where id = p_desafio_id;

  delete from public.partidos where desafio_id = p_desafio_id;
end;
$$;

revoke execute on function public.get_grupo_por_codigo_desafio(text) from public, anon;
revoke execute on function public.get_desafios(uuid, uuid) from public, anon;
revoke execute on function public.crear_desafio(uuid, text, date, time, text) from public, anon;
revoke execute on function public.responder_desafio(uuid, boolean) from public, anon;
revoke execute on function public.cancelar_desafio(uuid, uuid) from public, anon;
grant execute on function public.get_grupo_por_codigo_desafio(text) to authenticated;
grant execute on function public.get_desafios(uuid, uuid) to authenticated;
grant execute on function public.crear_desafio(uuid, text, date, time, text) to authenticated;
grant execute on function public.responder_desafio(uuid, boolean) to authenticated;
grant execute on function public.cancelar_desafio(uuid, uuid) to authenticated;
