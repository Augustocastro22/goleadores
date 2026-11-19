-- Métricas de uso (pantalla /metricas, solo para el dueño de la app).
--
-- 1) Qué días entra cada usuario. auth.users.last_sign_in_at no sirve para
--    eso: solo cambia al iniciar sesión, y la sesión dura meses. El proxy
--    (src/lib/supabase/middleware.ts) llama a registrar_visita() como mucho
--    una vez por día y por navegador (lo controla una cookie con la fecha).
-- 2) Cuándo se cargó el resultado de cada partido: hasta ahora solo estaba
--    `jugado` (sí/no), sin fecha.

-- ─────────────────────────────────────────────────────────────────────────
-- Visitas: una fila por usuario por día (hora de Argentina)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.visitas_diarias (
  jugador_id uuid not null references public.profiles (id) on delete cascade,
  dia date not null,
  created_at timestamptz not null default now(),
  primary key (jugador_id, dia)
);

create index if not exists visitas_diarias_dia_idx on public.visitas_diarias (dia);

-- Sin políticas: nadie la lee ni la escribe por la API. Se escribe con
-- registrar_visita() y se lee con la service role desde /metricas.
alter table public.visitas_diarias enable row level security;

create or replace function public.registrar_visita()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visitas_diarias (jugador_id, dia)
  select p.id, (now() at time zone 'America/Argentina/Buenos_Aires')::date
    from public.profiles p
   where p.id = auth.uid() and p.eliminado_en is null
  on conflict (jugador_id, dia) do nothing;
$$;

revoke execute on function public.registrar_visita() from public, anon;
grant execute on function public.registrar_visita() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Fecha en que se cargó el resultado de un partido
-- ─────────────────────────────────────────────────────────────────────────
-- Se completa sola la primera vez que el partido pasa a jugado (desde la
-- app, un desafío o lo que sea). Los partidos ya jugados quedan sin fecha.
alter table public.partidos add column if not exists resultado_cargado_en timestamptz;

create or replace function public.marcar_resultado_cargado()
returns trigger
language plpgsql
as $$
begin
  if new.jugado and new.resultado_cargado_en is null
     and (tg_op = 'INSERT' or not old.jugado) then
    new.resultado_cargado_en := now();
  end if;
  return new;
end;
$$;

drop trigger if exists partidos_resultado_cargado on public.partidos;
create trigger partidos_resultado_cargado
  before insert or update of jugado on public.partidos
  for each row execute function public.marcar_resultado_cargado();

-- ─────────────────────────────────────────────────────────────────────────
-- Para mirar desde el SQL Editor / Table Editor (schema admin)
-- ─────────────────────────────────────────────────────────────────────────
-- Una fila por semana (lunes a domingo, hora de Argentina), las últimas 12.
create or replace view admin.metricas_semanales as
  with semanas as (
    select generate_series(
             date_trunc('week', (now() at time zone 'America/Argentina/Buenos_Aires')::date) - interval '11 weeks',
             date_trunc('week', (now() at time zone 'America/Argentina/Buenos_Aires')::date),
             interval '1 week'
           )::date as desde
  )
  select
    s.desde as semana,
    (select count(*) from public.profiles p
      where (p.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= s.desde
        and (p.created_at at time zone 'America/Argentina/Buenos_Aires')::date < s.desde + 7) as usuarios_nuevos,
    (select count(distinct v.jugador_id) from public.visitas_diarias v
      where v.dia >= s.desde and v.dia < s.desde + 7) as usuarios_activos,
    (select count(*) from public.grupos g
      where (g.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= s.desde
        and (g.created_at at time zone 'America/Argentina/Buenos_Aires')::date < s.desde + 7) as grupos_nuevos,
    (select count(*) from public.partidos pa
      where (pa.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= s.desde
        and (pa.created_at at time zone 'America/Argentina/Buenos_Aires')::date < s.desde + 7) as partidos_creados,
    (select count(*) from public.partidos pa
      where (pa.resultado_cargado_en at time zone 'America/Argentina/Buenos_Aires')::date >= s.desde
        and (pa.resultado_cargado_en at time zone 'America/Argentina/Buenos_Aires')::date < s.desde + 7) as resultados_cargados,
    (select count(*) from public.votos vo
      where (vo.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= s.desde
        and (vo.created_at at time zone 'America/Argentina/Buenos_Aires')::date < s.desde + 7) as votos,
    (select count(*) from public.desafios d
      where (d.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= s.desde
        and (d.created_at at time zone 'America/Argentina/Buenos_Aires')::date < s.desde + 7) as desafios,
    (select count(*) from public.mensajes_contacto m
      where (m.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= s.desde
        and (m.created_at at time zone 'America/Argentina/Buenos_Aires')::date < s.desde + 7) as mensajes_contacto
  from semanas s
  order by s.desde desc;
