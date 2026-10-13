-- Arreglos:
--
--   1) La respuesta a la convocatoria ("juego" / "no juego") se puede cambiar
--      hasta que empieza el partido (hora de Argentina). Antes valía hasta
--      que se cargaba el resultado: alguien que dijo que no iba podía poner
--      "al final juego" al día siguiente y meterse a votar. Después del
--      horario lo corrige el admin (fijarRespuesta).
--   2) Desafíos: una fecha propuesta no se aplica si el partido ya tiene
--      resultado (ni aceptándola ni por vencimiento): antes el partido podía
--      quedar con resultado y una fecha futura, y se volvía a pedir
--      confirmación a todos. Proponer un resultado descarta la propuesta de
--      fecha que hubiera.
--   3) mensajes_contacto guarda la IP, para limitar cuántos mensajes manda
--      cada uno (antes era por email, que lo escribe el que manda).

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Responder la convocatoria solo antes del partido
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.responder_convocatoria(p_partido_id uuid, p_juega boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partido_jugadores pj
  set respuesta = case when p_juega then 'juega' else 'no_juega' end
  from public.partidos pa
  where pa.id = pj.partido_id
    and pj.partido_id = p_partido_id
    and pj.jugador_id = auth.uid()
    and not pa.jugado
    -- Mismo criterio que partidoYaPaso (src/lib/confirmacion.ts): uno de hoy
    -- sin hora todavía no pasó.
    and (pa.fecha + coalesce(pa.hora, time '23:59:59'))
        > (now() at time zone 'America/Argentina/Buenos_Aires');
  return found;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Desafíos: no cambiar la fecha de un partido que ya tiene resultado
-- ─────────────────────────────────────────────────────────────────────────
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
    if public.desafio_con_resultado(d) then
      raise exception 'El partido ya tiene resultado: no se puede cambiar la fecha.';
    end if;
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

  -- Ya se jugó: una propuesta de otra fecha que quedara abierta no va más.
  update public.desafios
  set propuesta_fecha = null, propuesta_hora = null, propuesta_lugar = null,
      propuesta_por_grupo_id = null, propuesta_vence_en = null
  where id = p_desafio_id and propuesta_fecha is not null;

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

  -- Una fecha propuesta para un partido que ya tiene resultado no se aplica:
  -- se descarta (sin avisar, no cambió nada).
  update public.desafios d
  set propuesta_fecha = null, propuesta_hora = null, propuesta_lugar = null,
      propuesta_por_grupo_id = null, propuesta_vence_en = null
  where d.propuesta_fecha is not null and public.desafio_con_resultado(d);

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

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Contacto: IP de quien manda (para el límite por hora)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.mensajes_contacto add column ip text;
create index mensajes_contacto_ip_idx on public.mensajes_contacto (ip, created_at desc);
