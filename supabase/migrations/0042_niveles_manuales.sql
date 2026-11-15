-- ─────────────────────────────────────────────────────────────────────────
-- El nivel que el admin le pone a mano a un jugador para "Equipos parejos"
-- (ver src/lib/nivel.ts): se usa mientras el jugador tiene menos partidos
-- que los que hacen falta para medirlo con su historial. Del 1 al 10.
--
-- Tabla aparte (y no una columna en grupo_miembros) para que solo la vean
-- los admins: los miembros se ven entre sí y no tienen por qué ver el nivel
-- que les puso el admin.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.niveles_manuales (
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  jugador_id uuid not null references public.profiles (id) on delete cascade,
  nivel smallint not null check (nivel between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (grupo_id, jugador_id)
);

alter table public.niveles_manuales enable row level security;

drop policy if exists "niveles_manuales_admin" on public.niveles_manuales;
create policy "niveles_manuales_admin"
  on public.niveles_manuales for all
  to authenticated
  using (public.es_admin_grupo(grupo_id))
  with check (public.es_admin_grupo(grupo_id));
