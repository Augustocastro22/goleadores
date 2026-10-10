-- Canchas de cada grupo. Antes el lugar de un partido era solo texto, y la
-- misma cancha quedaba escrita de varias formas ("Green Park", "green park").
-- Ahora cada grupo tiene su lista de canchas y cada partido apunta a una
-- (partidos.cancha_id). partidos.lugar se sigue guardando: es lo que muestra
-- la app y, en un desafío, lo que acordaron los dos grupos.
--
-- No hace falta elegir la cancha a mano en ningún lado: un trigger busca (o
-- crea) la cancha del grupo con ese nombre cada vez que se guarda un lugar.
-- Así funciona igual para un partido nuevo, uno editado, un desafío aceptado
-- (cada grupo con su propia cancha) o una fecha nueva de un desafío.

-- Para comparar nombres: sin mayúsculas, tildes ni espacios de más.
create or replace function public.normalizar_lugar(p text)
returns text
language sql
immutable
as $$
  select lower(translate(regexp_replace(trim(p), '\s+', ' ', 'g'), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'));
$$;

-- El nombre como se guarda: sin espacios de más.
create or replace function public.limpiar_lugar(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(trim(p), '\s+', ' ', 'g');
$$;

create table public.canchas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 100),
  created_at timestamptz not null default now()
);

create unique index canchas_grupo_nombre on public.canchas (grupo_id, public.normalizar_lugar(nombre));

alter table public.canchas enable row level security;

create policy "canchas_select_miembro"
  on public.canchas for select
  to authenticated
  using (public.es_miembro(grupo_id));

-- Renombrar y unificar van por RPC (tocan también los partidos). Borrar, solo
-- si no tiene partidos (lo controla la action).
create policy "canchas_delete_admin"
  on public.canchas for delete
  to authenticated
  using (public.es_admin_grupo(grupo_id));

alter table public.partidos
  add column cancha_id uuid references public.canchas (id) on delete set null;

create index partidos_cancha_idx on public.partidos (cancha_id);

-- ═════════════════════════════════════════════════════════════════════════
-- Las canchas de los partidos que ya existen
-- ═════════════════════════════════════════════════════════════════════════
-- Una por cada lugar distinto de cada grupo, con la forma de escribirlo más
-- usada (y si empatan, la más reciente).
insert into public.canchas (grupo_id, nombre)
select distinct on (grupo_id, public.normalizar_lugar(lugar))
  grupo_id, public.limpiar_lugar(lugar)
from (
  select grupo_id, lugar,
    count(*) over (partition by grupo_id, public.limpiar_lugar(lugar)) as usos,
    created_at
  from public.partidos
  where trim(lugar) <> ''
) p
order by grupo_id, public.normalizar_lugar(lugar), usos desc, created_at desc;

update public.partidos p
set cancha_id = c.id
from public.canchas c
where c.grupo_id = p.grupo_id
  and public.normalizar_lugar(c.nombre) = public.normalizar_lugar(p.lugar);

-- ═════════════════════════════════════════════════════════════════════════
-- Cada lugar que se guarda queda con su cancha
-- ═════════════════════════════════════════════════════════════════════════
create or replace function public.cancha_para(p_grupo_id uuid, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_nombre is null or trim(p_nombre) = '' then
    return null;
  end if;
  select id into v_id from public.canchas
  where grupo_id = p_grupo_id and public.normalizar_lugar(nombre) = public.normalizar_lugar(p_nombre);
  if v_id is null then
    insert into public.canchas (grupo_id, nombre)
    values (p_grupo_id, public.limpiar_lugar(p_nombre))
    on conflict (grupo_id, public.normalizar_lugar(nombre)) do nothing
    returning id into v_id;
    -- Si otro la creó al mismo tiempo.
    if v_id is null then
      select id into v_id from public.canchas
      where grupo_id = p_grupo_id and public.normalizar_lugar(nombre) = public.normalizar_lugar(p_nombre);
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.asignar_cancha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.cancha_id := public.cancha_para(new.grupo_id, new.lugar);
  return new;
end;
$$;

create trigger trg_asignar_cancha
  before insert or update of lugar, grupo_id on public.partidos
  for each row execute function public.asignar_cancha();

-- ═════════════════════════════════════════════════════════════════════════
-- Renombrar y unificar (desde Admin → Canchas)
-- ═════════════════════════════════════════════════════════════════════════
-- Los partidos de desafío mantienen el lugar que acordaron los dos grupos
-- (no se puede cambiar de un solo lado): solo cambia a qué cancha apuntan.
create or replace function public.renombrar_cancha(p_cancha_id uuid, p_nombre text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.canchas;
  v_nombre text := public.limpiar_lugar(p_nombre);
begin
  select * into c from public.canchas where id = p_cancha_id;
  if c.id is null or not public.es_admin_grupo(c.grupo_id) then
    raise exception 'Solo el admin del grupo puede renombrar sus canchas.';
  end if;
  if v_nombre is null or length(v_nombre) not between 1 and 100 then
    raise exception 'El nombre tiene que tener entre 1 y 100 caracteres.';
  end if;
  if exists (
    select 1 from public.canchas
    where grupo_id = c.grupo_id and id <> c.id
      and public.normalizar_lugar(nombre) = public.normalizar_lugar(v_nombre)
  ) then
    raise exception 'Ya hay una cancha que se llama así. Si es la misma, unificalas.';
  end if;

  update public.canchas set nombre = v_nombre where id = c.id;
  update public.partidos set lugar = v_nombre where cancha_id = c.id and desafio_id is null;
end;
$$;

-- Pasa los partidos de una cancha a otra y borra la primera.
create or replace function public.unificar_canchas(p_desde uuid, p_hacia uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  desde public.canchas;
  hacia public.canchas;
begin
  select * into desde from public.canchas where id = p_desde;
  select * into hacia from public.canchas where id = p_hacia;
  if desde.id is null or hacia.id is null or desde.grupo_id <> hacia.grupo_id
     or not public.es_admin_grupo(desde.grupo_id) then
    raise exception 'Solo el admin del grupo puede unificar sus canchas.';
  end if;
  if desde.id = hacia.id then
    raise exception 'Elegí dos canchas distintas.';
  end if;

  update public.partidos set lugar = hacia.nombre where cancha_id = desde.id and desafio_id is null;
  update public.partidos set cancha_id = hacia.id where cancha_id = desde.id;
  delete from public.canchas where id = desde.id;
end;
$$;

revoke execute on function public.cancha_para(uuid, text) from public, anon, authenticated;
revoke execute on function public.asignar_cancha() from public, anon, authenticated;
revoke execute on function public.renombrar_cancha(uuid, text) from public, anon;
revoke execute on function public.unificar_canchas(uuid, uuid) from public, anon;
