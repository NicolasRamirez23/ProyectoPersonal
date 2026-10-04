begin;

create sequence if not exists public.notaria_expediente_folio_seq;
create sequence if not exists public.notaria_orden_pago_folio_seq;

create or replace function public.generar_folio_expediente_notaria()
returns text language sql volatile set search_path = public as $$
  select 'EXP-N2-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.notaria_expediente_folio_seq')::text, 5, '0');
$$;

create or replace function public.generar_folio_orden_notaria()
returns text language sql volatile set search_path = public as $$
  select 'OP-N2-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.notaria_orden_pago_folio_seq')::text, 5, '0');
$$;

create table if not exists public.notaria_clientes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  curp text not null,
  nombres text not null,
  apellido_paterno text not null default '',
  apellido_materno text not null default '',
  rfc text not null default '',
  email text not null default '',
  telefono text not null default '',
  domicilio text not null default '',
  notas text not null default '',
  creado_por uuid not null default auth.uid() references auth.users(id)
);
create unique index if not exists notaria_clientes_curp_unique on public.notaria_clientes (upper(curp));

create table if not exists public.notaria_expedientes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  folio text not null unique default public.generar_folio_expediente_notaria(),
  cliente_id uuid not null references public.notaria_clientes(id),
  titulo text not null,
  tipo_operacion text not null,
  descripcion text not null default '',
  estatus text not null default 'activo' check (estatus in ('borrador','activo','pausado','concluido','cancelado')),
  fecha_inicio date not null default current_date,
  fecha_objetivo date,
  costo_general numeric(12,2) not null default 0 check (costo_general >= 0),
  descuento numeric(12,2) not null default 0 check (descuento >= 0),
  notas text not null default '',
  creado_por uuid not null default auth.uid() references auth.users(id)
);
create index if not exists notaria_expedientes_cliente_idx on public.notaria_expedientes(cliente_id);
create index if not exists notaria_expedientes_estatus_idx on public.notaria_expedientes(estatus);

create table if not exists public.notaria_etapas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expediente_id uuid not null references public.notaria_expedientes(id) on delete cascade,
  orden integer not null check (orden > 0),
  concepto text not null,
  descripcion text not null default '',
  estatus text not null default 'pendiente' check (estatus in ('pendiente','en_proceso','completado','detenido','cancelado')),
  fecha_limite date,
  fecha_completado date,
  costo numeric(12,2) not null default 0 check (costo >= 0),
  responsable text not null default '',
  unique(expediente_id, orden)
);
create index if not exists notaria_etapas_fecha_idx on public.notaria_etapas(fecha_limite);

create table if not exists public.notaria_cliente_documentos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cliente_id uuid not null references public.notaria_clientes(id) on delete cascade,
  tipo text not null,
  nombre_archivo text not null,
  ruta text not null,
  vence_el date,
  notas text not null default ''
);

create table if not exists public.notaria_pagos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expediente_id uuid not null references public.notaria_expedientes(id) on delete cascade,
  fecha_pago date not null default current_date,
  monto numeric(12,2) not null check (monto > 0),
  metodo text not null,
  referencia text not null default '',
  notas text not null default '',
  registrado_por uuid not null default auth.uid() references auth.users(id)
);

create table if not exists public.notaria_ordenes_pago (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  folio text not null unique default public.generar_folio_orden_notaria(),
  expediente_id uuid not null references public.notaria_expedientes(id) on delete cascade,
  concepto text not null,
  monto numeric(12,2) not null check (monto > 0),
  fecha_limite date,
  estatus text not null default 'pendiente' check (estatus in ('pendiente','pagada','cancelada')),
  creado_por uuid not null default auth.uid() references auth.users(id)
);

create or replace function public.puede_gestionar_notaria()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.perfiles where id = auth.uid() and rol::text in ('admin','notaria'));
$$;

alter table public.notaria_clientes enable row level security;
alter table public.notaria_expedientes enable row level security;
alter table public.notaria_etapas enable row level security;
alter table public.notaria_cliente_documentos enable row level security;
alter table public.notaria_pagos enable row level security;
alter table public.notaria_ordenes_pago enable row level security;

grant usage on schema public to authenticated;
grant usage, select on sequence public.notaria_expediente_folio_seq, public.notaria_orden_pago_folio_seq to authenticated;
grant execute on function public.puede_gestionar_notaria() to authenticated;
grant select, insert, update, delete on public.notaria_clientes, public.notaria_expedientes, public.notaria_etapas, public.notaria_cliente_documentos, public.notaria_pagos, public.notaria_ordenes_pago to authenticated;

do $$ declare item text; begin
  foreach item in array array['notaria_clientes','notaria_expedientes','notaria_etapas','notaria_cliente_documentos','notaria_pagos','notaria_ordenes_pago'] loop
    execute format('drop policy if exists "Notaria gestiona %s" on public.%I', item, item);
    execute format('create policy "Notaria gestiona %s" on public.%I for all to authenticated using (public.puede_gestionar_notaria()) with check (public.puede_gestionar_notaria())', item, item);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expedientes-notaria', 'expedientes-notaria', false, 15728640,
  array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Notaria lee expedientes" on storage.objects;
drop policy if exists "Notaria sube expedientes" on storage.objects;
drop policy if exists "Notaria elimina expedientes" on storage.objects;
create policy "Notaria lee expedientes" on storage.objects for select to authenticated using (bucket_id = 'expedientes-notaria' and public.puede_gestionar_notaria());
create policy "Notaria sube expedientes" on storage.objects for insert to authenticated with check (bucket_id = 'expedientes-notaria' and public.puede_gestionar_notaria());
create policy "Notaria elimina expedientes" on storage.objects for delete to authenticated using (bucket_id = 'expedientes-notaria' and public.puede_gestionar_notaria());

commit;
notify pgrst, 'reload schema';
