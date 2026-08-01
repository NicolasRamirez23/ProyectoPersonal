-- AvTech: portal de clientes y asignación de proyectos.
-- Ejecutar una sola vez en Supabase > SQL Editor.

begin;

alter type public.app_role add value if not exists 'cliente';

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
      else 'arquitectura'::public.app_role
    end
  )
  on conflict (id) do update
  set
    nombre = excluded.nombre,
    rol = excluded.rol;
  return new;
end;
$$;

alter table public.proyectos_arquitectonicos
  add column if not exists cliente_usuario_id uuid references auth.users(id) on delete set null;

create index if not exists idx_proyectos_arquitectura_cliente
  on public.proyectos_arquitectonicos(cliente_usuario_id);

drop policy if exists "Arquitectura consulta perfiles cliente" on public.perfiles;
create policy "Arquitectura consulta perfiles cliente" on public.perfiles
for select to authenticated
using (id = auth.uid() or public.puede_ver_arquitectura());

drop policy if exists "Cliente consulta proyectos asignados" on public.proyectos_arquitectonicos;
create policy "Cliente consulta proyectos asignados" on public.proyectos_arquitectonicos
for select to authenticated using (cliente_usuario_id = auth.uid());

drop policy if exists "Cliente consulta conceptos asignados" on public.conceptos_cobro_arquitectonicos;
create policy "Cliente consulta conceptos asignados" on public.conceptos_cobro_arquitectonicos
for select to authenticated using (
  exists (select 1 from public.proyectos_arquitectonicos p
    where p.id = proyecto_id and p.cliente_usuario_id = auth.uid())
);

drop policy if exists "Cliente consulta archivos asignados" on public.archivos_conceptos_arquitectonicos;
create policy "Cliente consulta archivos asignados" on public.archivos_conceptos_arquitectonicos
for select to authenticated using (
  exists (select 1 from public.conceptos_cobro_arquitectonicos c
    join public.proyectos_arquitectonicos p on p.id = c.proyecto_id
    where c.id = concepto_id and p.cliente_usuario_id = auth.uid())
);

drop policy if exists "Cliente consulta pagos asignados" on public.pagos_conceptos_arquitectonicos;
create policy "Cliente consulta pagos asignados" on public.pagos_conceptos_arquitectonicos
for select to authenticated using (
  exists (select 1 from public.conceptos_cobro_arquitectonicos c
    join public.proyectos_arquitectonicos p on p.id = c.proyecto_id
    where c.id = concepto_id and p.cliente_usuario_id = auth.uid())
);

drop policy if exists "Cliente descarga archivos de su proyecto" on storage.objects;
create policy "Cliente descarga archivos de su proyecto" on storage.objects
for select to authenticated using (
  bucket_id = 'arquitectura'
  and exists (
    select 1 from public.proyectos_arquitectonicos p
    where p.id::text = split_part(name, '/', 1)
      and p.cliente_usuario_id = auth.uid()
  )
);

commit;
notify pgrst, 'reload schema';
