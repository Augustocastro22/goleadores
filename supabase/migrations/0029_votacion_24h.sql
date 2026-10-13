-- Arreglos de votación y de quién queda convocado:
--
--   1) La votación dura 24 horas desde que se carga el resultado (antes eran
--      7 días desde la fecha del partido, y la app y la base no coincidían
--      en el día: la app cerraba el día fecha+7 a las 00:00 UTC y los
--      rankings recién al día siguiente). Ahora el límite queda guardado en
--      partidos.votacion_cierra_en y todos lo leen de ahí.
--   2) votacion_cerrada(): el único criterio de "cerrada" en la base (votaron
--      todos los que jugaron y siguen en el grupo, o venció el plazo). Lo
--      usan el ranking, los ganadores, el desglose y la regla para votar.
--   3) El desglose y los ganadores de un partido solo se ven con la
--      votación cerrada (antes cualquiera los podía pedir por la API y ver
--      el conteo en vivo).
--   4) Votar por la API pide lo mismo que la app: partido jugado, con esa
--      categoría y con la votación abierta.
--   5) Quien se va de un grupo (sale, lo sacan o borra la cuenta) deja de
--      estar convocado en los partidos del grupo que todavía no se jugaron.
--      Los ya jugados no se tocan: son historia.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Plazo de la votación
-- ─────────────────────────────────────────────────────────────────────────
alter table public.partidos add column votacion_cierra_en timestamptz;

-- Partidos ya jugados: conservan el plazo viejo (7 días desde la fecha, a
-- las 00:00 de Argentina), así no se cierra de golpe una votación abierta.
update public.partidos
set votacion_cierra_en = ((fecha + 7)::timestamp at time zone 'America/Argentina/Buenos_Aires')
where jugado;

-- Se fija una sola vez, cuando el partido pasa a jugado (cargar el
-- resultado, o un desafío que se da por jugado). Después no se puede cambiar
-- (ni el admin desde la API).
create or replace function public.fijar_cierre_votacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not new.jugado then
    new.votacion_cierra_en := null;
  elsif tg_op = 'UPDATE' and old.jugado then
    new.votacion_cierra_en := old.votacion_cierra_en;
  else
    new.votacion_cierra_en := now() + interval '24 hours';
  end if;
  return new;
end;
$$;

create trigger trg_fijar_cierre_votacion
  before insert or update on public.partidos
  for each row execute procedure public.fijar_cierre_votacion();

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Criterio único de votación cerrada (mismo que src/lib/votacion.ts)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.votacion_cerrada(p_partido_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  with pa as (
    select * from public.partidos where id = p_partido_id
  ), conteo as (
    select
      (select count(*) from public.partido_jugadores pj
        where pj.partido_id = p_partido_id and public.jugador_en_grupo(pa.grupo_id, pj.jugador_id)) as participantes,
      (select count(*) from public.votos v
        where v.partido_id = p_partido_id and v.tipo = 'MVP'
          and public.jugador_en_grupo(pa.grupo_id, v.jugador_que_vota_id)) as votos_mvp,
      (select count(*) from public.votos v
        where v.partido_id = p_partido_id and v.tipo = 'PEOR'
          and public.jugador_en_grupo(pa.grupo_id, v.jugador_que_vota_id)) as votos_peor
    from pa
  )
  select coalesce((
    select pa.jugado and pa.con_votacion and (
      (pa.votacion_cierra_en is not null and now() >= pa.votacion_cierra_en)
      or (
        c.participantes > 0
        and (not pa.con_mvp or c.votos_mvp >= c.participantes)
        and (not pa.con_peor or c.votos_peor >= c.participantes)
      )
    )
    from pa, conteo c
  ), false);
$$;

grant execute on function public.votacion_cerrada(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Ranking, ganadores y desglose: solo con la votación cerrada
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
    and not exists (
      select 1 from public.desempates
      where partido_id = p_partido_id and tipo = p_tipo and not resuelto
    )
    and public.es_miembro(public.grupo_de_partido(p_partido_id))
    and public.votacion_cerrada(p_partido_id);
$$;

create or replace function public.get_desglose_votos(p_partido_id uuid, p_tipo public.voto_tipo)
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
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url, count(*) as votos
  from public.votos v
  join public.profiles p on p.id = v.jugador_votado_id
  where v.partido_id = p_partido_id and v.tipo = p_tipo
    and public.es_miembro(public.grupo_de_partido(p_partido_id))
    and public.votacion_cerrada(p_partido_id)
  group by p.id
  order by votos desc, p.apellido asc;
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

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Votar: las mismas condiciones que valida la app en votar()
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "votos_insert_own" on public.votos;

create policy "votos_insert_own"
  on public.votos for insert
  to authenticated
  with check (
    jugador_que_vota_id = auth.uid()
    and jugador_votado_id <> jugador_que_vota_id
    and public.es_miembro(public.grupo_de_partido(partido_id))
    and exists (
      select 1 from public.partido_jugadores pj
      where pj.partido_id = votos.partido_id and pj.jugador_id = votos.jugador_votado_id
    )
    and exists (
      select 1 from public.partido_jugadores pj2
      where pj2.partido_id = votos.partido_id and pj2.jugador_id = votos.jugador_que_vota_id
    )
    and exists (
      select 1 from public.partidos pa
      where pa.id = votos.partido_id
        and pa.jugado
        and pa.con_votacion
        and (case votos.tipo when 'MVP' then pa.con_mvp else pa.con_peor end)
    )
    and not public.votacion_cerrada(partido_id)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 5) Al irse de un grupo, sale de las convocatorias pendientes
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.sacar_de_convocatorias_pendientes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.partido_jugadores pj
  using public.partidos pa
  where pa.id = pj.partido_id
    and pa.grupo_id = old.grupo_id
    and not pa.jugado
    and pj.jugador_id = old.jugador_id;
  return old;
end;
$$;

create trigger trg_sacar_de_convocatorias_pendientes
  after delete on public.grupo_miembros
  for each row execute procedure public.sacar_de_convocatorias_pendientes();
