-- ─────────────────────────────────────────────────────────────────────────
-- Arreglos de lógica:
--
--   1) Partido cancelado: partidos.cancelado_en. Un partido programado que no
--      se juega se cancela (queda en el historial, tachado, y se avisa a los
--      convocados) en vez de borrarse. Uno cancelado no se puede confirmar ni
--      cuenta como "ocupado" para otro grupo. Se puede volver a programar.
--   2) Tope de co-ganadores: si un empate por el primer puesto no se pudo
--      definir, ganan todos los empatados solo si son 3 o menos. Con más (por
--      ejemplo, 10 votos a 10 jugadores distintos) esa categoría queda sin
--      ganador en ese partido. Un desempate que eligió a uno no cambia.
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Partido cancelado
-- ─────────────────────────────────────────────────────────────────────────
alter table public.partidos add column if not exists cancelado_en timestamptz;

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
    and pa.cancelado_en is null
    -- Mismo criterio que partidoYaPaso (src/lib/confirmacion.ts): uno de hoy
    -- sin hora todavía no pasó.
    and (pa.fecha + coalesce(pa.hora, time '23:59:59'))
        > (now() at time zone 'America/Argentina/Buenos_Aires');
  return found;
end;
$$;

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
    and pa.cancelado_en is null
    and pj.respuesta <> 'no_juega';
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Tope de co-ganadores (mismo número que MAX_CO_GANADORES en src/lib/desempate.ts)
-- ─────────────────────────────────────────────────────────────────────────
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
    -- Sin desempate que eligiera a uno: ganan los empatados solo si son 3 o menos.
    and (
      exists (select 1 from definido)
      or (select count(*) from conteo c2 where c2.votos = m.max_votos) <= 3
    )
    and not exists (
      select 1 from public.desempates
      where partido_id = p_partido_id and tipo = p_tipo and not resuelto
    )
    and public.es_miembro(public.grupo_de_partido(p_partido_id))
    and public.votacion_cerrada(p_partido_id);
$$;

create or replace function public.get_ranking_votos(p_grupo_id uuid, p_tipo public.voto_tipo)
returns table (
  jugador_id uuid,
  nombre text,
  apellido text,
  apodo text,
  foto_url text,
  veces_elegido bigint,
  partidos_jugados bigint,
  sigue_en_grupo boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with cerrados as (
    select pa.id
    from public.partidos pa
    where pa.grupo_id = p_grupo_id and pa.jugado and public.votacion_cerrada(pa.id)
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
  empatados_en_maximo as (
    select cp.partido_id, count(*) as cantidad
    from conteo_por_partido cp
    join maximos m on m.partido_id = cp.partido_id and m.max_votos = cp.votos
    group by cp.partido_id
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
    join empatados_en_maximo e on e.partido_id = cp.partido_id
    where not exists (select 1 from desempatados d where d.partido_id = cp.partido_id)
      -- Empate sin definir: ganan todos solo si son 3 o menos.
      and e.cantidad <= 3
      -- Empate que todavía se está definiendo: sin ganador hasta que se defina.
      and not exists (
        select 1 from public.desempates dp
        where dp.partido_id = cp.partido_id and dp.tipo = p_tipo and not dp.resuelto
      )
    union all
    select ganador_id as jugador_votado_id, partido_id
    from desempatados
  ),
  jugadores as (
    select gm.jugador_id from public.grupo_miembros gm where gm.grupo_id = p_grupo_id
    union
    select pj.jugador_id
    from public.partido_jugadores pj
    join public.partidos pa on pa.id = pj.partido_id
    where pa.grupo_id = p_grupo_id and pa.jugado
  )
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url,
         count(g.partido_id) as veces_elegido,
         (
           select count(*)
           from public.partido_jugadores pj
           join public.partidos pa on pa.id = pj.partido_id
           where pj.jugador_id = p.id and pa.jugado and pa.grupo_id = p_grupo_id
         ) as partidos_jugados,
         public.jugador_en_grupo(p_grupo_id, p.id) as sigue_en_grupo
  from jugadores j
  join public.profiles p on p.id = j.jugador_id
  left join ganadores g on g.jugador_votado_id = p.id
  where public.es_miembro(p_grupo_id)
  group by p.id
  order by veces_elegido desc, p.apellido asc;
$$;

