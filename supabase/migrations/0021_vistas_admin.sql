-- Vistas para mirar los datos desde el dashboard de Supabase (Table Editor)
-- con nombres en vez de ids. Son solo de lectura y no las usa la app.
--
-- Viven en un schema aparte (admin) que no está expuesto en la API, así que
-- nadie las puede consultar desde afuera: sin esto, una vista en public se
-- saltea el RLS y deja ver todo a cualquiera con la anon key.
-- En el Table Editor se ven eligiendo el schema "admin" arriba a la izquierda.

create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

create or replace view admin.grupo_miembros as
  select
    g.nombre as grupo,
    trim(p.nombre || ' ' || p.apellido)
      || case when p.apodo <> '' then ' (' || p.apodo || ')' else '' end as jugador,
    gm.rol
  from public.grupo_miembros gm
  join public.grupos g on g.id = gm.grupo_id
  join public.profiles p on p.id = gm.jugador_id
  order by g.nombre, gm.rol, jugador;
