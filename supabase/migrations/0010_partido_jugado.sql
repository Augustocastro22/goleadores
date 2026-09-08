-- Ahora los partidos se cargan de antemano (antes de jugarse): mientras no
-- se cargan los goles, un partido es solo un evento (fecha/hora/lugar/rival/
-- convocados), sin resultado ni votación. `jugado` pasa a true la primera
-- vez que el admin guarda los goles (guardarGolesPartido).

alter table public.partidos
  add column jugado boolean not null default false;

-- Los partidos que ya existen son todos anteriores a esta funcionalidad,
-- así que ya se jugaron y tienen resultado y votación cargados.
update public.partidos set jugado = true;
