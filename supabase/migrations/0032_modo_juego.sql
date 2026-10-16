-- Cómo juega el grupo (ver src/lib/config.ts, ModoJuego): un equipo que juega
-- contra otros, o entre ellos divididos en dos equipos. La elección del grupo
-- y los nombres por defecto de los equipos van en config (sin migración);
-- acá va lo que hace falta por partido y para las tablas.
--
--   partidos.nombre_equipo  El nombre del primer equipo cuando juegan entre
--                           ellos ("Blancos"); el segundo es partidos.rival.
--                           Se guarda en cada partido para que los viejos
--                           sigan mostrando los nombres de ese día aunque el
--                           grupo los cambie. null: "Nosotros" (contra otro
--                           equipo) o el nombre por defecto del grupo.
--
--   get_goleadores(grupo, filtro)
--                           La tabla de goleadores filtrada por tipo de
--                           partido: 'todos', 'rivales' (contra otros
--                           equipos y desafíos) o 'entre_nosotros'. Un
--                           partido es entre ellos si alguien del grupo jugó
--                           en el segundo equipo (y no es un desafío): así se
--                           leen igual los partidos de antes. La versión de un
--                           solo parámetro queda como estaba.

alter table public.partidos add column nombre_equipo text;

create or replace function public.partido_es_interno(p_partido_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.partidos pa
    join public.partido_jugadores pj on pj.partido_id = pa.id and pj.equipo = 2
    where pa.id = p_partido_id and pa.desafio_id is null
  );
$$;

create or replace function public.get_goleadores(p_grupo_id uuid, p_filtro text)
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
  with partidos_filtrados as (
    select pa.id
    from public.partidos pa
    where pa.grupo_id = p_grupo_id
      and pa.jugado
      and (
        p_filtro = 'todos'
        or (p_filtro = 'entre_nosotros') = public.partido_es_interno(pa.id)
      )
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
         coalesce(sum(pj.goles), 0) as goles,
         count(pj.id) as partidos_jugados,
         public.jugador_en_grupo(p_grupo_id, p.id) as sigue_en_grupo
  from jugadores j
  join public.profiles p on p.id = j.jugador_id
  left join public.partido_jugadores pj
    on pj.jugador_id = p.id
    and pj.partido_id in (select id from partidos_filtrados)
  where public.es_miembro(p_grupo_id)
  group by p.id
  order by goles desc, p.apellido asc;
$$;

grant execute on function public.get_goleadores(uuid, text) to authenticated;
