-- Configuración editable por el admin desde /admin, como pares clave → valor
-- (jsonb) para poder sumar ajustes nuevos sin crear tablas. Todos pueden
-- leerla (las reglas aplican a todos), solo el admin la modifica.

create table public.config (
  clave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.config enable row level security;

create policy "config_select_authenticated"
  on public.config for select
  to authenticated
  using (true);

create policy "config_insert_admin"
  on public.config for insert
  to authenticated
  with check (public.is_admin());

create policy "config_update_admin"
  on public.config for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Mínimo de jugadores en un partido para que haya votación de Mejor/Peor
-- Jugador. 0 = sin mínimo (el comportamiento que había hasta ahora).
insert into public.config (clave, valor) values ('min_jugadores_votacion', '0');

-- Si el partido tuvo votación de Mejor/Peor. Se decide una sola vez, cuando
-- el admin carga los goles por primera vez (a partir de ahí la convocatoria
-- ya no cambia), comparando la cantidad de jugadores con el mínimo vigente
-- en ese momento. Así, cambiar el mínimo después no borra MVPs de partidos
-- viejos. Los partidos existentes quedan con votación, como hasta ahora.
alter table public.partidos
  add column con_votacion boolean not null default true;
