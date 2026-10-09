-- Desafíos completos (etapas 2 a 4 de docs/plan-desafios.md) y protecciones.
--
-- Etapa 2: suspender y reprogramar. Cualquiera de los dos grupos suspende
-- un partido aceptado (mientras no hay resultado) y cualquiera propone otra
-- fecha; la fecha cambia recién cuando el otro acepta (o a los 3 días). Al
-- cambiar, en los grupos que piden confirmación los convocados vuelven a
-- 'pendiente' para confirmar de nuevo.
--
-- Etapa 3: resultado. Después del partido, cualquiera de los dos propone el
-- marcador; el otro lo acepta o contrapropone (las veces que haga falta).
-- Una propuesta sin respuesta se acepta sola a los 3 días (cron). Si no se
-- ponen de acuerdo, cualquiera corta y queda 'sin_verificar': cada grupo
-- se queda con su última versión. Lo interno de cada grupo (goles de sus
-- jugadores, votación) no depende de esto: el marcador de cada partido sale
-- de su versión, y lo que no suman sus jugadores va a goles_otros.
--
-- Etapa 4: historial. get_desafios devuelve el resultado de cada desafío y
-- get_grupo_por_codigo_desafio cuántos jugó y cuántos quedaron sin verificar
-- el grupo que se va a desafiar.
--
-- Además: get_ocupados_otro_grupo, para marcar en la convocatoria a los que
-- ese día ya están convocados en un partido de otro grupo.
--
-- Protecciones de los desafíos que no dependen de la app:
--
--   1) El partido de un desafío no se puede editar por la API salteando la
--      app (RLS deja que el admin edite los partidos de su grupo): no se
--      puede cambiar fecha, hora, lugar ni rival (los acuerdan los dos
--      grupos), ni colgar o descolgar un partido de un desafío. Solo las
--      funciones de desafíos (que corren como el dueño, no como
--      'authenticated') lo pueden hacer.
--   2) Anti-spam de avisos: un grupo puede mandarle a lo sumo 3 desafíos
--      por día a un mismo grupo, y 20 por día en total (crear y retirar en
--      loop le llenaba de avisos al otro grupo).
--   3) Si un grupo cambia de nombre, los partidos de desafío del otro grupo
--      (donde figura como rival) se actualizan.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Partidos de desafío
-- ─────────────────────────────────────────────────────────────────────────
-- Sin security definer a propósito: current_user tiene que ser el de quien
-- hace el cambio ('authenticated' desde la API, el dueño desde las funciones
-- de desafíos).
create or replace function public.proteger_partido_de_desafio()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.desafio_id is not null then
      raise exception 'Los partidos de desafío se crean al aceptar el desafío.';
    end if;
    return new;
  end if;

  if new.desafio_id is distinct from old.desafio_id then
    raise exception 'No se puede cambiar el desafío de un partido.';
  end if;
  if old.desafio_id is not null and (
    new.fecha is distinct from old.fecha
    or new.hora is distinct from old.hora
    or new.lugar is distinct from old.lugar
    or new.rival is distinct from old.rival
    or new.grupo_id is distinct from old.grupo_id
  ) then
    raise exception 'Es un partido de un desafío: la fecha, el lugar y el rival no se cambian.';
  end if;
  return new;
end;
$$;

create trigger trg_proteger_partido_de_desafio
  before insert or update on public.partidos
  for each row execute procedure public.proteger_partido_de_desafio();

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Renombrar un grupo
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.renombrar_rival_en_desafios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nombre is not distinct from old.nombre then
    return new;
  end if;

  update public.desafios set nombre_desafiante = new.nombre where grupo_desafiante_id = new.id;
  update public.desafios set nombre_desafiado = new.nombre where grupo_desafiado_id = new.id;

  -- El partido del otro grupo (donde este grupo es el rival).
  update public.partidos pa
  set rival = new.nombre
  from public.desafios d
  where pa.desafio_id = d.id
    and pa.grupo_id <> new.id
    and (d.grupo_desafiante_id = new.id or d.grupo_desafiado_id = new.id);

  return new;
end;
$$;

create trigger trg_renombrar_rival_en_desafios
  after update of nombre on public.grupos
  for each row execute procedure public.renombrar_rival_en_desafios();

