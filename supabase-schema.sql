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

drop policy if exists "formations_public_read" on public.formations;
create policy "formations_public_read" on public.formations for select to anon using (true);
drop policy if exists "formations_public_insert" on public.formations;
create policy "formations_public_insert" on public.formations for insert to anon with check (true);
drop policy if exists "formations_public_delete" on public.formations;
create policy "formations_public_delete" on public.formations for delete to anon using (true);

drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events for select to anon using (true);
drop policy if exists "events_public_insert" on public.events;
create policy "events_public_insert" on public.events for insert to anon with check (true);
drop policy if exists "events_public_update" on public.events;
create policy "events_public_update" on public.events for update to anon using (true) with check (true);
drop policy if exists "events_public_delete" on public.events;
create policy "events_public_delete" on public.events for delete to anon using (true);

grant usage on schema public to anon;
grant select, insert, delete on public.formations to anon;
grant select, insert, update, delete on public.events to anon;

-- Checklist partagee entre Lazlo et ses parents
create table if not exists public.checklist_items (
  id integer primary key,
  label text not null,
  completed boolean not null default false,
  updated_by text not null default 'Lazlo',
  updated_at timestamptz not null default now()
);

insert into public.checklist_items (id,label)
values
(0,'Compte Cyclades fonctionnel'),(1,'Aménagement / certificat EPS vérifié'),(2,'Aucun devoir non rendu'),(3,'Certification PIX passée'),(4,'Portfolio alimenté'),(5,'Shortlist de formations constituée'),(6,'Mini-stages et JPO repérés'),(7,'Ordinateur vérifié')
on conflict (id) do nothing;

alter table public.checklist_items enable row level security;
drop policy if exists "checklist_public_read" on public.checklist_items;
create policy "checklist_public_read" on public.checklist_items for select to anon using (true);
drop policy if exists "checklist_public_insert" on public.checklist_items;
create policy "checklist_public_insert" on public.checklist_items for insert to anon with check (true);
drop policy if exists "checklist_public_update" on public.checklist_items;
create policy "checklist_public_update" on public.checklist_items for update to anon using (true) with check (true);
grant select, insert, update on public.checklist_items to anon;
do $$ begin
  alter publication supabase_realtime add table public.checklist_items;
exception when duplicate_object then null;
end $$;
