-- Disponibilidad en dos modos: cada jugador elige si marca cuándo PUEDE
-- jugar (lo que deja vacío cuenta como que no puede) o cuándo NO puede (lo
-- vacío cuenta como que sí, como funcionó siempre).
--
--   * profiles.disponibilidad_modo: 'puedo' | 'no_puedo'. null = todavía no
--     eligió (quienes ya habían cargado bloqueos siguen contando como
--     'no_puedo' hasta que respondan la pregunta).
--   * bloqueos_disponibilidad.disponible: true = la marca es de "puedo". Todo
--     lo cargado hasta ahora queda en false (eran marcas de "no puedo").
--     Si en una misma hora hay de las dos, gana "no puedo".
alter table public.profiles
  add column disponibilidad_modo text
  check (disponibilidad_modo in ('puedo', 'no_puedo'));

alter table public.bloqueos_disponibilidad
  add column disponible boolean not null default false;

-- La función del equipo (0035) ahora también dice de qué tipo es cada marca.
-- Cambia lo que devuelve, así que hay que borrarla y crearla de nuevo.
drop function if exists public.get_disponibilidad_grupo(uuid);

create function public.get_disponibilidad_grupo(p_grupo_id uuid)
returns table (
  id uuid,
  jugador_id uuid,
  grupo_id uuid,
  tipo public.disponibilidad_tipo,
  fecha_desde date,
  fecha_hasta date,
  dia_semana smallint,
  hora_desde time,
  hora_hasta time,
  excepciones date[],
  disponible boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select b.id, b.jugador_id, b.grupo_id, b.tipo, b.fecha_desde, b.fecha_hasta,
         b.dia_semana, b.hora_desde, b.hora_hasta, b.excepciones, b.disponible
  from public.bloqueos_disponibilidad b
  where public.es_miembro(p_grupo_id)
    and public.jugador_en_grupo(p_grupo_id, b.jugador_id)
    and (b.grupo_id is null or b.grupo_id = p_grupo_id);
$$;

revoke all on function public.get_disponibilidad_grupo(uuid) from public, anon;
grant execute on function public.get_disponibilidad_grupo(uuid) to authenticated;
