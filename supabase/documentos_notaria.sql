begin;

create sequence if not exists public.documentos_notaria_folio_seq;

create or replace function public.generar_folio_documento_notaria()
returns text language sql volatile set search_path = public as $$
  select 'NOT-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.documentos_notaria_folio_seq')::text, 6, '0');
$$;

create table if not exists public.documentos_notaria (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  folio text not null unique default public.generar_folio_documento_notaria(),
  tipo_formato text not null,
  nombre_referencia text not null,
  autoridad text not null,
  datos jsonb not null default '{}'::jsonb,
  ruta_docx text,
  ruta_pdf text,
  creado_por uuid not null default auth.uid() references auth.users(id)
);

create index if not exists documentos_notaria_folio_idx on public.documentos_notaria(folio);
create index if not exists documentos_notaria_nombre_idx on public.documentos_notaria(nombre_referencia);
create index if not exists documentos_notaria_tipo_idx on public.documentos_notaria(tipo_formato);
alter table public.documentos_notaria enable row level security;
grant select, insert, update, delete on public.documentos_notaria to authenticated;
grant usage, select on sequence public.documentos_notaria_folio_seq to authenticated;
revoke all on public.documentos_notaria from anon;

drop policy if exists "Administrador gestiona documentos notaria" on public.documentos_notaria;
create policy "Administrador gestiona documentos notaria" on public.documentos_notaria for all to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text = 'admin'))
with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text = 'admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-notaria', 'documentos-notaria', false, 10485760, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Administrador lee documentos notaria" on storage.objects;
drop policy if exists "Administrador sube documentos notaria" on storage.objects;
drop policy if exists "Administrador elimina documentos notaria" on storage.objects;
create policy "Administrador lee documentos notaria" on storage.objects for select to authenticated using (bucket_id = 'documentos-notaria' and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text = 'admin'));
create policy "Administrador sube documentos notaria" on storage.objects for insert to authenticated with check (bucket_id = 'documentos-notaria' and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text = 'admin'));
create policy "Administrador elimina documentos notaria" on storage.objects for delete to authenticated using (bucket_id = 'documentos-notaria' and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text = 'admin'));

commit;
notify pgrst, 'reload schema';
