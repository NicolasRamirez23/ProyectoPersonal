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
  ('conceptos_cobro', 'Conceptos de cobro', 'Servicios que pueden agregarse como conceptos de un proyecto.'),
  ('usos_cfdi', 'Usos de CFDI', 'Claves oficiales del catálogo c_UsoCFDI del SAT.'),
  ('regimenes_fiscales', 'Regímenes fiscales', 'Claves oficiales del catálogo c_RegimenFiscal del SAT.')
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
    ('G01 - Adquisición de mercancías', 10),
    ('G02 - Devoluciones, descuentos o bonificaciones', 20),
    ('G03 - Gastos en general', 30),
    ('I01 - Construcciones', 40),
    ('I02 - Mobiliario y equipo de oficina por inversiones', 50),
    ('I03 - Equipo de transporte', 60),
    ('I04 - Equipo de cómputo y accesorios', 70),
    ('I05 - Dados, troqueles, moldes, matrices y herramental', 80),
    ('I06 - Comunicaciones telefónicas', 90),
    ('I07 - Comunicaciones satelitales', 100),
    ('I08 - Otra maquinaria y equipo', 110),
    ('D01 - Honorarios médicos, dentales y gastos hospitalarios', 120),
    ('D02 - Gastos médicos por incapacidad o discapacidad', 130),
    ('D03 - Gastos funerales', 140),
    ('D04 - Donativos', 150),
    ('D05 - Intereses reales efectivamente pagados por créditos hipotecarios', 160),
    ('D06 - Aportaciones voluntarias al SAR', 170),
    ('D07 - Primas por seguros de gastos médicos', 180),
    ('D08 - Gastos de transportación escolar obligatoria', 190),
    ('D09 - Depósitos en cuentas para el ahorro y primas de planes de pensiones', 200),
    ('D10 - Pagos por servicios educativos (colegiaturas)', 210),
    ('S01 - Sin efectos fiscales', 220),
    ('CP01 - Pagos', 230),
    ('CN01 - Nómina', 240)
) as seed(valor, orden)
where c.clave = 'usos_cfdi'
on conflict (catalogo_id, valor) do nothing;

insert into public.catalogo_valores (catalogo_id, valor, orden)
select c.id, seed.valor, seed.orden
from public.catalogos c
cross join (
  values
    ('601 - General de Ley Personas Morales', 10),
    ('603 - Personas Morales con Fines no Lucrativos', 20),
    ('605 - Sueldos y Salarios e Ingresos Asimilados a Salarios', 30),
    ('606 - Arrendamiento', 40),
    ('607 - Régimen de Enajenación o Adquisición de Bienes', 50),
    ('608 - Demás ingresos', 60),
    ('610 - Residentes en el Extranjero sin Establecimiento Permanente en México', 70),
    ('611 - Ingresos por Dividendos (socios y accionistas)', 80),
    ('612 - Personas Físicas con Actividades Empresariales y Profesionales', 90),
    ('614 - Ingresos por intereses', 100),
    ('615 - Régimen de los ingresos por obtención de premios', 110),
    ('616 - Sin obligaciones fiscales', 120),
    ('620 - Sociedades Cooperativas de Producción que optan por diferir sus ingresos', 130),
    ('621 - Incorporación Fiscal', 140),
    ('622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras', 150),
    ('623 - Opcional para Grupos de Sociedades', 160),
    ('624 - Coordinados', 170),
    ('625 - Actividades Empresariales con ingresos a través de Plataformas Tecnológicas', 180),
    ('626 - Régimen Simplificado de Confianza', 190)
) as seed(valor, orden)
where c.clave = 'regimenes_fiscales'
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
drop policy if exists "Roles arquitectura gestionan catalogos" on public.catalogos;
drop policy if exists "Usuarios leen valores activos" on public.catalogo_valores;
drop policy if exists "Admin gestiona valores" on public.catalogo_valores;
drop policy if exists "Roles arquitectura gestionan valores" on public.catalogo_valores;

create policy "Usuarios leen catalogos" on public.catalogos
for select to authenticated
using (public.puede_ver_arquitectura());

create policy "Roles arquitectura gestionan catalogos" on public.catalogos
for all to authenticated
using (public.puede_ver_arquitectura())
with check (public.puede_ver_arquitectura());

create policy "Usuarios leen valores activos" on public.catalogo_valores
for select to authenticated
using (activo or public.es_admin());

create policy "Roles arquitectura gestionan valores" on public.catalogo_valores
for all to authenticated
using (public.puede_ver_arquitectura())
with check (public.puede_ver_arquitectura());

commit;

notify pgrst, 'reload schema';
