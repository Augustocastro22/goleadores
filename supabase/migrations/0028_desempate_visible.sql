-- Un empate que todavía se está definiendo (desempate sin resolver) no tiene
-- ganador: antes, mientras se definía, contaban los dos empatados en el
-- ranking y en "último partido", y como el desempate pendiente solo lo veían
-- quienes lo definen y el admin, el resto del grupo veía a los dos como
-- ganadores sin saber que faltaba definirlo.
--
--   get_desempates_partido  los desempates de un partido para cualquier
--                           miembro (sin quiénes lo definen: eso deja ver a
--                           quién no votó cada uno), y si yo puedo definirlo.
--   get_ganadores_votacion  sin ganadores mientras el desempate está pendiente.
--   get_ranking_votos       ese partido no cuenta hasta que se defina.

create or replace function public.get_desempates_partido(p_partido_id uuid)
returns table (
  id uuid,
  tipo public.voto_tipo,
  candidatos uuid[],
  candidatos_apodos text[],
  resuelto boolean,
  ganador_id uuid,
  puedo_definir boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select d.id, d.tipo, d.candidatos,
         array(select p.apodo from unnest(d.candidatos) with ordinality c(id, n)
               join public.profiles p on p.id = c.id order by c.n) as candidatos_apodos,
         d.resuelto, d.ganador_id,
         not d.resuelto
           and auth.uid() = any(d.elegibles)
           and not exists (select 1 from public.desempate_votos dv
                           where dv.desempate_id = d.id and dv.jugador_que_vota_id = auth.uid())
           as puedo_definir
  from public.desempates d
  where d.partido_id = p_partido_id
    and public.es_miembro(public.grupo_de_partido(p_partido_id));
$$;

grant execute on function public.get_desempates_partido(uuid) to authenticated;

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
    and not exists (
      select 1 from public.desempates
      where partido_id = p_partido_id and tipo = p_tipo and not resuelto
    )
    and public.es_miembro(public.grupo_de_partido(p_partido_id));
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
          (
            not pa.con_mvp
            or (select count(*) from public.votos v
              where v.partido_id = pa.id and v.tipo = 'MVP'
                and public.jugador_en_grupo(p_grupo_id, v.jugador_que_vota_id))
              >= greatest((select count(*) from public.partido_jugadores pj
                where pj.partido_id = pa.id and public.jugador_en_grupo(p_grupo_id, pj.jugador_id)), 1)
          )
          and
          (
            not pa.con_peor
            or (select count(*) from public.votos v
              where v.partido_id = pa.id and v.tipo = 'PEOR'
                and public.jugador_en_grupo(p_grupo_id, v.jugador_que_vota_id))
              >= greatest((select count(*) from public.partido_jugadores pj
                where pj.partido_id = pa.id and public.jugador_en_grupo(p_grupo_id, pj.jugador_id)), 1)
          )
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
