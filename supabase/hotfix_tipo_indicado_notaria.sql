begin;

alter table public.notaria_documentos_expediente
  add column if not exists tipo_indicado text not null default '';

commit;
notify pgrst, 'reload schema';
