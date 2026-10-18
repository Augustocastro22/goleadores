-- Más vistas para mirar los datos desde el dashboard de Supabase, como las
-- de 0021_vistas_admin.sql y 0025_vistas_admin_partidos.sql: solo de lectura
-- y en el schema admin, que no está expuesto en la API.
-- En el Table Editor se ven eligiendo el schema "admin" arriba a la izquierda.

-- Un usuario por fila: cuándo se registró, cuándo entró por última vez, en
-- qué grupos está y en cuántos dispositivos tiene las notificaciones
-- activadas. Las cuentas borradas (perfil anonimizado, sin usuario de auth)
-- quedan afuera.
create or replace view admin.usuarios as
  select
    admin.jugador(p.id) as jugador,
    u.email,
    u.created_at as registrado_el,
    u.last_sign_in_at as ultimo_ingreso,
    (select string_agg(g.nombre || case when gm.rol = 'admin' then ' (admin)' else '' end, ', ' order by g.nombre)
       from public.grupo_miembros gm
       join public.grupos g on g.id = gm.grupo_id
      where gm.jugador_id = p.id) as grupos,
    (select count(*) from public.push_subscriptions ps where ps.user_id = p.id) as notificaciones,
    (select count(*) from public.partido_jugadores pj
       join public.partidos pa on pa.id = pj.partido_id
      where pj.jugador_id = p.id and pa.jugado and pj.respuesta = 'juega') as partidos_jugados
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.eliminado_en is null
  order by u.created_at desc;

-- Quiénes tienen las notificaciones activadas: una fila por dispositivo
-- (cada navegador o celular donde las activó es una suscripción aparte).
-- El servicio de push sale del endpoint y da una idea del dispositivo.
create or replace view admin.notificaciones as
  select
    admin.jugador(ps.user_id) as jugador,
    u.email,
    case
      when ps.endpoint like 'https://web.push.apple.com/%' then 'Apple (iPhone / Mac)'
      when ps.endpoint like 'https://fcm.googleapis.com/%' then 'Google (Android / Chrome)'
      when ps.endpoint like '%mozilla.com/%' then 'Firefox'
      when ps.endpoint like '%notify.windows.com/%' then 'Windows (Edge)'
      else 'Otro'
    end as servicio,
    ps.created_at as activadas_el,
    (select string_agg(g.nombre, ', ' order by g.nombre)
       from public.grupo_miembros gm
       join public.grupos g on g.id = gm.grupo_id
      where gm.jugador_id = ps.user_id) as grupos
  from public.push_subscriptions ps
  left join auth.users u on u.id = ps.user_id
  order by ps.created_at desc;
