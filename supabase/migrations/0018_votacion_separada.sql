-- Mejor Jugador y Peor Jugador pasan a ser dos votaciones que el grupo
-- prende o apaga por separado (claves vota_mvp y vota_peor en config, que
-- reemplazan a votacion_activa; ver src/lib/config.ts).
--
-- Igual que con_votacion (ver 0015_admin_config.sql), qué categorías vota
-- un partido se decide una sola vez, al cargar los goles por primera vez:
-- cambiar las reglas después no toca partidos ya jugados.
--
--   con_votacion  el partido tiene alguna votación (como hasta ahora)
--   con_mvp       se vota Mejor Jugador
--   con_peor      se vota Peor Jugador
--
-- Los partidos existentes quedan con las dos (default true), que es lo que
-- tenían; si con_votacion es false no se vota nada, sin importar estas dos.
alter table public.partidos
  add column con_mvp boolean not null default true,
  add column con_peor boolean not null default true;

-- La votación cierra cuando votaron todos en las categorías que tiene el
-- partido (una categoría apagada no se espera). Mismo criterio que
-- src/lib/votacion.ts.
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
