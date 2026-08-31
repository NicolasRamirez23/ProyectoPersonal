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

-- Acceso público mínimo: puede insertar, pero nunca consultar, modificar o borrar.
revoke all on table public.fichas_estudiantes from anon;
grant insert on table public.fichas_estudiantes to anon;

drop policy if exists "Publico crea fichas validadas" on public.fichas_estudiantes;
create policy "Publico crea fichas validadas" on public.fichas_estudiantes
for insert to anon
with check (
  length(trim(nombre)) between 3 and 150
  and escuela = 'JARDÍN DE NIÑOS JOSEFINA RAMOS DEL RÍO F-24'
  and length(trim(grado_grupo)) between 5 and 30
  and length(foto) between 100 and 1500000
  and foto like 'data:image/jpeg;base64,%'
  and jsonb_typeof(datos) = 'object'
  and coalesce(datos ->> 'maestra', '') = 'ABRIL SOLORZANO'
  and coalesce(datos ->> 'curp', '') ~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$'
);

create unique index if not exists fichas_estudiantes_curp_unica_idx
on public.fichas_estudiantes (upper(datos ->> 'curp'));

create or replace function public.limitar_altas_publicas_fichas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'anon' and (
    select count(*) from public.fichas_estudiantes
    where created_at >= now() - interval '1 minute'
  ) >= 20 then
    raise exception 'Se alcanzó el límite temporal de registros. Inténtalo en un minuto.';
  end if;
  return new;
end;
$$;

drop trigger if exists limitar_altas_publicas_fichas on public.fichas_estudiantes;
create trigger limitar_altas_publicas_fichas
before insert on public.fichas_estudiantes
for each row execute function public.limitar_altas_publicas_fichas();

commit;
notify pgrst, 'reload schema';
