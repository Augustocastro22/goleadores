-- Un partido programado a futuro no debe contar para las estadísticas de
-- los jugadores (goles, partidos jugados, veces elegido) hasta que el admin
-- carga los goles y pasa a jugado = true.

drop function if exists public.get_goleadores();
drop function if exists public.get_ranking_votos(public.voto_tipo);

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
         coalesce(sum(pj.goles) filter (where pa.jugado), 0) as goles,
         count(pj.id) filter (where pa.jugado) as partidos_jugados
  from public.profiles p
  left join public.partido_jugadores pj on pj.jugador_id = p.id
  left join public.partidos pa on pa.id = pj.partido_id
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
      pa.jugado
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
  ganadores as (
    select cp.jugador_votado_id, cp.partido_id
    from conteo_por_partido cp
    join maximos m on m.partido_id = cp.partido_id and m.max_votos = cp.votos
  )
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url,
         count(g.partido_id) as veces_elegido,
         (
           select count(*)
           from public.partido_jugadores pj
           join public.partidos pa on pa.id = pj.partido_id
           where pj.jugador_id = p.id and pa.jugado
         ) as partidos_jugados
  from public.profiles p
  left join ganadores g on g.jugador_votado_id = p.id
  group by p.id
  order by veces_elegido desc, p.apellido asc;
$$;