-- ─────────────────────────────────────────────────────────────────────────
-- 2) crear_desafio con límites por día (resto igual a 0023)
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

  if (select count(*) from public.desafios
      where grupo_desafiante_id = p_grupo_id and grupo_desafiado_id = v_rival.id
        and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Ya le mandaron varios desafíos a % hoy. Probá mañana.', v_rival.nombre;
  end if;
  if (select count(*) from public.desafios
      where grupo_desafiante_id = p_grupo_id
        and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Ya mandaron muchos desafíos hoy. Probá mañana.';
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

-- ═════════════════════════════════════════════════════════════════════════
-- Esquema de las etapas 2 y 3
-- ═════════════════════════════════════════════════════════════════════════
alter table public.desafios drop constraint desafios_estado_check;
alter table public.desafios add constraint desafios_estado_check
  check (estado in ('pendiente', 'aceptado', 'suspendido', 'rechazado', 'cancelado', 'vencido'));

alter table public.desafios
  add column suspendido_por_grupo_id uuid references public.grupos (id) on delete set null,
  -- Fecha nueva propuesta por uno de los dos grupos (hay como mucho una).
  add column propuesta_fecha date,
  add column propuesta_hora time,
  add column propuesta_lugar text,
  add column propuesta_por_grupo_id uuid references public.grupos (id) on delete set null,
  add column propuesta_vence_en timestamptz,
  add column resultado_estado text not null default 'sin_cargar'
    check (resultado_estado in ('sin_cargar', 'en_discusion', 'verificado', 'sin_verificar')),
  -- El marcador verificado (null mientras no hay acuerdo).
  add column goles_desafiante int check (goles_desafiante >= 0),
  add column goles_desafiado int check (goles_desafiado >= 0);

-- Cada propuesta de marcador (queda el historial del ida y vuelta).
create table public.desafio_resultados (
  id uuid primary key default gen_random_uuid(),
  desafio_id uuid not null references public.desafios (id) on delete cascade,
  propuesto_por_grupo_id uuid references public.grupos (id) on delete set null,
  goles_desafiante int not null check (goles_desafiante between 0 and 99),
  goles_desafiado int not null check (goles_desafiado between 0 and 99),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'reemplazada', 'cortada')),
  vence_en timestamptz not null default now() + interval '3 days',
  creado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index desafio_resultados_desafio_idx on public.desafio_resultados (desafio_id);
create unique index desafio_resultados_una_pendiente
  on public.desafio_resultados (desafio_id) where estado = 'pendiente';

alter table public.desafio_resultados enable row level security;

create policy "desafio_resultados_select_miembro"
  on public.desafio_resultados for select
  to authenticated
  using (exists (
    select 1 from public.desafios d
    where d.id = desafio_id
      and (public.es_miembro(d.grupo_desafiante_id) or public.es_miembro(d.grupo_desafiado_id))
  ));

-- ═════════════════════════════════════════════════════════════════════════
-- Helpers
-- ═════════════════════════════════════════════════════════════════════════

-- Si el partido ya se jugó, como partidoYaPaso en src/lib/confirmacion.ts:
-- un día anterior a hoy, u hoy con la hora ya pasada (hoy sin hora, no).
create or replace function public.desafio_ya_se_jugo(p_fecha date, p_hora time)
returns boolean
language sql
stable
as $$
  select case
    when p_fecha <> public.hoy_argentina() then p_fecha < public.hoy_argentina()
    when p_hora is null then false
    else p_hora <= (now() at time zone 'America/Argentina/Buenos_Aires')::time
  end;
$$;

-- Corta si quien llama no es admin de p_grupo_id o si ese grupo no es uno
-- de los dos del desafío.
create or replace function public.chequear_lado_desafio(p_desafio public.desafios, p_grupo_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_desafio.id is null
    or not public.es_admin_grupo(p_grupo_id)
    or (p_grupo_id is distinct from p_desafio.grupo_desafiante_id
        and p_grupo_id is distinct from p_desafio.grupo_desafiado_id) then
    raise exception 'Solo un admin de los grupos del desafío puede hacer esto.';
  end if;
end;
$$;

-- Si algún grupo ya cargó goles o hay resultado del desafío en juego.
create or replace function public.desafio_con_resultado(p_desafio public.desafios)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_desafio.resultado_estado <> 'sin_cargar'
    or exists (select 1 from public.partidos where desafio_id = p_desafio.id and jugado);
$$;

-- Pone en el partido de cada grupo el marcador de su versión: el verificado
-- si hay acuerdo, si no la última propuesta de ese grupo. Lo que no suman
-- los goles de sus jugadores va a goles_otros.
create or replace function public.aplicar_marcador_desafio(p_desafio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.desafios;
  pa record;
  v_desafiante int;
  v_desafiado int;
  v_propios int;
  v_rival int;
begin
  select * into d from public.desafios where id = p_desafio_id;
  for pa in select id, grupo_id from public.partidos where desafio_id = p_desafio_id loop
    v_desafiante := null;
    v_desafiado := null;
    if d.resultado_estado = 'verificado' then
      v_desafiante := d.goles_desafiante;
      v_desafiado := d.goles_desafiado;
    else
      select r.goles_desafiante, r.goles_desafiado into v_desafiante, v_desafiado
      from public.desafio_resultados r
      where r.desafio_id = p_desafio_id and r.propuesto_por_grupo_id = pa.grupo_id
      order by r.created_at desc
      limit 1;
    end if;
    continue when v_desafiante is null;

    if pa.grupo_id = d.grupo_desafiante_id then
      v_propios := v_desafiante; v_rival := v_desafiado;
    else
      v_propios := v_desafiado; v_rival := v_desafiante;
    end if;

    update public.partidos
    set goles_rival = v_rival,
        goles_otros = greatest(0, v_propios - (
          select coalesce(sum(goles), 0) from public.partido_jugadores
          where partido_id = pa.id and equipo = 1
        ))
    where id = pa.id;
  end loop;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- Etapa 2: suspender y reprogramar
-- ═════════════════════════════════════════════════════════════════════════

-- Pasa la fecha propuesta al desafío y a los dos partidos, y vuelve a pedir
-- confirmación en los grupos que la piden.
create or replace function public.aplicar_fecha_propuesta(p_desafio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.desafios;
begin
  select * into d from public.desafios where id = p_desafio_id;
  if d.propuesta_fecha is null then
    return;
  end if;

  update public.desafios
  set fecha = d.propuesta_fecha,
      hora = d.propuesta_hora,
      lugar = d.propuesta_lugar,
      estado = 'aceptado',
      suspendido_por_grupo_id = null,
      propuesta_fecha = null,
      propuesta_hora = null,
      propuesta_lugar = null,
      propuesta_por_grupo_id = null,
      propuesta_vence_en = null,
      updated_at = now()
  where id = p_desafio_id;

  update public.partidos
  set fecha = d.propuesta_fecha, hora = d.propuesta_hora, lugar = d.propuesta_lugar
  where desafio_id = p_desafio_id;

  update public.partido_jugadores pj
  set respuesta = 'pendiente'
  from public.partidos pa
  join public.config c
    on c.grupo_id = pa.grupo_id and c.clave = 'pedir_confirmacion' and c.valor = 'true'::jsonb
  where pj.partido_id = pa.id and pa.desafio_id = p_desafio_id;
end;
$$;

create or replace function public.suspender_desafio(p_desafio_id uuid, p_grupo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.desafios;
begin
  select * into d from public.desafios where id = p_desafio_id for update;
  perform public.chequear_lado_desafio(d, p_grupo_id);
  if d.estado <> 'aceptado' then
    raise exception 'Solo se puede suspender un partido aceptado.';
  end if;
  if public.desafio_con_resultado(d) then
    raise exception 'Ya hay resultado cargado, no se puede suspender.';
  end if;

  update public.desafios
  set estado = 'suspendido', suspendido_por_grupo_id = p_grupo_id, updated_at = now()
  where id = p_desafio_id;
end;
$$;

-- Propone otra fecha (aceptado o suspendido). Reemplaza la propuesta que
-- hubiera, también la del otro grupo (es una contrapropuesta).
create or replace function public.proponer_fecha_desafio(
  p_desafio_id uuid,
  p_grupo_id uuid,
  p_fecha date,
  p_hora time,
  p_lugar text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.desafios;
begin
  select * into d from public.desafios where id = p_desafio_id for update;
  perform public.chequear_lado_desafio(d, p_grupo_id);
  if d.estado not in ('aceptado', 'suspendido') then
    raise exception 'Este desafío ya no se puede reprogramar.';
  end if;
  if public.desafio_con_resultado(d) then
    raise exception 'Ya hay resultado cargado, no se puede reprogramar.';
  end if;
  if p_fecha is null or p_fecha < public.hoy_argentina() then
    raise exception 'Elegí una fecha de hoy en adelante.';
  end if;
  if length(trim(coalesce(p_lugar, ''))) not between 1 and 100 then
    raise exception 'Poné dónde se juega.';
  end if;

  update public.desafios
  set propuesta_fecha = p_fecha,
      propuesta_hora = p_hora,
      propuesta_lugar = trim(p_lugar),
      propuesta_por_grupo_id = p_grupo_id,
      propuesta_vence_en = now() + interval '3 days',
      updated_at = now()
  where id = p_desafio_id;
end;
$$;

create or replace function public.responder_fecha_desafio(p_desafio_id uuid, p_grupo_id uuid, p_acepta boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.desafios;
begin
  select * into d from public.desafios where id = p_desafio_id for update;
  perform public.chequear_lado_desafio(d, p_grupo_id);
  if d.propuesta_fecha is null then
    raise exception 'No hay ninguna fecha propuesta (puede que ya se haya respondido).';
  end if;
  if d.propuesta_por_grupo_id = p_grupo_id then
    raise exception 'La fecha la propusieron ustedes: la tiene que aceptar el otro grupo.';
  end if;

  if p_acepta then
    if d.propuesta_fecha < public.hoy_argentina() then
      raise exception 'Esa fecha ya pasó: proponé otra.';
    end if;
    perform public.aplicar_fecha_propuesta(p_desafio_id);
  else
    update public.desafios
    set propuesta_fecha = null, propuesta_hora = null, propuesta_lugar = null,
        propuesta_por_grupo_id = null, propuesta_vence_en = null, updated_at = now()
    where id = p_desafio_id;
  end if;
end;
$$;

-- cancelar_desafio de 0023, ahora también desde suspendido y sin resultado.
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
  perform public.chequear_lado_desafio(v, p_grupo_id);
  if v.estado is distinct from p_estado_esperado then
    raise exception 'El desafío cambió mientras tanto (ahora está %). Actualizá la página.', v.estado;
  end if;
  if v.estado = 'pendiente' and p_grupo_id is distinct from v.grupo_desafiante_id then
    raise exception 'Para no aceptar un desafío, rechazalo.';
  end if;
  if v.estado not in ('pendiente', 'aceptado', 'suspendido') then
    raise exception 'Este desafío ya no se puede cancelar.';
  end if;
  if public.desafio_con_resultado(v) then
    raise exception 'Ya hay resultado cargado de este partido, no se puede cancelar.';
  end if;

  update public.desafios
  set estado = 'cancelado', cancelado_por_grupo_id = p_grupo_id,
      propuesta_fecha = null, propuesta_hora = null, propuesta_lugar = null,
      propuesta_por_grupo_id = null, propuesta_vence_en = null, updated_at = now()
  where id = p_desafio_id;

  delete from public.partidos where desafio_id = p_desafio_id;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- Etapa 3: resultado
-- ═════════════════════════════════════════════════════════════════════════
create or replace function public.verificar_resultado_desafio(p_resultado_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.desafio_resultados;
begin
  select * into r from public.desafio_resultados where id = p_resultado_id;
  update public.desafio_resultados set estado = 'aceptada' where id = p_resultado_id;
  update public.desafios
  set resultado_estado = 'verificado',
      goles_desafiante = r.goles_desafiante,
      goles_desafiado = r.goles_desafiado,
      updated_at = now()
  where id = r.desafio_id;
  perform public.aplicar_marcador_desafio(r.desafio_id);
end;
$$;

-- Propone el marcador. Si el otro grupo ya había propuesto exactamente el
-- mismo, es aceptarlo. Devuelve 'propuesto' o 'verificado'.
create or replace function public.proponer_resultado_desafio(
  p_desafio_id uuid,
  p_grupo_id uuid,
  p_goles_desafiante int,
  p_goles_desafiado int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.desafios;
  pendiente public.desafio_resultados;
begin
  select * into d from public.desafios where id = p_desafio_id for update;
  perform public.chequear_lado_desafio(d, p_grupo_id);
  if d.estado <> 'aceptado' then
    raise exception 'Solo se carga el resultado de un partido aceptado.';
  end if;
  if not public.desafio_ya_se_jugo(d.fecha, d.hora) then
    raise exception 'El resultado se carga después de jugar el partido.';
  end if;
  if d.resultado_estado not in ('sin_cargar', 'en_discusion') then
    raise exception 'El resultado de este partido ya quedó cerrado.';
  end if;
  if p_goles_desafiante is null or p_goles_desafiado is null
    or p_goles_desafiante not between 0 and 99 or p_goles_desafiado not between 0 and 99 then
    raise exception 'Revisá los goles: números enteros de 0 a 99.';
  end if;

  select * into pendiente from public.desafio_resultados
  where desafio_id = p_desafio_id and estado = 'pendiente'
  for update;

  if pendiente.id is not null
    and pendiente.propuesto_por_grupo_id is distinct from p_grupo_id
    and pendiente.goles_desafiante = p_goles_desafiante
    and pendiente.goles_desafiado = p_goles_desafiado then
    perform public.verificar_resultado_desafio(pendiente.id);
    return 'verificado';
  end if;

  if pendiente.id is not null then
    update public.desafio_resultados set estado = 'reemplazada' where id = pendiente.id;
  end if;

  insert into public.desafio_resultados (
    desafio_id, propuesto_por_grupo_id, goles_desafiante, goles_desafiado, creado_por
  )
  values (p_desafio_id, p_grupo_id, p_goles_desafiante, p_goles_desafiado, auth.uid());

  update public.desafios set resultado_estado = 'en_discusion', updated_at = now()
  where id = p_desafio_id;
  perform public.aplicar_marcador_desafio(p_desafio_id);
  return 'propuesto';
end;
$$;

create or replace function public.aceptar_resultado_desafio(p_desafio_id uuid, p_grupo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.desafios;
  pendiente public.desafio_resultados;
begin
  select * into d from public.desafios where id = p_desafio_id for update;
  perform public.chequear_lado_desafio(d, p_grupo_id);
  select * into pendiente from public.desafio_resultados
  where desafio_id = p_desafio_id and estado = 'pendiente'
  for update;
  if pendiente.id is null then
    raise exception 'No hay ningún resultado para confirmar (puede que ya se haya respondido).';
  end if;
  if pendiente.propuesto_por_grupo_id = p_grupo_id then
    raise exception 'Ese resultado lo cargaron ustedes: lo tiene que confirmar el otro grupo.';
  end if;
  perform public.verificar_resultado_desafio(pendiente.id);
end;
$$;

-- "No nos ponemos de acuerdo": queda sin verificar. Solo cuando los dos
-- grupos ya dieron su versión (si no, uno se quedaría sin marcador).
create or replace function public.cortar_resultado_desafio(p_desafio_id uuid, p_grupo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.desafios;
begin
  select * into d from public.desafios where id = p_desafio_id for update;
  perform public.chequear_lado_desafio(d, p_grupo_id);
  if d.resultado_estado <> 'en_discusion' then
    raise exception 'El resultado no está en discusión.';
  end if;
  if (select count(distinct propuesto_por_grupo_id) from public.desafio_resultados
      where desafio_id = p_desafio_id) < 2 then
    raise exception 'Antes de cortar, los dos grupos tienen que cargar su resultado.';
  end if;

  update public.desafio_resultados set estado = 'cortada'
  where desafio_id = p_desafio_id and estado = 'pendiente';
  update public.desafios set resultado_estado = 'sin_verificar', updated_at = now()
  where id = p_desafio_id;
  perform public.aplicar_marcador_desafio(p_desafio_id);
end;
$$;

-- Lo que vence (lo llama el cron diario con la service role): resultados y
-- fechas propuestas sin respuesta en 3 días se aceptan solos, y los
-- desafíos pendientes con fecha pasada quedan vencidos. Devuelve qué se
-- aceptó solo, para avisar.
create or replace function public.vencer_propuestas_desafios()
returns table (desafio_id uuid, tipo text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select x.id as resultado_id, x.desafio_id as d_id from public.desafio_resultados x
    join public.desafios d on d.id = x.desafio_id
    where x.estado = 'pendiente' and x.vence_en < now()
      and d.estado = 'aceptado' and d.resultado_estado = 'en_discusion'
  loop
    perform public.verificar_resultado_desafio(r.resultado_id);
    desafio_id := r.d_id;
    tipo := 'resultado';
    return next;
  end loop;

  for r in
    select d.id as d_id, d.propuesta_fecha as f from public.desafios d
    where d.propuesta_fecha is not null and d.propuesta_vence_en < now()
      and d.estado in ('aceptado', 'suspendido')
  loop
    if r.f >= public.hoy_argentina() then
      perform public.aplicar_fecha_propuesta(r.d_id);
      desafio_id := r.d_id;
      tipo := 'fecha';
      return next;
    else
      -- La fecha propuesta ya pasó sin respuesta: se descarta.
      update public.desafios
      set propuesta_fecha = null, propuesta_hora = null, propuesta_lugar = null,
          propuesta_por_grupo_id = null, propuesta_vence_en = null
      where id = r.d_id;
    end if;
  end loop;

  update public.desafios set estado = 'vencido', updated_at = now()
  where estado = 'pendiente' and fecha < public.hoy_argentina();
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- Etapa 4 y lecturas
-- ═════════════════════════════════════════════════════════════════════════
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
  resultado_cargado boolean,
  suspendido_por_mi_grupo boolean,
  propuesta_fecha date,
  propuesta_hora time,
  propuesta_lugar text,
  propuesta_es_mia boolean,
  propuesta_vence_en timestamptz,
  resultado_estado text,
  marcador_mios int,
  marcador_rival int,
  resultado_pendiente_mios int,
  resultado_pendiente_rival int,
  resultado_pendiente_es_mio boolean,
  resultado_pendiente_vence_en timestamptz,
  ambos_propusieron boolean
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
    d.resultado_estado <> 'sin_cargar'
      or exists (select 1 from public.partidos x where x.desafio_id = d.id and x.jugado),
    d.suspendido_por_grupo_id = p_grupo_id,
    d.propuesta_fecha,
    d.propuesta_hora,
    d.propuesta_lugar,
    case when d.propuesta_fecha is null then null else d.propuesta_por_grupo_id = p_grupo_id end,
    d.propuesta_vence_en,
    d.resultado_estado,
    -- Mi versión del marcador: la verificada, o mi última propuesta.
    case when d.grupo_desafiante_id = p_grupo_id then mia.gd else mia.gdo end,
    case when d.grupo_desafiante_id = p_grupo_id then mia.gdo else mia.gd end,
    -- La propuesta de resultado que espera respuesta (si hay).
    case when d.grupo_desafiante_id = p_grupo_id then pend.goles_desafiante else pend.goles_desafiado end,
    case when d.grupo_desafiante_id = p_grupo_id then pend.goles_desafiado else pend.goles_desafiante end,
    case when pend.id is null then null else pend.propuesto_por_grupo_id = p_grupo_id end,
    pend.vence_en,
    (select count(distinct r.propuesto_por_grupo_id) from public.desafio_resultados r
      where r.desafio_id = d.id) >= 2
  from public.desafios d
  left join public.grupos rival on rival.id = case
    when d.grupo_desafiante_id = p_grupo_id then d.grupo_desafiado_id
    else d.grupo_desafiante_id
  end
  left join public.partidos pa on pa.desafio_id = d.id and pa.grupo_id = p_grupo_id
  left join public.desafio_resultados pend on pend.desafio_id = d.id and pend.estado = 'pendiente'
  left join lateral (
    select
      case when d.resultado_estado = 'verificado' then d.goles_desafiante else ultima.goles_desafiante end as gd,
      case when d.resultado_estado = 'verificado' then d.goles_desafiado else ultima.goles_desafiado end as gdo
    from (select 1) uno
    left join lateral (
      select r.goles_desafiante, r.goles_desafiado from public.desafio_resultados r
      where r.desafio_id = d.id and r.propuesto_por_grupo_id = p_grupo_id
      order by r.created_at desc
      limit 1
    ) ultima on true
  ) mia on true
  where public.es_miembro(p_grupo_id)
    and (d.grupo_desafiante_id = p_grupo_id or d.grupo_desafiado_id = p_grupo_id)
    and (p_desafio_id is null or d.id = p_desafio_id)
  order by d.fecha desc, d.created_at desc;
$$;

-- Con cuántos desafíos jugados y sin verificar viene el grupo, para verlo
-- antes de desafiarlo.
drop function public.get_grupo_por_codigo_desafio(text);

create or replace function public.get_grupo_por_codigo_desafio(p_codigo text)
returns table (id uuid, nombre text, logo_url text, jugados bigint, sin_verificar bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.id,
    g.nombre,
    g.logo_url,
    (select count(*) from public.desafios d
      where (d.grupo_desafiante_id = g.id or d.grupo_desafiado_id = g.id)
        and d.resultado_estado in ('verificado', 'sin_verificar')),
    (select count(*) from public.desafios d
      where (d.grupo_desafiante_id = g.id or d.grupo_desafiado_id = g.id)
        and d.resultado_estado = 'sin_verificar')
  from public.grupos g
  where g.codigo_desafio = trim(p_codigo);
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- Ocupados en otro grupo (para la convocatoria)
-- ═════════════════════════════════════════════════════════════════════════
-- Miembros de p_grupo_id que ese día están convocados (y no dijeron que no
-- juegan) en un partido de otro grupo que todavía no se jugó. No dice qué
-- grupo. Solo para admins de p_grupo_id.
create or replace function public.get_ocupados_otro_grupo(p_grupo_id uuid, p_fecha date)
returns table (jugador_id uuid, hora time, confirmado boolean)
language sql
security definer
stable
set search_path = public
as $$
  select pj.jugador_id, pa.hora, pj.respuesta = 'juega'
  from public.partido_jugadores pj
  join public.partidos pa on pa.id = pj.partido_id
  join public.grupo_miembros gm on gm.grupo_id = p_grupo_id and gm.jugador_id = pj.jugador_id
  where public.es_admin_grupo(p_grupo_id)
    and pa.grupo_id <> p_grupo_id
    and pa.fecha = p_fecha
    and not pa.jugado
    and pj.respuesta <> 'no_juega';
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- Permisos
-- ═════════════════════════════════════════════════════════════════════════
revoke execute on function public.chequear_lado_desafio(public.desafios, uuid) from public, anon, authenticated;
revoke execute on function public.desafio_con_resultado(public.desafios) from public, anon, authenticated;
revoke execute on function public.aplicar_marcador_desafio(uuid) from public, anon, authenticated;
revoke execute on function public.aplicar_fecha_propuesta(uuid) from public, anon, authenticated;
revoke execute on function public.verificar_resultado_desafio(uuid) from public, anon, authenticated;
revoke execute on function public.vencer_propuestas_desafios() from public, anon, authenticated;
grant execute on function public.vencer_propuestas_desafios() to service_role;

revoke execute on function public.suspender_desafio(uuid, uuid) from public, anon;
revoke execute on function public.proponer_fecha_desafio(uuid, uuid, date, time, text) from public, anon;
revoke execute on function public.responder_fecha_desafio(uuid, uuid, boolean) from public, anon;
revoke execute on function public.proponer_resultado_desafio(uuid, uuid, int, int) from public, anon;
revoke execute on function public.aceptar_resultado_desafio(uuid, uuid) from public, anon;
revoke execute on function public.cortar_resultado_desafio(uuid, uuid) from public, anon;
revoke execute on function public.get_desafios(uuid, uuid) from public, anon;
revoke execute on function public.get_grupo_por_codigo_desafio(text) from public, anon;
revoke execute on function public.get_ocupados_otro_grupo(uuid, date) from public, anon;
grant execute on function public.suspender_desafio(uuid, uuid) to authenticated;
grant execute on function public.proponer_fecha_desafio(uuid, uuid, date, time, text) to authenticated;
grant execute on function public.responder_fecha_desafio(uuid, uuid, boolean) to authenticated;
grant execute on function public.proponer_resultado_desafio(uuid, uuid, int, int) to authenticated;
grant execute on function public.aceptar_resultado_desafio(uuid, uuid) to authenticated;
grant execute on function public.cortar_resultado_desafio(uuid, uuid) to authenticated;
grant execute on function public.get_desafios(uuid, uuid) to authenticated;
grant execute on function public.get_grupo_por_codigo_desafio(text) to authenticated;
grant execute on function public.get_ocupados_otro_grupo(uuid, date) to authenticated;
