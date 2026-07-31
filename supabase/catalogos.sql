-- AvTech: catálogos configurables.
-- Ejecutar en Supabase > SQL Editor después de architecture_auth.sql.

begin;

create table if not exists public.catalogos (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalogo_valores (
  id uuid primary key default gen_random_uuid(),
  catalogo_id uuid not null references public.catalogos(id) on delete cascade,
  valor text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalogo_id, valor)
);

create index if not exists idx_catalogo_valores_catalogo
  on public.catalogo_valores(catalogo_id, activo, orden);

drop trigger if exists catalogos_updated_at on public.catalogos;
create trigger catalogos_updated_at before update on public.catalogos
for each row execute function public.actualizar_updated_at();

drop trigger if exists catalogo_valores_updated_at on public.catalogo_valores;
create trigger catalogo_valores_updated_at before update on public.catalogo_valores
for each row execute function public.actualizar_updated_at();

insert into public.catalogos (clave, nombre, descripcion)
values
  ('tipos_construccion', 'Tipos de construcción', 'Casa, departamento, edificio y otras clases de construcción.'),
  ('tipos_proyecto', 'Tipos de proyecto', 'Proyecto nuevo, remodelación, ampliación y otros trabajos.'),
  ('conceptos_cobro', 'Conceptos de cobro', 'Servicios que pueden agregarse como conceptos de un proyecto.')
on conflict (clave) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion;

insert into public.catalogo_valores (catalogo_id, valor, orden)
select c.id, seed.valor, seed.orden
from public.catalogos c
cross join (
  values
    ('Casa habitación', 10),
    ('Departamento', 20),
    ('Edificio', 30),
    ('Local comercial', 40),
    ('Oficina', 50),
    ('Remodelación', 60),
    ('Ampliación', 70),
    ('Otro', 80)
) as seed(valor, orden)
where c.clave = 'tipos_construccion'
on conflict (catalogo_id, valor) do nothing;

insert into public.catalogo_valores (catalogo_id, valor, orden)
select c.id, seed.valor, seed.orden
from public.catalogos c
cross join (
  values
    ('Proyecto nuevo', 10),
    ('Remodelación', 20),
    ('Ampliación', 30),
    ('Regularización', 40),
    ('Diseño de interiores', 50),
    ('Levantamiento', 60),
    ('Otro', 70)
) as seed(valor, orden)
where c.clave = 'tipos_proyecto'
on conflict (catalogo_id, valor) do nothing;

insert into public.catalogo_valores (catalogo_id, valor, orden)
select c.id, seed.valor, seed.orden
from public.catalogos c
cross join (
  values
    ('Planos arquitectónicos', 10),
    ('Planos eléctricos', 20),
    ('Planos estructurales', 30),
    ('Planos hidráulicos', 40),
    ('Renders', 50),
    ('Levantamiento', 60),
    ('Diseño de interiores', 70),
    ('Supervisión de obra', 80)
) as seed(valor, orden)
where c.clave = 'conceptos_cobro'
on conflict (catalogo_id, valor) do nothing;

alter table public.catalogos enable row level security;
alter table public.catalogo_valores enable row level security;

grant select, insert, update, delete on public.catalogos to authenticated;
grant select, insert, update, delete on public.catalogo_valores to authenticated;
revoke all on public.catalogos from anon;
revoke all on public.catalogo_valores from anon;

drop policy if exists "Usuarios leen catalogos" on public.catalogos;
drop policy if exists "Admin gestiona catalogos" on public.catalogos;
drop policy if exists "Usuarios leen valores activos" on public.catalogo_valores;
drop policy if exists "Admin gestiona valores" on public.catalogo_valores;

create policy "Usuarios leen catalogos" on public.catalogos
for select to authenticated
using (public.puede_ver_arquitectura());

create policy "Admin gestiona catalogos" on public.catalogos
for all to authenticated
using (public.es_admin())
with check (public.es_admin());

create policy "Usuarios leen valores activos" on public.catalogo_valores
for select to authenticated
using (activo or public.es_admin());

create policy "Admin gestiona valores" on public.catalogo_valores
for all to authenticated
using (public.es_admin())
with check (public.es_admin());

commit;

notify pgrst, 'reload schema';
