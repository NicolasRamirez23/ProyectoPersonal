-- AvTech: plantillas reutilizables de actividades y alcances.
-- Ejecutar una sola vez en Supabase > SQL Editor.

alter table public.catalogo_valores
  add column if not exists plantilla_alcances jsonb not null default '[]'::jsonb;

comment on column public.catalogo_valores.plantilla_alcances is
  'Actividades sugeridas que se copian al proyecto al seleccionar el concepto.';

update public.catalogo_valores cv
set plantilla_alcances = templates.items
from public.catalogos c
join (
  values
    ('Planos arquitectónicos', '[
      {"name":"Elaboración de planos arquitectónicos","scope":"Plantas, fachadas, cortes y detalles definidos para el proyecto."}
    ]'::jsonb),
    ('Planos eléctricos', '[
      {"name":"Plano de iluminación","scope":"Distribución de luminarias, apagadores y circuitos."},
      {"name":"Plano de contactos","scope":"Contactos generales, especiales y alimentaciones."},
      {"name":"Cuadro de cargas","scope":"Balanceo de circuitos y capacidades."},
      {"name":"Diagrama unifilar","scope":"Representación general de la instalación eléctrica."}
    ]'::jsonb),
    ('Planos hidráulicos', '[
      {"name":"Red de agua potable","scope":"Trazado, diámetros y puntos de alimentación."},
      {"name":"Red sanitaria","scope":"Descargas, pendientes y registros."},
      {"name":"Isométricos","scope":"Representación de recorridos y conexiones principales."}
    ]'::jsonb),
    ('Renders', '[
      {"name":"Modelado 3D","scope":"Construcción del modelo digital con base en los planos aprobados."},
      {"name":"Materiales e iluminación","scope":"Aplicación de acabados, mobiliario e iluminación."},
      {"name":"Imágenes finales","scope":"Entrega de visualizaciones en alta resolución."}
    ]'::jsonb)
) as templates(valor, items) on true
where c.id = cv.catalogo_id
  and c.clave = 'conceptos_cobro'
  and cv.valor = templates.valor
  and cv.plantilla_alcances = '[]'::jsonb;

notify pgrst, 'reload schema';
