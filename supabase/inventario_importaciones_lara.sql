-- Inventario de Importaciones Lara. Ejecutar después de importaciones_lara.sql
-- y usuario_importaciones_lara.sql.
begin;

create table if not exists public.productos_importaciones_lara (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sku text not null unique check (char_length(trim(sku)) between 1 and 60),
  nombre text not null check (char_length(trim(nombre)) between 1 and 160),
  categoria text not null default '',
  existencia integer not null default 0 check (existencia >= 0),
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  costo numeric(12,2) not null default 0 check (costo >= 0),
  precio_venta numeric(12,2) not null default 0 check (precio_venta >= 0),
  notas text not null default '',
  activo boolean not null default true
);

create table if not exists public.movimientos_inventario_lara (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  producto_id uuid not null references public.productos_importaciones_lara(id) on delete restrict,
  tipo text not null check (tipo in ('ENTRADA', 'SALIDA')),
  cantidad integer not null check (cantidad > 0),
  existencia_anterior integer not null check (existencia_anterior >= 0),
  existencia_nueva integer not null check (existencia_nueva >= 0),
  motivo text not null check (char_length(trim(motivo)) between 1 and 250),
  creado_por uuid not null default auth.uid() references auth.users(id)
);

create index if not exists productos_lara_nombre_idx on public.productos_importaciones_lara(nombre);
create index if not exists movimientos_lara_producto_fecha_idx on public.movimientos_inventario_lara(producto_id, created_at desc);

drop trigger if exists actualizar_fecha_producto_lara on public.productos_importaciones_lara;
create trigger actualizar_fecha_producto_lara before update on public.productos_importaciones_lara
for each row execute function public.actualizar_fecha_recibo_lara();

alter table public.productos_importaciones_lara enable row level security;
alter table public.movimientos_inventario_lara enable row level security;
grant select, insert, update on public.productos_importaciones_lara to authenticated;
grant select on public.movimientos_inventario_lara to authenticated;
revoke all on public.productos_importaciones_lara from anon;
revoke all on public.movimientos_inventario_lara from anon;

drop policy if exists "Encargados gestionan productos Lara" on public.productos_importaciones_lara;
create policy "Encargados gestionan productos Lara" on public.productos_importaciones_lara
for all to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin', 'importaciones_lara')))
with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin', 'importaciones_lara')));

drop policy if exists "Encargados consultan movimientos Lara" on public.movimientos_inventario_lara;
create policy "Encargados consultan movimientos Lara" on public.movimientos_inventario_lara
for select to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin', 'importaciones_lara')));

create or replace function public.registrar_movimiento_inventario_lara(
  p_producto_id uuid,
  p_tipo text,
  p_cantidad integer,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anterior integer;
  v_nueva integer;
begin
  if not exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin', 'importaciones_lara')) then
    raise exception 'No autorizado';
  end if;
  if p_tipo not in ('ENTRADA', 'SALIDA') or p_cantidad is null or p_cantidad <= 0 or char_length(trim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Movimiento inválido';
  end if;

  select existencia into v_anterior from public.productos_importaciones_lara where id = p_producto_id and activo for update;
  if not found then raise exception 'Producto no encontrado o inactivo'; end if;
  v_nueva := case when p_tipo = 'ENTRADA' then v_anterior + p_cantidad else v_anterior - p_cantidad end;
  if v_nueva < 0 then raise exception 'Existencia insuficiente'; end if;

  update public.productos_importaciones_lara set existencia = v_nueva where id = p_producto_id;
  insert into public.movimientos_inventario_lara(producto_id, tipo, cantidad, existencia_anterior, existencia_nueva, motivo, creado_por)
  values (p_producto_id, p_tipo, p_cantidad, v_anterior, v_nueva, upper(trim(p_motivo)), auth.uid());
end;
$$;

revoke all on function public.registrar_movimiento_inventario_lara(uuid, text, integer, text) from public, anon;
grant execute on function public.registrar_movimiento_inventario_lara(uuid, text, integer, text) to authenticated;

commit;
notify pgrst, 'reload schema';
