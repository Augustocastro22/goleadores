-- Encuestas: cualquier jugador puede crear una (no solo el admin), con 2+
-- opciones y una fecha de cierre. Cierra antes si vota todo el plantel
-- (mismo criterio que la votación de MVP/Peor). A diferencia de esa
-- votación, acá los resultados se ven en todo momento mientras está
-- abierta (estilo encuesta de Twitter/X) — get_resultados_encuesta expone
-- solo los conteos agregados por opción, nunca quién votó qué.

create table public.encuestas (
  id uuid primary key default gen_random_uuid(),
  pregunta text not null,
  creado_por uuid not null references public.profiles (id) on delete cascade,
  cierra_en timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.encuesta_opciones (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references public.encuestas (id) on delete cascade,
  texto text not null,
  orden smallint not null default 0
);

create table public.encuesta_votos (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references public.encuestas (id) on delete cascade,
  opcion_id uuid not null references public.encuesta_opciones (id) on delete cascade,
  jugador_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (encuesta_id, jugador_id)
);

alter table public.encuestas enable row level security;
alter table public.encuesta_opciones enable row level security;
alter table public.encuesta_votos enable row level security;

-- encuestas: lectura para todos, cualquiera autenticado puede crear la
-- suya; la borra su creador o el admin (moderación).
create policy "encuestas_select_authenticated"
  on public.encuestas for select
  to authenticated
  using (true);

create policy "encuestas_insert_own"
  on public.encuestas for insert
  to authenticated
  with check (creado_por = auth.uid());

create policy "encuestas_delete_creador_o_admin"
  on public.encuestas for delete
  to authenticated
  using (creado_por = auth.uid() or public.is_admin());

-- encuesta_opciones: lectura para todos; solo el creador de la encuesta
-- carga sus opciones (al momento de crearla); se borran junto con la
-- encuesta (necesita policy propia para que la cascada funcione cuando
-- quien borra es un usuario autenticado normal, no la service role).
create policy "encuesta_opciones_select_authenticated"
  on public.encuesta_opciones for select
  to authenticated
  using (true);

create policy "encuesta_opciones_insert_creador"
  on public.encuesta_opciones for insert
  to authenticated
  with check (
    exists (
      select 1 from public.encuestas e
      where e.id = encuesta_opciones.encuesta_id and e.creado_por = auth.uid()
    )
  );

create policy "encuesta_opciones_delete_creador_o_admin"
  on public.encuesta_opciones for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.encuestas e
      where e.id = encuesta_opciones.encuesta_id and e.creado_por = auth.uid()
    )
  );

-- encuesta_votos: RLS restrictiva (cada uno ve y carga solo su propio
-- voto, como en la tabla votos) — los resultados agregados se exponen
-- aparte vía get_resultados_encuesta, sin revelar quién votó qué.
create policy "encuesta_votos_select_own_or_admin"
  on public.encuesta_votos for select
  to authenticated
  using (jugador_id = auth.uid() or public.is_admin());

create policy "encuesta_votos_insert_own"
  on public.encuesta_votos for insert
  to authenticated
  with check (jugador_id = auth.uid());

create policy "encuesta_votos_delete_creador_o_admin"
  on public.encuesta_votos for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.encuestas e
      where e.id = encuesta_votos.encuesta_id and e.creado_por = auth.uid()
    )
  );

create or replace function public.get_resultados_encuesta(p_encuesta_id uuid)
returns table (opcion_id uuid, votos bigint)
language sql
security definer
stable
set search_path = public
as $$
  select eo.id as opcion_id, count(ev.id) as votos
  from public.encuesta_opciones eo
  left join public.encuesta_votos ev on ev.opcion_id = eo.id
  where eo.encuesta_id = p_encuesta_id
  group by eo.id;
$$;

grant execute on function public.get_resultados_encuesta(uuid) to authenticated;
