-- AvTech: autenticación, roles, proyectos arquitectónicos y archivos privados.
-- Ejecutar completo en Supabase > SQL Editor.

begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin', 'arquitectura');
exception
  when duplicate_object then null;
end $$;

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  rol public.app_role not null default 'arquitectura',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data ->> 'rol' = 'admin' then 'admin'::public.app_role
      else 'arquitectura'::public.app_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
after insert on auth.users
for each row execute function public.crear_perfil_usuario();

-- Crea perfiles para usuarios que ya existían antes de ejecutar esta migración.
insert into public.perfiles (id, nombre, rol)
select id, coalesce(raw_user_meta_data ->> 'nombre', split_part(email, '@', 1)), 'arquitectura'
from auth.users
on conflict (id) do nothing;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

create or replace function public.puede_ver_arquitectura()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol in ('admin', 'arquitectura')
  );
$$;

create table if not exists public.proyectos_arquitectonicos (
  id uuid primary key default gen_random_uuid(),
  cliente_nombre text not null,
  cliente_telefono text,
  nombre_obra text not null,
  tipo_construccion text not null,
  tipo_proyecto text not null,
  ubicacion text,
  notas text,
  estatus text not null default 'cotizacion'
    check (estatus in ('cotizacion', 'activo', 'pausado', 'terminado')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proyectos_arquitectonicos
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

create table if not exists public.conceptos_cobro_arquitectonicos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos_arquitectonicos(id) on delete cascade,
  concepto text not null,
  descripcion text,
  importe numeric(12,2) not null default 0 check (importe >= 0),
  estatus text not null default 'pendiente' check (estatus in ('pendiente', 'pagado')),
  fecha_pago date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.archivos_conceptos_arquitectonicos (
  id uuid primary key default gen_random_uuid(),
  concepto_id uuid not null references public.conceptos_cobro_arquitectonicos(id) on delete cascade,
  nombre_archivo text not null,
  ruta_storage text not null unique,
  tipo_mime text not null default 'application/octet-stream',
  tamano bigint not null default 0 check (tamano >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_conceptos_arquitectura_proyecto
  on public.conceptos_cobro_arquitectonicos(proyecto_id);
create index if not exists idx_archivos_arquitectura_concepto
  on public.archivos_conceptos_arquitectonicos(concepto_id);

create or replace function public.actualizar_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists proyectos_arquitectura_updated_at on public.proyectos_arquitectonicos;
create trigger proyectos_arquitectura_updated_at before update on public.proyectos_arquitectonicos
for each row execute function public.actualizar_updated_at();

drop trigger if exists conceptos_arquitectura_updated_at on public.conceptos_cobro_arquitectonicos;
create trigger conceptos_arquitectura_updated_at before update on public.conceptos_cobro_arquitectonicos
for each row execute function public.actualizar_updated_at();

alter table public.perfiles enable row level security;
alter table public.proyectos_arquitectonicos enable row level security;
alter table public.conceptos_cobro_arquitectonicos enable row level security;
alter table public.archivos_conceptos_arquitectonicos enable row level security;

-- PostgREST necesita privilegios SQL además de las políticas RLS.
grant usage on schema public to authenticated;
grant usage on type public.app_role to authenticated;
grant select, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.proyectos_arquitectonicos to authenticated;
grant select, insert, update, delete on public.conceptos_cobro_arquitectonicos to authenticated;
grant select, insert, update, delete on public.archivos_conceptos_arquitectonicos to authenticated;
grant select, insert, update, delete on public.padron to authenticated;
grant select, insert, update, delete on public.proyectos to authenticated;
grant select, insert, update, delete on public.pagos to authenticated;
grant select, insert, update, delete on public.recibos_abonos to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.puede_ver_arquitectura() to authenticated;

-- El usuario anónimo no debe consultar información administrativa.
revoke all on public.perfiles from anon;
revoke all on public.proyectos_arquitectonicos from anon;
revoke all on public.conceptos_cobro_arquitectonicos from anon;
revoke all on public.archivos_conceptos_arquitectonicos from anon;
revoke all on public.padron from anon;
revoke all on public.proyectos from anon;
revoke all on public.pagos from anon;
revoke all on public.recibos_abonos from anon;

do $$
declare policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'perfiles',
        'proyectos_arquitectonicos',
        'conceptos_cobro_arquitectonicos',
        'archivos_conceptos_arquitectonicos',
        'padron',
        'proyectos',
        'pagos',
        'recibos_abonos'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
      policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end $$;

create policy "Leer perfil propio" on public.perfiles
for select to authenticated using (id = auth.uid() or public.es_admin());
create policy "Admin actualiza perfiles" on public.perfiles
for update to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "Roles arquitectura gestionan proyectos" on public.proyectos_arquitectonicos
for all to authenticated using (public.puede_ver_arquitectura()) with check (public.puede_ver_arquitectura());
create policy "Roles arquitectura gestionan conceptos" on public.conceptos_cobro_arquitectonicos
for all to authenticated using (public.puede_ver_arquitectura()) with check (public.puede_ver_arquitectura());
create policy "Roles arquitectura gestionan archivos" on public.archivos_conceptos_arquitectonicos
for all to authenticated using (public.puede_ver_arquitectura()) with check (public.puede_ver_arquitectura());

-- El módulo de programación es exclusivo del administrador.
alter table public.padron enable row level security;
alter table public.proyectos enable row level security;
alter table public.pagos enable row level security;
alter table public.recibos_abonos enable row level security;

create policy "Solo admin padron" on public.padron
for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "Solo admin proyectos programacion" on public.proyectos
for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "Solo admin pagos programacion" on public.pagos
for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "Solo admin recibos programacion" on public.recibos_abonos
for all to authenticated using (public.es_admin()) with check (public.es_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arquitectura',
  'arquitectura',
  false,
  20971520,
  null
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Roles arquitectura leen archivos storage" on storage.objects;
drop policy if exists "Roles arquitectura suben archivos storage" on storage.objects;
drop policy if exists "Roles arquitectura actualizan archivos storage" on storage.objects;
drop policy if exists "Roles arquitectura eliminan archivos storage" on storage.objects;

create policy "Roles arquitectura leen archivos storage" on storage.objects
for select to authenticated
using (bucket_id = 'arquitectura' and public.puede_ver_arquitectura());
create policy "Roles arquitectura suben archivos storage" on storage.objects
for insert to authenticated
with check (bucket_id = 'arquitectura' and public.puede_ver_arquitectura());
create policy "Roles arquitectura actualizan archivos storage" on storage.objects
for update to authenticated
using (bucket_id = 'arquitectura' and public.puede_ver_arquitectura())
with check (bucket_id = 'arquitectura' and public.puede_ver_arquitectura());
create policy "Roles arquitectura eliminan archivos storage" on storage.objects
for delete to authenticated
using (bucket_id = 'arquitectura' and public.puede_ver_arquitectura());

commit;

-- DESPUÉS DE CREAR LOS DOS USUARIOS EN:
-- Supabase > Authentication > Users > Add user
-- ejecuta estas líneas sustituyendo los correos:
--
-- update public.perfiles set rol = 'admin', nombre = 'Administrador'
-- where id = (select id from auth.users where email = 'admin@avtech.local');
--
-- update public.perfiles set rol = 'arquitectura', nombre = 'Arquitectura'
-- where id = (select id from auth.users where email = 'arquitectura@avtech.local');
