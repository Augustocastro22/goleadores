-- Ahora los partidos se cargan de antemano (antes de jugarse), así que
-- además de la fecha conviene poder guardar la hora de citación. Opcional:
-- los partidos viejos quedan sin hora.

alter table public.partidos
  add column hora time;
