-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Los subconceptos se guardan como una lista JSON dentro de cada concepto.

alter table public.conceptos_cobro_arquitectonicos
  add column if not exists subconceptos jsonb not null default '[]'::jsonb;

comment on column public.conceptos_cobro_arquitectonicos.subconceptos is
  'Actividades y alcances incluidos en el concepto, con importe opcional.';
