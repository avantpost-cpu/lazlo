insert into storage.buckets (id,name,public) values ('croquis','croquis',true) on conflict (id) do update set public=true;
drop policy if exists "croquis_public_read" on storage.objects;
create policy "croquis_public_read" on storage.objects for select to anon using (bucket_id='croquis');
drop policy if exists "croquis_public_insert" on storage.objects;
create policy "croquis_public_insert" on storage.objects for insert to anon with check (bucket_id='croquis');
drop policy if exists "croquis_public_delete" on storage.objects;
create policy "croquis_public_delete" on storage.objects for delete to anon using (bucket_id='croquis');