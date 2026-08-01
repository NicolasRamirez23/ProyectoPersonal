-- AvTech: etapas, responsables, fechas y tareas del proyecto.
-- Ejecutar una sola vez en Supabase > SQL Editor.

alter table public.proyectos_arquitectonicos
  add column if not exists etapas jsonb not null default '[]'::jsonb;

comment on column public.proyectos_arquitectonicos.etapas is
  'Etapas del proyecto con responsables, fechas, estado y tareas.';

notify pgrst, 'reload schema';
