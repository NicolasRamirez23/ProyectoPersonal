-- Módulo general de fichas de identificación escolar.
begin;

create table if not exists public.fichas_estudiantes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  escuela text not null,
  grado_grupo text not null,
  foto text not null,
  datos jsonb not null default '{}'::jsonb
);

create index if not exists fichas_estudiantes_nombre_idx
  on public.fichas_estudiantes using gin (to_tsvector('spanish', nombre));

alter table public.fichas_estudiantes enable row level security;

-- RLS decide qué filas puede usar el personal, pero PostgreSQL también requiere
-- privilegios explícitos sobre la tabla para el rol de la sesión.
revoke all on table public.fichas_estudiantes from anon;
grant select, insert, update, delete on table public.fichas_estudiantes to authenticated;

drop policy if exists "Personal gestiona fichas" on public.fichas_estudiantes;
drop policy if exists "Personal consulta fichas" on public.fichas_estudiantes;
drop policy if exists "Administrador consulta fichas" on public.fichas_estudiantes;
drop policy if exists "Personal crea fichas" on public.fichas_estudiantes;
drop policy if exists "Administrador edita fichas" on public.fichas_estudiantes;

create policy "Administrador consulta fichas" on public.fichas_estudiantes
for select to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('admin', 'fichas')))
;

create policy "Personal crea fichas" on public.fichas_estudiantes
for insert to authenticated
with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('admin', 'arquitectura', 'fichas')));

create policy "Administrador edita fichas" on public.fichas_estudiantes
for update to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('admin', 'fichas')))
with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('admin', 'fichas')));

commit;
notify pgrst, 'reload schema';
