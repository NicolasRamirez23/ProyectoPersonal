begin;

alter table public.notaria_clientes add column if not exists lugar_nacimiento text not null default '';
alter table public.notaria_clientes add column if not exists fecha_nacimiento date;
alter table public.notaria_clientes add column if not exists nacionalidad text not null default 'MEXICANA';
alter table public.notaria_clientes add column if not exists estado_civil text not null default '';
alter table public.notaria_clientes add column if not exists ocupacion text not null default '';

create table if not exists public.notaria_sucesiones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expediente_id uuid not null unique references public.notaria_expedientes(id) on delete cascade,
  via text not null check (via in ('testamentaria','intestamentaria')),
  autor_nombre text not null,
  autor_genero text not null default 'M' check (autor_genero in ('M','F')),
  autor_fecha_nacimiento date,
  autor_lugar_nacimiento text not null default '',
  autor_nacionalidad text not null default 'MEXICANA',
  autor_estado_civil text not null default '',
  autor_ocupacion text not null default '',
  autor_curp text not null default '',
  autor_rfc text not null default '',
  autor_domicilio text not null default '',
  fecha_defuncion date not null,
  lugar_defuncion text not null,
  acta_defuncion text not null default '',
  testamento_instrumento text not null default '',
  testamento_volumen text not null default '',
  testamento_fecha date,
  testamento_notario text not null default '',
  testamento_notaria text not null default '',
  testamento_lugar text not null default '',
  disposicion_principal text not null default '',
  estatus text not null default 'integracion' check (estatus in ('integracion','busquedas','radicacion','publicaciones','adjudicacion','concluida'))
);

create table if not exists public.notaria_sucesion_comparecientes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sucesion_id uuid not null references public.notaria_sucesiones(id) on delete cascade,
  cliente_id uuid not null references public.notaria_clientes(id),
  rol text not null check (rol in ('solicitante','heredero','albacea','testigo','otro')),
  parentesco text not null default '',
  es_principal boolean not null default false,
  unique(sucesion_id, cliente_id, rol)
);

create table if not exists public.notaria_sucesion_requisitos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sucesion_id uuid not null references public.notaria_sucesiones(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  obligatorio boolean not null default true,
  estatus text not null default 'pendiente' check (estatus in ('pendiente','recibido','validado','rechazado','no_aplica')),
  nombre_archivo text,
  ruta text,
  vence_el date,
  notas text not null default '',
  unique(sucesion_id, codigo)
);

create table if not exists public.notaria_sucesion_busquedas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sucesion_id uuid not null references public.notaria_sucesiones(id) on delete cascade,
  autoridad text not null check (autoridad in ('registro_publico','archivo_notarias')),
  estatus text not null default 'pendiente' check (estatus in ('pendiente','enviada','respondida')),
  fecha_solicitud date,
  folio_solicitud text not null default '',
  fecha_respuesta date,
  folio_respuesta text not null default '',
  resultado text not null default '',
  notas text not null default '',
  unique(sucesion_id, autoridad)
);

alter table public.notaria_sucesiones enable row level security;
alter table public.notaria_sucesion_comparecientes enable row level security;
alter table public.notaria_sucesion_requisitos enable row level security;
alter table public.notaria_sucesion_busquedas enable row level security;

grant select, insert, update, delete on public.notaria_sucesiones, public.notaria_sucesion_comparecientes, public.notaria_sucesion_requisitos, public.notaria_sucesion_busquedas to authenticated;

do $$ declare item text; begin
  foreach item in array array['notaria_sucesiones','notaria_sucesion_comparecientes','notaria_sucesion_requisitos','notaria_sucesion_busquedas'] loop
    execute format('drop policy if exists "Notaria gestiona %s" on public.%I', item, item);
    execute format('create policy "Notaria gestiona %s" on public.%I for all to authenticated using (public.puede_gestionar_notaria()) with check (public.puede_gestionar_notaria())', item, item);
  end loop;
end $$;

commit;
notify pgrst, 'reload schema';
