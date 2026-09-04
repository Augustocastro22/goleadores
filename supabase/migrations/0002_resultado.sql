-- Agrega el resultado del partido: goles del rival, y goles de jugadores
-- externos al grupo ("otros/invitados") que no deben contar en la tabla de
-- goleadores. El marcador de "nuestro equipo" siempre se calcula como
-- suma(goles de partido_jugadores) + goles_otros, así nunca se desincroniza.

alter table public.partidos
  add column goles_rival int not null default 0 check (goles_rival >= 0),
  add column goles_otros int not null default 0 check (goles_otros >= 0);
