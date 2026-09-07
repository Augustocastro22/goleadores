-- Notificaciones push: suscripciones por usuario y flags para no duplicar
-- avisos de apertura/cierre de votación.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Cada usuario gestiona sus propias suscripciones (una por navegador/dispositivo).
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

-- El envío real corre server-side con la service role key (bypassea RLS
-- para poder leer las suscripciones de todos los convocados a un partido).

alter table public.partidos
  add column votacion_abierta_notificada boolean not null default false,
  add column votacion_cerrada_notificada boolean not null default false;
