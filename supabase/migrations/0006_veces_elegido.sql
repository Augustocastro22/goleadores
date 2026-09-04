-- Dos cambios a las tablas de estadísticas:
--   1) get_goleadores ahora también devuelve partidos_jugados.
--   2) get_ranking_votos ya no suma votos individuales: cuenta en cuántos
--      partidos (cerrados) ese jugador fue el más votado de la categoría
--      (empates cuentan para todos los empatados), y también devuelve
--      partidos_jugados.
-- get_ganadores_votacion (el ganador de UN partido puntual) no cambia: ahí
-- sigue siendo correcto mostrar la cantidad de votos de ese partido.

create or replace function public.get_goleadores()
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
         coalesce(sum(pj.goles), 0) as goles,
         count(pj.id) as partidos_jugados
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
      pa.fecha < (current_date - 7)
      or (
        (select count(*) from public.votos v where v.partido_id = pa.id and v.tipo = 'MVP')
          >= greatest((select count(*) from public.partido_jugadores pj where pj.partido_id = pa.id), 1)
        and
        (select count(*) from public.votos v where v.partido_id = pa.id and v.tipo = 'PEOR')
          >= greatest((select count(*) from public.partido_jugadores pj where pj.partido_id = pa.id), 1)
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
  ganadores as (
    select cp.jugador_votado_id, cp.partido_id
    from conteo_por_partido cp
    join maximos m on m.partido_id = cp.partido_id and m.max_votos = cp.votos
  )
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url,
         count(g.partido_id) as veces_elegido,
         (select count(*) from public.partido_jugadores pj where pj.jugador_id = p.id) as partidos_jugados
  from public.profiles p
  left join ganadores g on g.jugador_votado_id = p.id
  group by p.id
  order by veces_elegido desc, p.apellido asc;
$$;
