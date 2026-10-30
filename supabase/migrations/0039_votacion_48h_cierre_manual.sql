-- Votación más larga, con recordatorios y cierre manual del admin:
--
--   1) La votación dura 48 horas desde que se carga el resultado (antes 24).
--      Con 24 h, un partido de noche dejaba muy poco margen para avisar a los
--      que faltan. Las votaciones ya abiertas conservan su límite.
--   2) partidos.votacion_recordatorios: cuántos recordatorios de votación se
--      mandaron (0, 1 o 2). Lo usa el cron para no repetirlos
--      (src/lib/recordatorios-votacion.ts).
--   3) cerrar_votacion(): un admin del grupo puede cerrar la votación a mano
--      pasadas 24 h desde que se cargó el resultado (por ejemplo, si ya sabe
--      que alguien no va a votar). Es el único camino para adelantar el cierre.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Plazo de 48 horas, y solo cerrar_votacion() puede adelantarlo
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.fijar_cierre_votacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not new.jugado then
    new.votacion_cierra_en := null;
  elsif tg_op = 'UPDATE' and old.jugado then
    -- Ya fijado: no se cambia, salvo que cerrar_votacion() lo adelante.
    if current_setting('goleadores.cierre_manual', true) = 'on'
       and old.votacion_cierra_en is not null
       and new.votacion_cierra_en is not null
       and new.votacion_cierra_en < old.votacion_cierra_en then
      null;
    else
      new.votacion_cierra_en := old.votacion_cierra_en;
    end if;
  else
    new.votacion_cierra_en := now() + interval '48 hours';
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Recordatorios ya enviados
-- ─────────────────────────────────────────────────────────────────────────
alter table public.partidos
  add column if not exists votacion_recordatorios smallint not null default 0
  check (votacion_recordatorios between 0 and 2);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Cierre manual de la votación
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.cerrar_votacion(p_partido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo uuid;
  v_cierra timestamptz;
begin
  select grupo_id, votacion_cierra_en into v_grupo, v_cierra
  from public.partidos
  where id = p_partido_id and jugado and con_votacion;

  if not found or v_cierra is null then
    raise exception 'Este partido no tiene una votación para cerrar.';
  end if;
  if not public.es_admin_grupo(v_grupo) then
    raise exception 'Solo un admin del grupo puede cerrar la votación.';
  end if;
  -- Ya cerrada (porque votaron todos o venció): no hay nada que hacer.
  if public.votacion_cerrada(p_partido_id) then
    return;
  end if;
  -- Se puede cerrar a mano 24 horas después de cargado el resultado (el plazo es de 48).
  if now() < v_cierra - interval '24 hours' then
    raise exception 'Todavía no pasaron 24 horas desde que se cargó el resultado.';
  end if;

  perform set_config('goleadores.cierre_manual', 'on', true);
  update public.partidos set votacion_cierra_en = now() where id = p_partido_id;
  perform set_config('goleadores.cierre_manual', 'off', true);
end;
$$;

revoke execute on function public.cerrar_votacion(uuid) from public;
grant execute on function public.cerrar_votacion(uuid) to authenticated;
