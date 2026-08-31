-- Ejecutar después de crear en Authentication > Users la cuenta:
-- fichas@avtech.local
-- Este script crea el rol aislado y asigna exclusivamente el módulo de fichas.

begin;
alter type public.app_role add value if not exists 'fichas';
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
      else 'arquitectura'::public.app_role
    end
  )
  on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;
  return new;
end;
$$;

insert into public.perfiles (id, nombre, rol)
select id, 'ENCARGADO DE FICHAS', 'fichas'::public.app_role
from auth.users
where email = 'fichas@avtech.local'
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;

-- Verificación dura: corrige la cuenta aunque haya sido creada antes de instalar
-- el rol y el trigger anterior la haya clasificado como arquitectura.
update public.perfiles
set nombre = 'ENCARGADO DE FICHAS', rol = 'fichas'::public.app_role
where id in (select id from auth.users where lower(email) = 'fichas@avtech.local');

drop policy if exists "Personal consulta fichas" on public.fichas_estudiantes;
drop policy if exists "Administrador consulta fichas" on public.fichas_estudiantes;
drop policy if exists "Personal crea fichas" on public.fichas_estudiantes;
drop policy if exists "Administrador edita fichas" on public.fichas_estudiantes;
drop policy if exists "Encargados consultan fichas" on public.fichas_estudiantes;
drop policy if exists "Encargados crean fichas" on public.fichas_estudiantes;
drop policy if exists "Encargados editan fichas" on public.fichas_estudiantes;

create policy "Encargados consultan fichas" on public.fichas_estudiantes
for select to authenticated using (
  exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('admin', 'fichas'))
);
create policy "Encargados crean fichas" on public.fichas_estudiantes
for insert to authenticated with check (
  exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('admin', 'fichas'))
);
create policy "Encargados editan fichas" on public.fichas_estudiantes
for update to authenticated using (
  exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('admin', 'fichas'))
) with check (
  exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol in ('admin', 'fichas'))
);

commit;
notify pgrst, 'reload schema';
