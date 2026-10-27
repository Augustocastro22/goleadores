-- Disponibilidad del equipo: cualquier miembro de un grupo puede ver cuándo
-- no puede jugar cada compañero (para elegir un horario que les sirva a
-- todos). La tabla bloqueos_disponibilidad sigue siendo privada (solo el
-- dueño y los admins, ver 0016); esto se expone por una función que:
--   * solo responde a miembros del grupo,
--   * devuelve los bloqueos generales (sin grupo) y los de ese grupo,
--   * NO devuelve la nota, que es privada ("de viaje", "médico"...).
create or replace function public.get_disponibilidad_grupo(p_grupo_id uuid)
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
  excepciones date[]
)
language sql
security definer
stable
set search_path = public
as $$
  select b.id, b.jugador_id, b.grupo_id, b.tipo, b.fecha_desde, b.fecha_hasta,
         b.dia_semana, b.hora_desde, b.hora_hasta, b.excepciones
  from public.bloqueos_disponibilidad b
  where public.es_miembro(p_grupo_id)
    and public.jugador_en_grupo(p_grupo_id, b.jugador_id)
    and (b.grupo_id is null or b.grupo_id = p_grupo_id);
$$;

revoke all on function public.get_disponibilidad_grupo(uuid) from public, anon;
grant execute on function public.get_disponibilidad_grupo(uuid) to authenticated;
