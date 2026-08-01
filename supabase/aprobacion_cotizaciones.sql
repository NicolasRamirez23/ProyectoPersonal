-- AvTech: envío, aprobación y rechazo de cotizaciones.
-- Ejecutar después de portal_clientes.sql.

begin;

alter table public.proyectos_arquitectonicos
  add column if not exists estado_cotizacion text not null default 'borrador'
    check (estado_cotizacion in ('borrador', 'enviada', 'aprobada', 'rechazada', 'vencida')),
  add column if not exists cotizacion_respondida_at timestamptz,
  add column if not exists cotizacion_comentario text,
  add column if not exists cotizacion_respondida_por uuid references auth.users(id) on delete set null;

create or replace function public.responder_cotizacion(
  p_proyecto_id uuid,
  p_respuesta text,
  p_comentario text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_respuesta not in ('aprobada', 'rechazada') then
    raise exception 'Respuesta de cotización no válida';
  end if;

  update public.proyectos_arquitectonicos
  set estado_cotizacion = p_respuesta,
      cotizacion_respondida_at = now(),
      cotizacion_comentario = nullif(trim(coalesce(p_comentario, '')), ''),
      cotizacion_respondida_por = auth.uid()
  where id = p_proyecto_id
    and cliente_usuario_id = auth.uid()
    and estado_cotizacion = 'enviada';

  if not found then
    raise exception 'La cotización no está disponible para responder';
  end if;
end;
$$;

revoke all on function public.responder_cotizacion(uuid, text, text) from public;
grant execute on function public.responder_cotizacion(uuid, text, text) to authenticated;

commit;
notify pgrst, 'reload schema';
