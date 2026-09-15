-- Activation de la synchronisation temps réel pour le tableau de bord Lazlo
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.formations;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.checklist_items;
exception when duplicate_object then null;
end $$;
