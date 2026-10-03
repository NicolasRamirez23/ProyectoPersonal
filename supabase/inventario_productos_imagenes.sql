-- Ejecutar una sola vez en Supabase SQL Editor para habilitar imágenes
-- en instalaciones existentes del inventario de Importaciones Lara.
begin;

alter table public.productos_importaciones_lara
add column if not exists imagen_ruta text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventario-lara', 'inventario-lara', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Encargados leen imagenes inventario Lara" on storage.objects;
drop policy if exists "Encargados suben imagenes inventario Lara" on storage.objects;
drop policy if exists "Encargados actualizan imagenes inventario Lara" on storage.objects;
drop policy if exists "Encargados eliminan imagenes inventario Lara" on storage.objects;

create policy "Encargados leen imagenes inventario Lara"
on storage.objects for select to authenticated
using (
  bucket_id = 'inventario-lara'
  and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin', 'importaciones_lara'))
);

create policy "Encargados suben imagenes inventario Lara"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'inventario-lara'
  and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin', 'importaciones_lara'))
);

create policy "Encargados actualizan imagenes inventario Lara"
on storage.objects for update to authenticated
using (
  bucket_id = 'inventario-lara'
  and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin', 'importaciones_lara'))
)
with check (
  bucket_id = 'inventario-lara'
  and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin', 'importaciones_lara'))
);

create policy "Encargados eliminan imagenes inventario Lara"
on storage.objects for delete to authenticated
using (
  bucket_id = 'inventario-lara'
  and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin', 'importaciones_lara'))
);

commit;
notify pgrst, 'reload schema';
