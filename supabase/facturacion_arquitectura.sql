-- AvTech: datos fiscales para recibos y facturas comerciales.
-- Ejecutar en Supabase > SQL Editor.

begin;

alter table public.proyectos_arquitectonicos
  add column if not exists requiere_factura boolean not null default false,
  add column if not exists razon_social text,
  add column if not exists rfc text,
  add column if not exists domicilio_fiscal text,
  add column if not exists codigo_postal_fiscal text,
  add column if not exists regimen_fiscal text,
  add column if not exists correo_facturacion text,
  add column if not exists uso_cfdi text;

commit;

notify pgrst, 'reload schema';
