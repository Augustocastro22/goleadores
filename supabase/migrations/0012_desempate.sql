-- Desempate de MVP/Peor Jugador: cuando dos o más jugadores empatan en el
-- primer puesto de una categoría y el empate se puede definir sin riesgo de
-- volver a empatar (ver src/lib/desempate.ts para la regla exacta), se abre
-- una revotación exclusiva entre los empatados, solo para quienes no
-- votaron a ninguno de ellos y no son ellos mismos uno de los empatados.
-- Si no se puede definir (0 elegibles, o riesgo de re-empate), no se crea
-- nada acá y todo sigue como antes: cuentan todos los empatados.

create table public.desempates (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos (id) on delete cascade,
  tipo public.voto_tipo not null,
  candidatos uuid[] not null,
  elegibles uuid[] not null,
  resuelto boolean not null default false,
  ganador_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (partido_id, tipo)
);

create table public.desempate_votos (
  id uuid primary key default gen_random_uuid(),
  desempate_id uuid not null references public.desempates (id) on delete cascade,
  jugador_votado_id uuid not null references public.profiles (id),
  jugador_que_vota_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (desempate_id, jugador_que_vota_id)
);

alter table public.desempates enable row level security;
alter table public.desempate_votos enable row level security;

-- Mientras no está resuelto, que solo lo vean quienes pueden definirlo y el
-- admin, igual que el resto de la votación no expone nada mientras sigue
-- abierta. Una vez resuelto, cualquiera puede ver el resultado.
-- Las filas las crea/actualiza el server con la service role key
-- (createAdminClient, bypassea RLS): no hace falta política de insert ni
-- de update para usuarios autenticados.
create policy "desempates_select_elegible_o_resuelto"
  on public.desempates for select
  to authenticated
  using (resuelto or auth.uid() = any(elegibles) or public.is_admin());

create policy "desempate_votos_select_own_or_admin"
  on public.desempate_votos for select
  to authenticated
  using (jugador_que_vota_id = auth.uid() or public.is_admin());

create policy "desempate_votos_insert_own"
  on public.desempate_votos for insert
  to authenticated
  with check (
    jugador_que_vota_id = auth.uid()
    and exists (
      select 1 from public.desempates d
      where d.id = desempate_votos.desempate_id
        and not d.resuelto
        and auth.uid() = any(d.elegibles)
        and desempate_votos.jugador_votado_id = any(d.candidatos)
    )
  );

-- Necesarias para que el borrado en cascada de un partido (deletePartido,
-- que corre como admin autenticado, no con la service role) pueda barrer
-- estas filas, igual que ya pasa con partido_jugadores_delete_admin y
-- votos_delete_admin.
create policy "desempates_delete_admin"
  on public.desempates for delete
  to authenticated
  using (public.is_admin());

create policy "desempate_votos_delete_admin"
  on public.desempate_votos for delete
  to authenticated
  using (public.is_admin());

-- get_ganadores_votacion: si hay un desempate resuelto para este
-- partido+tipo, devuelve solo al ganador definido en vez de todos los
-- empatados. Si no hay desempate (o sigue sin resolver), se comporta igual
-- que antes.
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
    and (not exists (select 1 from definido) or p.id = (select ganador_id from definido));
$$;

-- get_ranking_votos: cuando un partido tuvo empate y se resolvió por
-- desempate, solo el ganador definido suma "veces_elegido" en ese partido
-- (no los dos/tres empatados). Sin desempate resuelto, sigue igual que
-- antes (cuentan todos los empatados).
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
  desempatados as (
    select partido_id, ganador_id
    from public.desempates
    where tipo = p_tipo and resuelto and ganador_id is not null
  ),
  ganadores as (
    select cp.jugador_votado_id, cp.partido_id
    from conteo_por_partido cp
    join maximos m on m.partido_id = cp.partido_id and m.max_votos = cp.votos
    where not exists (select 1 from desempatados d where d.partido_id = cp.partido_id)
    union all
    select ganador_id as jugador_votado_id, partido_id
    from desempatados
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
