-- Permite que un jugador del grupo participe en el equipo 2 (por ejemplo en
-- una pichanga donde el plantel se divide). Sus goles siguen sumando igual
-- en la tabla histórica de goleadores, sin importar de qué lado jugó.

alter table public.partido_jugadores
  add column equipo smallint not null default 1 check (equipo in (1, 2));
