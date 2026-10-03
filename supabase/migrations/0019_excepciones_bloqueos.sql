-- Fechas puntuales en las que un bloqueo no aplica, para poder liberar un
-- solo día de un "todos los domingos" sin borrar el resto (ver liberarDia en
-- src/lib/disponibilidad.ts). Los bloqueos existentes quedan sin excepciones.
alter table public.bloqueos_disponibilidad
  add column excepciones date[] not null default '{}';
