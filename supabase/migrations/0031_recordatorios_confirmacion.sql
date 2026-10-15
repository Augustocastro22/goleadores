-- Recordatorio a los convocados que no respondieron si juegan (lo manda el
-- cron diario, ver src/lib/recordatorios.ts): el día anterior y la mañana del
-- partido, pero no a quien lo convocaron hace poco (el aviso de la
-- convocatoria todavía está fresco) ni dos veces seguidas.
--
--   convocado_en  cuándo se lo convocó (o se le volvió a pedir que confirme,
--                 por ejemplo porque cambió la fecha de un desafío).
--   recordado_en  el último recordatorio que se le mandó.

alter table public.partido_jugadores
  add column convocado_en timestamptz not null default now(),
  add column recordado_en timestamptz;

-- Volver a "sin responder" es como una convocatoria nueva: ya le llegó un
-- aviso, no hace falta recordárselo enseguida.
create or replace function public.reiniciar_recordatorio()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.respuesta = 'pendiente' and old.respuesta is distinct from 'pendiente' then
    new.convocado_en := now();
    new.recordado_en := null;
  end if;
  return new;
end;
$$;

create trigger trg_reiniciar_recordatorio
  before update of respuesta on public.partido_jugadores
  for each row execute procedure public.reiniciar_recordatorio();
