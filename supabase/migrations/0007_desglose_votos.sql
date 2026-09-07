-- Devuelve, para un partido y categoría puntuales, a todos los jugadores
-- que recibieron al menos 1 voto (no solo el ganador), con su cantidad
-- exacta de votos. SECURITY DEFINER porque la tabla votos tiene RLS
-- restrictiva (cada uno solo ve los votos que emitió). No filtra por
-- votación cerrada: eso lo decide quien llama (igual que
-- get_ganadores_votacion), para no revelar nada mientras sigue abierta.

create or replace function public.get_desglose_votos(p_partido_id uuid, p_tipo public.voto_tipo)
returns table (
  jugador_id uuid,
  nombre text,
  apellido text,
  apodo text,
  foto_url text,
  votos bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.nombre, p.apellido, p.apodo, p.foto_url, count(*) as votos
  from public.votos v
  join public.profiles p on p.id = v.jugador_votado_id
  where v.partido_id = p_partido_id and v.tipo = p_tipo
  group by p.id
  order by votos desc, p.apellido asc;
$$;

grant execute on function public.get_desglose_votos(uuid, public.voto_tipo) to authenticated;
