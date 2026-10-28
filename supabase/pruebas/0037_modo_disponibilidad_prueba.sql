-- Prueba de 0037 (modo puedo / no puedo). SOLO para el SQL Editor del proyecto de TEST,
-- DESPUÉS de correr 0037_modo_disponibilidad.sql.
-- Usa Ana (admin de "Fútbol de los jueves", jugadora en "Grupo de Beto") y Beto (admin de
-- "Grupo de Beto"); no crea usuarios. Inserta dos bloqueos de prueba, consulta como cada uno
-- y termina con un error a propósito que deshace todo. El resultado sale en el mensaje del error.
do $$
declare
  ana uuid := (select id from public.profiles where id::text like '169c5c%');
  beto uuid := (select id from public.profiles where id::text like '3850f6%');
  g_beto uuid := 'e1edd3d1-33ee-44a0-8d86-a5abd50f40c6';
  informe text := '';
  n int;
begin
  -- Lo ya cargado quedó como "no puedo" (disponible = false) y los perfiles sin modo elegido.
  select count(*) into n from public.bloqueos_disponibilidad where disponible is null;
  informe := informe || E'\n' || case when n = 0 then 'OK   ' else 'FALLA' end || ' Ningún bloqueo tiene disponible nulo';
  select count(*) into n from public.profiles where disponibilidad_modo is not null;
  informe := informe || E'\n' || 'INFO ' || n || ' perfiles ya tienen modo elegido';

  insert into public.bloqueos_disponibilidad (jugador_id, grupo_id, tipo, dia_semana, hora_desde, hora_hasta, nota, disponible) values
    (ana, null, 'recurrente', 1, '19:00', '22:00', 'PRUEBA puedo', true),
    (ana, null, 'recurrente', 2, '19:00', '22:00', 'PRUEBA no puedo', false);

  -- Como Beto: la función devuelve el tipo de cada marca de Ana.
  perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.get_disponibilidad_grupo(g_beto) where jugador_id = ana and dia_semana = 1 and disponible;
  informe := informe || E'\n' || case when n = 1 then 'OK   ' else 'FALLA' end || ' Beto ve la marca de "puedo" de Ana con disponible = true';
  select count(*) into n from public.get_disponibilidad_grupo(g_beto) where jugador_id = ana and dia_semana = 2 and not disponible;
  informe := informe || E'\n' || case when n = 1 then 'OK   ' else 'FALLA' end || ' Beto ve la marca de "no puedo" de Ana con disponible = false';
  select count(*) into n from pg_proc p, unnest(p.proargnames) a
    where p.proname = 'get_disponibilidad_grupo' and a = 'nota';
  informe := informe || E'\n' || case when n = 0 then 'OK   ' else 'FALLA' end || ' La función sigue sin devolver la nota';

  -- Como Ana: puede elegir su propio modo, pero no el de otro.
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
  update public.profiles set disponibilidad_modo = 'puedo' where id = ana;
  get diagnostics n = row_count;
  informe := informe || E'\n' || case when n = 1 then 'OK   ' else 'FALLA' end || ' Ana puede elegir su modo';
  update public.profiles set disponibilidad_modo = 'puedo' where id = beto;
  get diagnostics n = row_count;
  informe := informe || E'\n' || case when n = 0 then 'OK   ' else 'FALLA' end || ' Ana no puede cambiar el modo de Beto';

  raise exception E'RESULTADO (se deshace todo, no queda nada guardado):%', informe;
end $$;
