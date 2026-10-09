-- Expedientes ISABI y documentos privados. Ejecutar después de procesos_notaria.sql.
begin;

create sequence if not exists public.notaria_isabi_folio_seq;
create table if not exists public.notaria_isabi_expedientes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  folio_interno text not null unique default ('ISABI-' || lpad(nextval('public.notaria_isabi_folio_seq')::text, 6, '0')),
  estatus text not null default 'BORRADOR' check (estatus in ('BORRADOR','LISTO','PRESENTADO')),
  datos jsonb not null default '{}'::jsonb,
  creado_por uuid not null default auth.uid() references auth.users(id)
);

create table if not exists public.notaria_isabi_documentos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expediente_id uuid not null references public.notaria_isabi_expedientes(id) on delete cascade,
  bloque text not null,
  tipo_documento text not null default 'Otro',
  nombre_archivo text not null,
  ruta text not null unique,
  mime_type text not null,
  tamano_bytes bigint not null check (tamano_bytes > 0 and tamano_bytes <= 15728640),
  confianza numeric(5,2) not null default 0 check (confianza between 0 and 100),
  datos_extraidos jsonb not null default '{}'::jsonb,
  advertencias jsonb not null default '[]'::jsonb
);

create index if not exists isabi_expedientes_fecha_idx on public.notaria_isabi_expedientes(created_at desc);
create index if not exists isabi_documentos_expediente_idx on public.notaria_isabi_documentos(expediente_id, created_at);
create or replace function public.actualizar_fecha_isabi()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists actualizar_fecha_isabi on public.notaria_isabi_expedientes;
create trigger actualizar_fecha_isabi before update on public.notaria_isabi_expedientes for each row execute function public.actualizar_fecha_isabi();

alter table public.notaria_isabi_expedientes enable row level security;
alter table public.notaria_isabi_documentos enable row level security;
grant select, insert, update, delete on public.notaria_isabi_expedientes to authenticated;
grant select, insert, update, delete on public.notaria_isabi_documentos to authenticated;
grant usage, select on sequence public.notaria_isabi_folio_seq to authenticated;

drop policy if exists "Notaria gestiona expedientes ISABI" on public.notaria_isabi_expedientes;
create policy "Notaria gestiona expedientes ISABI" on public.notaria_isabi_expedientes for all to authenticated using (public.puede_gestionar_notaria()) with check (public.puede_gestionar_notaria());
drop policy if exists "Notaria gestiona documentos ISABI" on public.notaria_isabi_documentos;
create policy "Notaria gestiona documentos ISABI" on public.notaria_isabi_documentos for all to authenticated using (public.puede_gestionar_notaria()) with check (public.puede_gestionar_notaria());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expedientes-isabi', 'expedientes-isabi', false, 15728640, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Notaria lee documentos ISABI" on storage.objects;
drop policy if exists "Notaria sube documentos ISABI" on storage.objects;
drop policy if exists "Notaria elimina documentos ISABI" on storage.objects;
create policy "Notaria lee documentos ISABI" on storage.objects for select to authenticated using (bucket_id = 'expedientes-isabi' and public.puede_gestionar_notaria());
create policy "Notaria sube documentos ISABI" on storage.objects for insert to authenticated with check (bucket_id = 'expedientes-isabi' and public.puede_gestionar_notaria());
create policy "Notaria elimina documentos ISABI" on storage.objects for delete to authenticated using (bucket_id = 'expedientes-isabi' and public.puede_gestionar_notaria());

commit;
notify pgrst, 'reload schema';
