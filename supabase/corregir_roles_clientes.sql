-- AvTech: habilita el rol cliente y corrige cuentas creadas como arquitectura.
-- Ejecutar en Supabase > SQL Editor.

begin;

alter type public.app_role add value if not exists 'cliente';

commit;
begin;

-- Sincroniza únicamente las cuentas que fueron creadas explícitamente como clientes.
update public.perfiles as perfil
set
  rol = 'cliente'::public.app_role,
  nombre = coalesce(nullif(usuario.raw_user_meta_data ->> 'nombre', ''), perfil.nombre)
from auth.users as usuario
where perfil.id = usuario.id
  and usuario.raw_user_meta_data ->> 'rol' = 'cliente'
  and perfil.rol is distinct from 'cliente'::public.app_role;

-- El trigger conserva el rol indicado en los metadatos incluso si el perfil ya existe.
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rol_solicitado public.app_role;
begin
  rol_solicitado := case
    when new.raw_user_meta_data ->> 'rol' = 'admin' then 'admin'::public.app_role
    when new.raw_user_meta_data ->> 'rol' = 'cliente' then 'cliente'::public.app_role
    else 'arquitectura'::public.app_role
  end;

  insert into public.perfiles (id, nombre, rol)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    rol_solicitado
  )
  on conflict (id) do update
  set
    nombre = excluded.nombre,
    rol = excluded.rol;

  return new;
end;
$$;

commit;

notify pgrst, 'reload schema';

-- Resultado de comprobación: cada cliente debe mostrar solamente sus proyectos asignados.
select
  perfil.nombre,
  perfil.rol,
  usuario.email,
  count(proyecto.id) as proyectos_asignados
from public.perfiles as perfil
join auth.users as usuario on usuario.id = perfil.id
left join public.proyectos_arquitectonicos as proyecto
  on proyecto.cliente_usuario_id = perfil.id
where perfil.rol = 'cliente'
group by perfil.id, perfil.nombre, perfil.rol, usuario.email
order by perfil.nombre;
