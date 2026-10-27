-- Prueba de get_disponibilidad_grupo (0035). SOLO para el SQL Editor del proyecto de TEST.
-- No crea usuarios: usa Ana (admin de "Fútbol de los jueves", jugadora en "Grupo de Beto") y Beto
-- (admin de "Grupo de Beto"). Inserta 4 bloqueos de prueba, consulta la función como cada uno
-- y termina con un error a propósito, que deshace todo (no queda nada guardado).
-- El resultado está en el mensaje del error: cada línea es OK o FALLA.
do $$
declare
  ana uuid := (select id from public.profiles where id::text like '169c5c%');
  beto uuid := (select id from public.profiles where id::text like '3850f6%');
  g_ana uuid := '38f143e9-794d-47bf-b3d5-02d9973ab490';
  g_beto uuid := 'e1edd3d1-33ee-44a0-8d86-a5abd50f40c6';
  informe text := '';
  n int;
begin
  insert into public.bloqueos_disponibilidad (jugador_id, grupo_id, tipo, dia_semana, hora_desde, hora_hasta, nota) values
    (ana,  null,   'recurrente', 1, '19:00', '22:00', 'PRUEBA nota secreta'),
    (ana,  g_beto, 'recurrente', 2, '19:00', '22:00', 'PRUEBA'),
    (ana,  g_ana,  'recurrente', 3, '19:00', '22:00', 'PRUEBA'),
    (beto, null,   'recurrente', 4, '19:00', '22:00', 'PRUEBA');

  -- Como Beto (solo miembro de "Grupo de Beto"), mirando su grupo.
  perform set_config('request.jwt.claims', json_build_object('sub', beto, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.get_disponibilidad_grupo(g_beto) where jugador_id = ana and grupo_id is null and dia_semana = 1;
  informe := informe || E'\n' || case when n = 1 then 'OK   ' else 'FALLA' end || ' Beto ve el bloqueo general de Ana';
  select count(*) into n from public.get_disponibilidad_grupo(g_beto) where jugador_id = ana and grupo_id = g_beto;
  informe := informe || E'\n' || case when n = 1 then 'OK   ' else 'FALLA' end || ' Beto ve el bloqueo de Ana para su grupo';
  select count(*) into n from public.get_disponibilidad_grupo(g_beto) where grupo_id = g_ana;
  informe := informe || E'\n' || case when n = 0 then 'OK   ' else 'FALLA' end || ' Beto NO ve el bloqueo de Ana para el otro grupo';
  select count(*) into n from public.get_disponibilidad_grupo(g_beto) where jugador_id = beto and dia_semana = 4;
  informe := informe || E'\n' || case when n = 1 then 'OK   ' else 'FALLA' end || ' Beto ve el suyo';
  select count(*) into n from public.get_disponibilidad_grupo(g_ana);
  informe := informe || E'\n' || case when n = 0 then 'OK   ' else 'FALLA' end || ' Beto no ve nada de un grupo del que no es miembro';
  -- La función no tiene columna "nota" entre sus resultados:
  select count(*) into n from pg_proc p, unnest(p.proargnames) a
    where p.proname = 'get_disponibilidad_grupo' and a = 'nota';
  informe := informe || E'\n' || case when n = 0 then 'OK   ' else 'FALLA' end || ' La función no devuelve la nota';

  -- Como Ana, mirando "Fútbol de los jueves".
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated')::text, true);
  select count(*) into n from public.get_disponibilidad_grupo(g_ana) where jugador_id = ana and grupo_id is null;
  informe := informe || E'\n' || case when n = 1 then 'OK   ' else 'FALLA' end || ' Ana ve su bloqueo general en su grupo';
  select count(*) into n from public.get_disponibilidad_grupo(g_ana) where grupo_id = g_beto or jugador_id = beto;
  informe := informe || E'\n' || case when n = 0 then 'OK   ' else 'FALLA' end || ' Ana no ve a Beto ni el bloqueo del otro grupo';

  raise exception E'RESULTADO (se deshace todo, no queda nada guardado):%', informe;
end $$;
