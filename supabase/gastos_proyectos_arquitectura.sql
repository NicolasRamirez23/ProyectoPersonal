-- AvTech: gastos, costos y comprobantes por proyecto.

begin;

create table if not exists public.gastos_proyectos_arquitectonicos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos_arquitectonicos(id) on delete cascade,
  categoria text not null check (categoria in ('honorarios','impresiones','traslados','permisos','materiales','administrativo','otro')),
  concepto text not null,
  proveedor text,
  importe numeric(12,2) not null check (importe >= 0),
  fecha date not null default current_date,
  estatus text not null default 'pendiente' check (estatus in ('pendiente','pagado')),
  metodo_pago text not null default 'transferencia' check (metodo_pago in ('transferencia','efectivo','tarjeta','cheque','otro')),
  notas text,
  comprobante_nombre text,
  comprobante_ruta text unique,
  comprobante_tipo text,
  comprobante_tamano bigint check (comprobante_tamano is null or comprobante_tamano >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_gastos_arquitectura_proyecto on public.gastos_proyectos_arquitectonicos(proyecto_id);
alter table public.gastos_proyectos_arquitectonicos enable row level security;
grant select, insert, update, delete on public.gastos_proyectos_arquitectonicos to authenticated;
revoke all on public.gastos_proyectos_arquitectonicos from anon;

drop policy if exists "Roles arquitectura gestionan gastos" on public.gastos_proyectos_arquitectonicos;
create policy "Roles arquitectura gestionan gastos" on public.gastos_proyectos_arquitectonicos
for all to authenticated using (public.puede_ver_arquitectura()) with check (public.puede_ver_arquitectura());

drop policy if exists "Cliente consulta gastos asignados" on public.gastos_proyectos_arquitectonicos;
-- Los gastos internos no se exponen al perfil cliente.

commit;
notify pgrst, 'reload schema';
