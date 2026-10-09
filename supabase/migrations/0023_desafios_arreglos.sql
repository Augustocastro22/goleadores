-- Arreglos de la etapa 1 de desafíos (0022_desafios.sql):
--
--   1) Un pendiente que vencía seguía "pendiente" en la base, y el índice de
--      un solo pendiente por par trababa para siempre los desafíos entre esos
--      dos grupos. Ahora hay estado 'vencido' y crear_desafio pasa a vencido
--      los pendientes con fecha pasada antes de chequear.
--   2) Al borrar un grupo, sus desafíos pendientes se cancelan antes de que
--      la FK los deje con el grupo en null (quedaban trabados en "Para
--      responder", y dos de ellos podían chocar en el índice y hacer fallar
--      el borrado del grupo o de la cuenta).
--   3) cancelar_desafio no chequeaba bien quién cancela si uno de los grupos
--      ya no existía (NOT IN con NULL). Además recibe el estado que vio el
--      admin: "Retirar" con la página vieja ya no cancela un partido que el
--      otro grupo aceptó mientras tanto.
--   4) get_desafios dice si algún grupo ya cargó el resultado, para no
--      mostrar "Cancelar partido" cuando la base lo va a rechazar.
--   5) Dos desafíos mandados a la vez daban un error técnico.

alter table public.desafios drop constraint desafios_estado_check;
alter table public.desafios add constraint desafios_estado_check
  check (estado in ('pendiente', 'aceptado', 'rechazado', 'cancelado', 'vencido'));

-- Los que ya vencieron hasta hoy.
update public.desafios
set estado = 'vencido', updated_at = now()
where estado = 'pendiente' and fecha < public.hoy_argentina();

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Borrado de grupos
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.cancelar_desafios_pendientes_del_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.desafios
  set estado = 'cancelado', cancelado_por_grupo_id = old.id, updated_at = now()
  where estado = 'pendiente'
    and (grupo_desafiante_id = old.id or grupo_desafiado_id = old.id);
  return old;
end;
$$;

create trigger trg_cancelar_desafios_pendientes
  before delete on public.grupos
  for each row execute procedure public.cancelar_desafios_pendientes_del_grupo();

-- ─────────────────────────────────────────────────────────────────────────
-- 1) y 5) crear_desafio
-- ─────────────────────────────────────────────────────────────────────────
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

  -- Un pendiente vencido no cuenta: se pasa a vencido para que no trabe.
  update public.desafios
  set estado = 'vencido', updated_at = now()
  where estado = 'pendiente' and fecha < public.hoy_argentina();

  if exists (
    select 1 from public.desafios
    where estado = 'pendiente'
      and least(grupo_desafiante_id, grupo_desafiado_id) = least(p_grupo_id, v_rival.id)
      and greatest(grupo_desafiante_id, grupo_desafiado_id) = greatest(p_grupo_id, v_rival.id)
  ) then
    raise exception 'Ya hay un desafío pendiente con %. Esperá a que se responda.', v_rival.nombre;
  end if;

  begin
    insert into public.desafios (
      grupo_desafiante_id, grupo_desafiado_id, nombre_desafiante, nombre_desafiado,
      fecha, hora, lugar, creado_por
    )
    values (
      p_grupo_id, v_rival.id, v_propio.nombre, v_rival.nombre,
      p_fecha, p_hora, trim(p_lugar), auth.uid()
    )
    returning id into v_id;
  exception when unique_violation then
    -- Otro admin mandó uno entre los mismos grupos en el mismo instante.
    raise exception 'Ya hay un desafío pendiente con %. Esperá a que se responda.', v_rival.nombre;
  end;

  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) cancelar_desafio
-- ─────────────────────────────────────────────────────────────────────────
drop function public.cancelar_desafio(uuid, uuid);

create or replace function public.cancelar_desafio(
  p_desafio_id uuid,
  p_grupo_id uuid,
  p_estado_esperado text
)
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
    or (p_grupo_id is distinct from v.grupo_desafiante_id
        and p_grupo_id is distinct from v.grupo_desafiado_id) then
    raise exception 'Solo un admin de los grupos del desafío puede cancelarlo.';
  end if;
  if v.estado is distinct from p_estado_esperado then
    raise exception 'El desafío cambió mientras tanto (ahora está %). Actualizá la página.', v.estado;
  end if;
  if v.estado = 'pendiente' and p_grupo_id is distinct from v.grupo_desafiante_id then
    raise exception 'Para no aceptar un desafío, rechazalo.';
  end if;
  if v.estado not in ('pendiente', 'aceptado') then
    raise exception 'Este desafío ya no se puede cancelar.';
  end if;
  if exists (select 1 from public.partidos where desafio_id = p_desafio_id and jugado) then
    raise exception 'Uno de los grupos ya cargó el resultado de este partido, no se puede cancelar.';
  end if;

  update public.desafios
  set estado = 'cancelado', cancelado_por_grupo_id = p_grupo_id, updated_at = now()
  where id = p_desafio_id;

  delete from public.partidos where desafio_id = p_desafio_id;
end;
$$;

revoke execute on function public.cancelar_desafio(uuid, uuid, text) from public, anon;
grant execute on function public.cancelar_desafio(uuid, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) get_desafios con resultado_cargado (cambia lo que devuelve: drop y create)
-- ─────────────────────────────────────────────────────────────────────────
drop function public.get_desafios(uuid, uuid);

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
  cancelado_por_mi_grupo boolean,
  resultado_cargado boolean
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
    d.cancelado_por_grupo_id = p_grupo_id,
    exists (select 1 from public.partidos x where x.desafio_id = d.id and x.jugado)
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

revoke execute on function public.get_desafios(uuid, uuid) from public, anon;
grant execute on function public.get_desafios(uuid, uuid) to authenticated;
