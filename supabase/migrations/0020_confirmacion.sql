-- Confirmación de los convocados. Si el grupo tiene prendida la opción
-- `pedir_confirmacion` (tabla config), cada convocado entra como
-- 'pendiente' y responde si juega o no desde la página del partido. Sin la
-- opción entran como 'juega', que es lo que pasaba hasta ahora (y lo que
-- quedan los convocados existentes).
--
-- Cuando el admin carga los goles por primera vez (guardarGolesPartido),
-- los que no juegan se borran del partido: a partir de ahí partido_jugadores
-- son solo los que jugaron, y las estadísticas y la votación no cambian.
-- Antes de eso el admin tiene que definir qué pasó con los pendientes.

alter table public.partido_jugadores
  add column respuesta text not null default 'juega'
  check (respuesta in ('pendiente', 'juega', 'no_juega'));

-- El convocado responde por sí mismo. La tabla solo la edita el admin (RLS),
-- así que esto va por una función que cambia únicamente la respuesta, de su
-- propia fila, y solo mientras el partido no se jugó. Devuelve false si no
-- está convocado o el partido ya se jugó.
create or replace function public.responder_convocatoria(p_partido_id uuid, p_juega boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partido_jugadores pj
  set respuesta = case when p_juega then 'juega' else 'no_juega' end
  from public.partidos pa
  where pa.id = pj.partido_id
    and pj.partido_id = p_partido_id
    and pj.jugador_id = auth.uid()
    and not pa.jugado;
  return found;
end;
$$;

revoke execute on function public.responder_convocatoria(uuid, boolean) from public, anon;
grant execute on function public.responder_convocatoria(uuid, boolean) to authenticated;
