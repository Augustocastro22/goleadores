-- Permite saber si la votación de un partido está completa (para poder
-- cerrarla) sin exponer votos individuales: la tabla votos tiene RLS que
-- solo deja ver el propio voto, así que se necesita una función
-- SECURITY DEFINER que devuelva solo los conteos agregados.

create or replace function public.get_estado_votacion(p_partido_id uuid)
returns table (
  total_participantes bigint,
  votos_mvp bigint,
  votos_peor bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    (select count(*) from public.partido_jugadores where partido_id = p_partido_id) as total_participantes,
    (select count(*) from public.votos where partido_id = p_partido_id and tipo = 'MVP') as votos_mvp,
    (select count(*) from public.votos where partido_id = p_partido_id and tipo = 'PEOR') as votos_peor;
$$;

grant execute on function public.get_estado_votacion(uuid) to authenticated;
