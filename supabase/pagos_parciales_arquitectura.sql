-- AvTech: anticipos, pagos parciales y comprobantes.
-- Ejecutar una sola vez en Supabase > SQL Editor.

begin;

alter table public.conceptos_cobro_arquitectonicos
  drop constraint if exists conceptos_cobro_arquitectonicos_estatus_check;

alter table public.conceptos_cobro_arquitectonicos
  add constraint conceptos_cobro_arquitectonicos_estatus_check
  check (estatus in ('pendiente', 'parcial', 'pagado'));

create table if not exists public.pagos_conceptos_arquitectonicos (
  id uuid primary key default gen_random_uuid(),
  concepto_id uuid not null references public.conceptos_cobro_arquitectonicos(id) on delete cascade,
  importe numeric(12,2) not null check (importe > 0),
  fecha date not null default current_date,
  metodo text not null default 'transferencia'
    check (metodo in ('transferencia', 'efectivo', 'tarjeta', 'cheque', 'otro')),
  referencia text,
  notas text,
  comprobante_nombre text,
  comprobante_ruta text unique,
  comprobante_tipo text,
  comprobante_tamano bigint check (comprobante_tamano is null or comprobante_tamano >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_pagos_arquitectura_concepto
  on public.pagos_conceptos_arquitectonicos(concepto_id);

alter table public.pagos_conceptos_arquitectonicos enable row level security;
grant select, insert, update, delete on public.pagos_conceptos_arquitectonicos to authenticated;
revoke all on public.pagos_conceptos_arquitectonicos from anon;

drop policy if exists "Roles arquitectura gestionan pagos" on public.pagos_conceptos_arquitectonicos;
create policy "Roles arquitectura gestionan pagos"
on public.pagos_conceptos_arquitectonicos
for all to authenticated
using (public.puede_ver_arquitectura())
with check (public.puede_ver_arquitectura());

commit;

notify pgrst, 'reload schema';
