create table if not exists public.overview_reception_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.overview_reception_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.overview_reception_state enable row level security;

drop policy if exists "overview_reception_state_read" on public.overview_reception_state;
drop policy if exists "overview_reception_state_insert" on public.overview_reception_state;
drop policy if exists "overview_reception_state_update" on public.overview_reception_state;

create policy "overview_reception_state_read"
on public.overview_reception_state
for select
to anon
using (true);

create policy "overview_reception_state_insert"
on public.overview_reception_state
for insert
to anon
with check (true);

create policy "overview_reception_state_update"
on public.overview_reception_state
for update
to anon
using (true)
with check (true);
