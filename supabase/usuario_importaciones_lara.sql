-- Ejecutar después de crear la cuenta en Authentication > Users:
-- Email: importaciones_lara@avtech.local
-- Nombre: ENCARGADO DE IMPORTACIONES LARA
-- Este script asigna un rol aislado con acceso exclusivo a Importaciones Lara.

begin;
alter type public.app_role add value if not exists 'importaciones_lara';
commit;

begin;

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
      when new.raw_user_meta_data ->> 'rol' = 'cliente' then 'cliente'::public.app_role
      when new.raw_user_meta_data ->> 'rol' = 'fichas' then 'fichas'::public.app_role
      when new.raw_user_meta_data ->> 'rol' = 'importaciones_lara' then 'importaciones_lara'::public.app_role
      else 'arquitectura'::public.app_role
    end
  )
  on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;
  return new;
end;
$$;

insert into public.perfiles (id, nombre, rol)
select id, 'ENCARGADO DE IMPORTACIONES LARA', 'importaciones_lara'::public.app_role
from auth.users
where lower(email) = 'importaciones_lara@avtech.local'
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;

update public.perfiles
set nombre = 'ENCARGADO DE IMPORTACIONES LARA', rol = 'importaciones_lara'::public.app_role
where id in (
  select id from auth.users where lower(email) = 'importaciones_lara@avtech.local'
);

drop policy if exists "Administrador gestiona recibos Lara" on public.recibos_importaciones_lara;
drop policy if exists "Encargados gestionan recibos Lara" on public.recibos_importaciones_lara;

create policy "Encargados gestionan recibos Lara"
on public.recibos_importaciones_lara
for all to authenticated
using (
  exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol in ('admin', 'importaciones_lara')
  )
)
with check (
  exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol in ('admin', 'importaciones_lara')
  )
);

commit;
notify pgrst, 'reload schema';
