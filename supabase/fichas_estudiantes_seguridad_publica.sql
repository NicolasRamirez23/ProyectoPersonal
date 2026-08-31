-- Seguridad y auditoría del formulario público. Ejecutar después de fichas_estudiantes.sql.
begin;

create table if not exists public.fichas_estudiantes_bitacora (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ip_hash text not null,
  user_agent text,
  origin text,
  referer text,
  country text,
  cf_ray text,
  language text,
  status text not null check (status in ('accepted', 'rejected', 'blocked')),
  reason text not null,
  payload_size integer not null default 0,
  record_id uuid references public.fichas_estudiantes(id) on delete set null
);

create index if not exists fichas_bitacora_ip_fecha_idx on public.fichas_estudiantes_bitacora(ip_hash, created_at desc);
create index if not exists fichas_bitacora_estado_fecha_idx on public.fichas_estudiantes_bitacora(status, created_at desc);
alter table public.fichas_estudiantes_bitacora enable row level security;
revoke all on table public.fichas_estudiantes_bitacora from anon, authenticated;
revoke all on sequence public.fichas_estudiantes_bitacora_id_seq from anon, authenticated;

-- La página pública jamás escribe directamente; solo la Edge Function con service_role.
revoke insert, update, delete on table public.fichas_estudiantes from anon;

commit;
notify pgrst, 'reload schema';
