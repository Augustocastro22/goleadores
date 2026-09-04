-- Dos cambios para que la votación no filtre información mientras está
-- abierta:
--   1) get_ranking_votos ahora solo cuenta votos de partidos cuya votación
--      ya cerró (mismo criterio que src/lib/votacion.ts: todos votaron
--      ambas categorías, o pasaron 7 días desde la fecha del partido).
--      Si cambiás VOTACION_DIAS_LIMITE en el código, actualizá también el
--      "7" de acá.
--   2) get_ganadores_votacion(partido, tipo) devuelve el/los ganador/es de
--      un partido puntual (con empate incluye a todos), para mostrar en el
--      detalle del partido una vez cerrada la votación, sin exponer los
--      votos individuales.

create or replace function public.get_ranking_votos(p_tipo public.voto_tipo)
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
  )
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url,
         count(v.id) as votos
  from public.profiles p
  left join public.votos v
    on v.jugador_votado_id = p.id
    and v.tipo = p_tipo
    and v.partido_id in (select id from cerrados)
  group by p.id
  order by votos desc, p.apellido asc;
$$;

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
  )
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url, c.votos
  from conteo c
  join public.profiles p on p.id = c.jugador_votado_id
  cross join maximo m
  where c.votos = m.max_votos and m.max_votos > 0;
$$;

grant execute on function public.get_ganadores_votacion(uuid, public.voto_tipo) to authenticated;
