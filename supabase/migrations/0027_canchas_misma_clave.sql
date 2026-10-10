-- Dos canchas son la misma si sus nombres coinciden ignorando también espacios
-- y signos, no solo mayúsculas y tildes: "GreenPark", "Green Park" y
-- "Green-Park" son una sola. Así, si en un desafío el otro grupo la escribió
-- distinto, el partido queda en la cancha que el grupo ya tenía.
--
-- Las canchas que ya quedaron repetidas por esto se unifican: queda la que
-- tiene más partidos y las demás le pasan los suyos.

-- El índice usa la función: se saca mientras se cambia y se unifican las repetidas.
drop index public.canchas_grupo_nombre;

create or replace function public.normalizar_lugar(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(translate(p, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]', '', 'g');
$$;

-- Sin el trigger: con repetidas, buscar la cancha por nombre daría cualquiera.
alter table public.partidos disable trigger trg_asignar_cancha;

create temp table canchas_unificar as
select c.id, c.queda, q.nombre as nombre_queda
from (
  select c.id,
    first_value(c.id) over (
      partition by c.grupo_id, public.normalizar_lugar(c.nombre)
      order by (select count(*) from public.partidos p where p.cancha_id = c.id) desc, c.created_at
    ) as queda
  from public.canchas c
) c
join public.canchas q on q.id = c.queda
where c.id <> c.queda;

-- Los partidos de desafío mantienen el lugar que acordaron los dos grupos.
update public.partidos p
set cancha_id = u.queda,
    lugar = case when p.desafio_id is null then u.nombre_queda else p.lugar end
from canchas_unificar u
where p.cancha_id = u.id;

delete from public.canchas c using canchas_unificar u where c.id = u.id;
drop table canchas_unificar;

alter table public.partidos enable trigger trg_asignar_cancha;

create unique index canchas_grupo_nombre on public.canchas (grupo_id, public.normalizar_lugar(nombre));
