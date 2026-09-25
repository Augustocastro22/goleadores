-- Disponibilidad: cada jugador marca en su perfil los días que no puede
-- jugar (puntual, un rango de fechas, o recurrente por día de semana),
-- opcionalmente acotado a un horario. Se usa solo como aviso al armar la
-- convocatoria de un partido — el admin decide igual, no excluye solo a
-- nadie (ver src/lib/disponibilidad.ts para el cálculo de si un bloqueo
-- choca con la fecha/hora de un partido puntual).

create type public.disponibilidad_tipo as enum ('puntual', 'rango', 'recurrente');

create table public.bloqueos_disponibilidad (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references public.profiles (id) on delete cascade,
  tipo public.disponibilidad_tipo not null,
  fecha_desde date,
  fecha_hasta date,
  dia_semana smallint check (dia_semana between 0 and 6),
  hora_desde time,
  hora_hasta time,
  nota text,
  created_at timestamptz not null default now(),
  check (
    (tipo = 'puntual' and fecha_desde is not null and fecha_hasta is null and dia_semana is null)
    or (tipo = 'rango' and fecha_desde is not null and fecha_hasta is not null and fecha_hasta >= fecha_desde and dia_semana is null)
    or (tipo = 'recurrente' and dia_semana is not null and fecha_desde is null and fecha_hasta is null)
  ),
  check (hora_desde is null or hora_hasta is null or hora_hasta > hora_desde)
);

alter table public.bloqueos_disponibilidad enable row level security;

-- Cada uno ve y administra los suyos; el admin además puede ver todos
-- (para el aviso al armar la convocatoria), pero no edita los de otros.
create policy "bloqueos_select_own_or_admin"
  on public.bloqueos_disponibilidad for select
  to authenticated
  using (jugador_id = auth.uid() or public.is_admin());

create policy "bloqueos_insert_own"
  on public.bloqueos_disponibilidad for insert
  to authenticated
  with check (jugador_id = auth.uid());

create policy "bloqueos_delete_own"
  on public.bloqueos_disponibilidad for delete
  to authenticated
  using (jugador_id = auth.uid());
