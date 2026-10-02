-- Qué pasa con los datos de alguien que se va de un grupo (o lo sacan):
--
--   1) Sigue apareciendo en las tablas históricas del grupo (goleadores,
--      MVP, Peor) con lo que hizo mientras estuvo, marcado como que ya no
--      está (columna sigue_en_grupo). Antes las tablas salían solo de los
--      miembros actuales y desaparecía de golpe.
--   2) Deja de contar para cerrar una votación abierta: la votación cierra
--      cuando votaron todos los que jugaron Y siguen en el grupo (los votos
--      que ya había hecho cuentan igual para el resultado). Si no, un
--      partido quedaba esperando un voto que nunca iba a llegar.
--      (Los desempates se resuelven sin él desde el código, ver
--      src/lib/votaciones.ts.)
--
-- El criterio de cierre de get_estado_votacion y de get_ranking_votos tiene
-- que ser el mismo (y el mismo que src/lib/votacion.ts).

drop function if exists public.get_goleadores(uuid);
drop function if exists public.get_ranking_votos(uuid, public.voto_tipo);

-- Jugadores que cuentan para las tablas de un grupo: los miembros actuales
-- y cualquiera que haya jugado un partido (ya jugado) del grupo.
create or replace function public.get_goleadores(p_grupo_id uuid)
returns table (
  jugador_id uuid,
  nombre text,
  apellido text,
  apodo text,
  foto_url text,
  goles bigint,
  partidos_jugados bigint,
  sigue_en_grupo boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with jugadores as (
    select gm.jugador_id from public.grupo_miembros gm where gm.grupo_id = p_grupo_id
    union
    select pj.jugador_id
    from public.partido_jugadores pj
    join public.partidos pa on pa.id = pj.partido_id
    where pa.grupo_id = p_grupo_id and pa.jugado
  )
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url,
         coalesce(sum(pj.goles) filter (where pa.jugado), 0) as goles,
         count(pj.id) filter (where pa.jugado) as partidos_jugados,
         public.jugador_en_grupo(p_grupo_id, p.id) as sigue_en_grupo
  from jugadores j
  join public.profiles p on p.id = j.jugador_id
  left join public.partido_jugadores pj
    on pj.jugador_id = p.id
    and pj.partido_id in (select id from public.partidos where grupo_id = p_grupo_id)
  left join public.partidos pa on pa.id = pj.partido_id
  where public.es_miembro(p_grupo_id)
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
    where
      pa.grupo_id = p_grupo_id
      and pa.jugado
      and (
        pa.fecha < (current_date - 7)
        or (
          (select count(*) from public.votos v
            where v.partido_id = pa.id and v.tipo = 'MVP'
              and public.jugador_en_grupo(p_grupo_id, v.jugador_que_vota_id))
            >= greatest((select count(*) from public.partido_jugadores pj
              where pj.partido_id = pa.id and public.jugador_en_grupo(p_grupo_id, pj.jugador_id)), 1)
          and
          (select count(*) from public.votos v
            where v.partido_id = pa.id and v.tipo = 'PEOR'
              and public.jugador_en_grupo(p_grupo_id, v.jugador_que_vota_id))
            >= greatest((select count(*) from public.partido_jugadores pj
              where pj.partido_id = pa.id and public.jugador_en_grupo(p_grupo_id, pj.jugador_id)), 1)
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

grant execute on function public.get_goleadores(uuid) to authenticated;
grant execute on function public.get_ranking_votos(uuid, public.voto_tipo) to authenticated;

-- Conteos para saber si la votación de un partido ya cerró: participantes y
-- votos de quienes siguen en el grupo.
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
    (select count(*) from public.partido_jugadores pj
      where pj.partido_id = p_partido_id
        and public.jugador_en_grupo(public.grupo_de_partido(p_partido_id), pj.jugador_id)
    ) as total_participantes,
    (select count(*) from public.votos v
      where v.partido_id = p_partido_id and v.tipo = 'MVP'
        and public.jugador_en_grupo(public.grupo_de_partido(p_partido_id), v.jugador_que_vota_id)
    ) as votos_mvp,
    (select count(*) from public.votos v
      where v.partido_id = p_partido_id and v.tipo = 'PEOR'
        and public.jugador_en_grupo(public.grupo_de_partido(p_partido_id), v.jugador_que_vota_id)
    ) as votos_peor
  where public.es_miembro(public.grupo_de_partido(p_partido_id));
$$;
