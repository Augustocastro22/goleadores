-- Quiénes ya cargaron su disponibilidad, para mirar desde el dashboard de
-- Supabase (schema "admin", solo lectura, como las de 0021, 0025 y 0033).
-- Un usuario por fila, con los que todavía no cargaron nada también (la
-- columna "cargo" dice Sí/No). Los que cargaron salen primero, por la
-- última carga. Las cuentas borradas quedan afuera.
create or replace view admin.disponibilidad as
  select
    admin.jugador(p.id) as jugador,
    u.email,
    case
      when exists (select 1 from public.bloqueos_disponibilidad b where b.jugador_id = p.id)
        then 'Sí'
      else 'No'
    end as cargo,
    (select count(*) from public.bloqueos_disponibilidad b where b.jugador_id = p.id) as bloqueos,
    (select count(*) from public.bloqueos_disponibilidad b
      where b.jugador_id = p.id and b.tipo = 'recurrente') as que_se_repiten,
    (select min(b.created_at) from public.bloqueos_disponibilidad b where b.jugador_id = p.id) as primera_carga,
    (select max(b.created_at) from public.bloqueos_disponibilidad b where b.jugador_id = p.id) as ultima_carga,
    (select string_agg(g.nombre, ', ' order by g.nombre)
       from public.grupo_miembros gm
       join public.grupos g on g.id = gm.grupo_id
      where gm.jugador_id = p.id) as grupos
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.eliminado_en is null
  order by ultima_carga desc nulls last, u.created_at desc;
