-- Base du tableau de bord Lazlo
create table if not exists public.formations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school text,
  city text,
  type text,
  jpo date,
  immersion date,
  portfolio text,
  admission text,
  expectations text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  event_date date not null,
  kind text not null check (kind in ('EPS','PIX','JPO / immersion')),
  created_at timestamptz not null default now()
);

alter table public.formations enable row level security;
alter table public.events enable row level security;

create policy "formations_public_read" on public.formations for select to anon using (true);
create policy "formations_public_insert" on public.formations for insert to anon with check (true);
create policy "formations_public_delete" on public.formations for delete to anon using (true);

create policy "events_public_read" on public.events for select to anon using (true);
create policy "events_public_insert" on public.events for insert to anon with check (true);
create policy "events_public_update" on public.events for update to anon using (true) with check (true);
create policy "events_public_delete" on public.events for delete to anon using (true);

grant usage on schema public to anon;
grant select, insert, delete on public.formations to anon;
grant select, insert, update, delete on public.events to anon;