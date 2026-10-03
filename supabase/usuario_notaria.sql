begin;
alter type public.app_role add value if not exists 'notaria';
commit;

begin;
-- La Edge Function usa service_role para crear o actualizar el perfil
-- del usuario exclusivo de Notaría. Este rol continúa protegido y omite RLS.
grant usage on schema public to service_role;
grant usage on type public.app_role to service_role;
grant select, insert, update on public.perfiles to service_role;

create or replace function public.crear_perfil_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, rol)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data ->> 'rol' = 'admin' then 'admin'::public.app_role
      when new.raw_user_meta_data ->> 'rol' = 'cliente' then 'cliente'::public.app_role
      when new.raw_user_meta_data ->> 'rol' = 'fichas' then 'fichas'::public.app_role
      when new.raw_user_meta_data ->> 'rol' = 'importaciones_lara' then 'importaciones_lara'::public.app_role
      when new.raw_user_meta_data ->> 'rol' = 'notaria' then 'notaria'::public.app_role
      else 'arquitectura'::public.app_role
    end)
  on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;
  return new;
end;
$$;

drop policy if exists "Administrador gestiona documentos notaria" on public.documentos_notaria;
drop policy if exists "Roles Notaria gestionan documentos" on public.documentos_notaria;
create policy "Roles Notaria gestionan documentos" on public.documentos_notaria for all to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin','notaria')))
with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin','notaria')));

drop policy if exists "Administrador lee documentos notaria" on storage.objects;
drop policy if exists "Administrador sube documentos notaria" on storage.objects;
drop policy if exists "Administrador elimina documentos notaria" on storage.objects;
drop policy if exists "Roles Notaria leen documentos" on storage.objects;
drop policy if exists "Roles Notaria suben documentos" on storage.objects;
drop policy if exists "Roles Notaria eliminan documentos" on storage.objects;
create policy "Roles Notaria leen documentos" on storage.objects for select to authenticated using (bucket_id = 'documentos-notaria' and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin','notaria')));
create policy "Roles Notaria suben documentos" on storage.objects for insert to authenticated with check (bucket_id = 'documentos-notaria' and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin','notaria')));
create policy "Roles Notaria eliminan documentos" on storage.objects for delete to authenticated using (bucket_id = 'documentos-notaria' and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin','notaria')));
commit;
notify pgrst, 'reload schema';
