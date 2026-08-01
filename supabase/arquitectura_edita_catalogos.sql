-- AvTech: permite a los perfiles admin y arquitectura administrar
-- los catálogos utilizados por el módulo arquitectónico.
-- Ejecutar una sola vez en Supabase > SQL Editor.

begin;

drop policy if exists "Admin gestiona catalogos" on public.catalogos;
drop policy if exists "Admin gestiona valores" on public.catalogo_valores;
drop policy if exists "Roles arquitectura gestionan catalogos" on public.catalogos;
drop policy if exists "Roles arquitectura gestionan valores" on public.catalogo_valores;

create policy "Roles arquitectura gestionan catalogos"
on public.catalogos
for all to authenticated
using (public.puede_ver_arquitectura())
with check (public.puede_ver_arquitectura());

create policy "Roles arquitectura gestionan valores"
on public.catalogo_valores
for all to authenticated
using (public.puede_ver_arquitectura())
with check (public.puede_ver_arquitectura());

commit;

notify pgrst, 'reload schema';
