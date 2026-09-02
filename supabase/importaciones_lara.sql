-- Modulo Importaciones Lara. Acceso exclusivo para administradores.
begin;

create sequence if not exists public.recibos_importaciones_lara_folio_seq;

create table if not exists public.recibos_importaciones_lara (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  folio text not null unique default ('LARA-' || lpad(nextval('public.recibos_importaciones_lara_folio_seq')::text, 6, '0')),
  metodo_pago text not null check (metodo_pago in ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'DEPÓSITO', 'OTRO')),
  estado_pago text not null check (estado_pago in ('EN PROCESO', 'TERMINADO')),
  conceptos jsonb not null check (jsonb_typeof(conceptos) = 'array' and jsonb_array_length(conceptos) > 0),
  total numeric(12,2) not null check (total >= 0)
);

alter table public.recibos_importaciones_lara
  alter column folio set default ('LARA-' || lpad(nextval('public.recibos_importaciones_lara_folio_seq')::text, 6, '0'));

select setval(
  'public.recibos_importaciones_lara_folio_seq',
  coalesce((select max(substring(folio from '[0-9]+$')::bigint) from public.recibos_importaciones_lara where folio ~ '^LARA-[0-9]+$'), 0) + 1,
  false
);

create or replace function public.actualizar_fecha_recibo_lara()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists actualizar_fecha_recibo_lara on public.recibos_importaciones_lara;
create trigger actualizar_fecha_recibo_lara before update on public.recibos_importaciones_lara
for each row execute function public.actualizar_fecha_recibo_lara();

alter table public.recibos_importaciones_lara enable row level security;
grant select, insert, update, delete on public.recibos_importaciones_lara to authenticated;
grant usage, select on sequence public.recibos_importaciones_lara_folio_seq to authenticated;
revoke all on public.recibos_importaciones_lara from anon;
drop policy if exists "Administrador gestiona recibos Lara" on public.recibos_importaciones_lara;
drop policy if exists "Encargados gestionan recibos Lara" on public.recibos_importaciones_lara;
create policy "Encargados gestionan recibos Lara" on public.recibos_importaciones_lara
for all to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin', 'importaciones_lara')))
with check (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol::text in ('admin', 'importaciones_lara')));

commit;
notify pgrst, 'reload schema';
