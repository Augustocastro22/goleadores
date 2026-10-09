-- Más vistas para mirar los datos desde el dashboard de Supabase, como
-- admin.grupo_miembros (ver 0021_vistas_admin.sql): con nombres en vez de
-- ids, solo de lectura y en el schema admin, que no está expuesto en la API.
-- En el Table Editor se ven eligiendo el schema "admin" arriba a la izquierda.

-- "Nombre Apellido (apodo)", como en admin.grupo_miembros.
create or replace function admin.jugador(p_id uuid)
returns text
language sql
stable
as $$
  select trim(p.nombre || ' ' || p.apellido)
    || case when p.apodo <> '' then ' (' || p.apodo || ')' else '' end
  from public.profiles p
  where p.id = p_id;
$$;

-- Un partido por fila, con el resultado armado como en la app: equipo 1 =
-- goles de sus jugadores + otros; equipo 2 = goles de sus jugadores + rival.
create or replace view admin.partidos as
  select
    g.nombre as grupo,
    pa.fecha,
    pa.hora,
    pa.rival,
    pa.lugar,
    case when pa.jugado
      then (coalesce(pj.goles_equipo1, 0) + pa.goles_otros) || '-' || (coalesce(pj.goles_equipo2, 0) + pa.goles_rival)
    end as resultado,
    pa.jugado,
    pa.desafio_id is not null as es_desafio,
    coalesce(pj.convocados, 0) as convocados,
    coalesce(pj.juegan, 0) as juegan,
    coalesce(pj.pendientes, 0) as pendientes,
    case when pa.con_votacion
      then concat_ws(' y ', case when pa.con_mvp then 'MVP' end, case when pa.con_peor then 'Peor' end)
      else 'no'
    end as votacion,
    admin.jugador(pa.created_by) as cargado_por,
    pa.created_at as cargado_el
  from public.partidos pa
  join public.grupos g on g.id = pa.grupo_id
  left join lateral (
    select
      sum(goles) filter (where equipo = 1) as goles_equipo1,
      sum(goles) filter (where equipo = 2) as goles_equipo2,
      count(*) as convocados,
      count(*) filter (where respuesta = 'juega') as juegan,
      count(*) filter (where respuesta = 'pendiente') as pendientes
    from public.partido_jugadores
    where partido_id = pa.id
  ) pj on true
  order by pa.fecha desc, pa.hora desc nulls last, g.nombre;

-- Quién jugó (o está convocado) en cada partido, en qué equipo y con cuántos goles.
create or replace view admin.partido_jugadores as
  select
    g.nombre as grupo,
    pa.fecha,
    pa.rival,
    admin.jugador(pj.jugador_id) as jugador,
    pj.equipo,
    pj.goles,
    pj.respuesta
  from public.partido_jugadores pj
  join public.partidos pa on pa.id = pj.partido_id
  join public.grupos g on g.id = pa.grupo_id
  order by pa.fecha desc, g.nombre, pj.equipo, pj.goles desc, jugador;

-- Votos de MVP y Peor de cada partido.
create or replace view admin.votos as
  select
    g.nombre as grupo,
    pa.fecha,
    pa.rival,
    v.tipo,
    admin.jugador(v.jugador_que_vota_id) as vota,
    admin.jugador(v.jugador_votado_id) as votado,
    v.created_at as votado_el
  from public.votos v
  join public.partidos pa on pa.id = v.partido_id
  join public.grupos g on g.id = pa.grupo_id
  order by pa.fecha desc, g.nombre, v.tipo, votado;

-- Desafíos entre grupos. El marcador es el verificado (vacío si no hubo acuerdo).
create or replace view admin.desafios as
  select
    d.nombre_desafiante as desafiante,
    d.nombre_desafiado as desafiado,
    d.fecha,
    d.hora,
    d.lugar,
    d.estado,
    d.resultado_estado,
    case when d.goles_desafiante is not null
      then d.goles_desafiante || '-' || d.goles_desafiado
    end as marcador,
    case when d.propuesta_fecha is not null
      then d.propuesta_fecha || coalesce(' ' || d.propuesta_hora, '') || ' en ' || d.propuesta_lugar
    end as fecha_propuesta,
    admin.jugador(d.creado_por) as creado_por,
    d.created_at as creado_el
  from public.desafios d
  order by d.fecha desc, d.created_at desc;

-- Un resumen por grupo, para ver qué grupos se usan de verdad.
create or replace view admin.grupos as
  select
    g.nombre as grupo,
    admin.jugador(g.created_by) as creado_por,
    g.created_at as creado_el,
    (select count(*) from public.grupo_miembros gm where gm.grupo_id = g.id) as miembros,
    (select count(*) from public.grupo_miembros gm where gm.grupo_id = g.id and gm.rol = 'admin') as admins,
    (select count(*) from public.partidos pa where pa.grupo_id = g.id and pa.jugado) as partidos_jugados,
    (select count(*) from public.partidos pa where pa.grupo_id = g.id and not pa.jugado) as partidos_por_jugar,
    (select max(pa.fecha) from public.partidos pa where pa.grupo_id = g.id and pa.jugado) as ultimo_partido,
    g.requiere_aprobacion
  from public.grupos g
  order by ultimo_partido desc nulls last, g.nombre;

-- Encuestas con los votos de cada opción (una fila por opción).
create or replace view admin.encuestas as
  select
    g.nombre as grupo,
    e.pregunta,
    o.texto as opcion,
    (select count(*) from public.encuesta_votos ev where ev.opcion_id = o.id) as votos,
    e.cierra_en,
    admin.jugador(e.creado_por) as creada_por
  from public.encuestas e
  join public.grupos g on g.id = e.grupo_id
  join public.encuesta_opciones o on o.encuesta_id = e.id
  order by e.created_at desc, o.orden;
