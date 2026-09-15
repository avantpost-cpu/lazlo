-- Enregistrement de l'adresse de Cyrille pour le compte et le récapitulatif hebdomadaire
create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text,
  weekly_recap boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.notification_recipients enable row level security;
drop policy if exists "notification_recipients_public_read" on public.notification_recipients;
create policy "notification_recipients_public_read" on public.notification_recipients for select to anon using (true);
drop policy if exists "notification_recipients_public_insert" on public.notification_recipients;
create policy "notification_recipients_public_insert" on public.notification_recipients for insert to anon with check (true);
grant select, insert on public.notification_recipients to anon;

insert into public.notification_recipients (email, display_name, weekly_recap)
values ('illustrations@cyrillesethi.com', 'Cyrille', true)
on conflict (email) do update set display_name = excluded.display_name, weekly_recap = true;
