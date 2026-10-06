begin;

create table if not exists public.notaria_documentos_expediente (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expediente_id uuid not null references public.notaria_expedientes(id) on delete cascade,
  cliente_id uuid references public.notaria_clientes(id) on delete set null,
  documento_anterior_id uuid references public.notaria_documentos_expediente(id) on delete set null,
  nombre_archivo text not null,
  ruta text not null unique,
  mime_type text not null,
  tamano_bytes bigint not null check (tamano_bytes > 0 and tamano_bytes <= 15728640),
  hash_sha256 text not null,
  tipo_indicado text not null default '',
  tipo_detectado text not null default 'Otro',
  tipo_confirmado text not null default '',
  rol_detectado text not null default '',
  rol_confirmado text not null default '',
  estado text not null default 'pendiente' check (estado in ('pendiente','procesando','por_revisar','confirmado','rechazado','error')),
  confianza numeric(5,2) not null default 0 check (confianza between 0 and 100),
  datos_extraidos jsonb not null default '{}'::jsonb,
  texto_extraido text not null default '',
  notas text not null default '',
  cargado_por uuid not null default auth.uid() references auth.users(id),
  revisado_por uuid references auth.users(id),
  revisado_el timestamptz
);

create index if not exists notaria_docs_expediente_idx on public.notaria_documentos_expediente(expediente_id, created_at desc);
create index if not exists notaria_docs_cliente_idx on public.notaria_documentos_expediente(cliente_id);
create index if not exists notaria_docs_estado_idx on public.notaria_documentos_expediente(estado);
create index if not exists notaria_docs_hash_idx on public.notaria_documentos_expediente(hash_sha256);

create table if not exists public.notaria_documentos_bitacora (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  documento_id uuid not null references public.notaria_documentos_expediente(id) on delete cascade,
  accion text not null check (accion in ('carga','lectura_local','analisis_ia','revision','confirmacion','rechazo','descarga','sustitucion')),
  detalle jsonb not null default '{}'::jsonb,
  usuario_id uuid not null default auth.uid() references auth.users(id)
);
alter table public.notaria_documentos_bitacora drop constraint if exists notaria_documentos_bitacora_accion_check;
alter table public.notaria_documentos_bitacora add constraint notaria_documentos_bitacora_accion_check
  check (accion in ('carga','lectura_local','analisis_ia','revision','confirmacion','rechazo','descarga','sustitucion'));
create index if not exists notaria_docs_bitacora_documento_idx on public.notaria_documentos_bitacora(documento_id, created_at desc);

alter table public.notaria_documentos_expediente add column if not exists analizado_con_ia boolean not null default false;
alter table public.notaria_documentos_expediente add column if not exists proveedor_ia text not null default '';
alter table public.notaria_documentos_expediente add column if not exists modelo_ia text not null default '';
alter table public.notaria_documentos_expediente add column if not exists analizado_ia_el timestamptz;
alter table public.notaria_documentos_expediente add column if not exists tipo_indicado text not null default '';

alter table public.notaria_documentos_expediente enable row level security;
alter table public.notaria_documentos_bitacora enable row level security;
grant select, insert, update, delete on public.notaria_documentos_expediente to authenticated;
grant select, insert on public.notaria_documentos_bitacora to authenticated;
grant usage, select on sequence public.notaria_documentos_bitacora_id_seq to authenticated;

drop policy if exists "Notaria gestiona documentos expediente" on public.notaria_documentos_expediente;
create policy "Notaria gestiona documentos expediente" on public.notaria_documentos_expediente
for all to authenticated using (public.puede_gestionar_notaria()) with check (public.puede_gestionar_notaria());
drop policy if exists "Notaria consulta bitacora documental" on public.notaria_documentos_bitacora;
drop policy if exists "Notaria registra bitacora documental" on public.notaria_documentos_bitacora;
create policy "Notaria consulta bitacora documental" on public.notaria_documentos_bitacora
for select to authenticated using (public.puede_gestionar_notaria());
create policy "Notaria registra bitacora documental" on public.notaria_documentos_bitacora
for insert to authenticated with check (public.puede_gestionar_notaria());

commit;
notify pgrst, 'reload schema';
