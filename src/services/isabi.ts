import { supabase } from './supabaseClient';
import type { IsabiDocumentDraft, IsabiRecord } from '../types/isabi';

const BUCKET = 'expedientes-isabi';
const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, '-');

export const isabiApi = {
  async list() {
    const { data, error } = await supabase.from('notaria_isabi_expedientes').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((row: any): IsabiRecord => ({ id: row.id, folioInterno: row.folio_interno, status: row.estatus, data: row.datos || {}, createdAt: row.created_at, updatedAt: row.updated_at }));
  },
  async save(record: IsabiRecord, documents: IsabiDocumentDraft[]) {
    const payload = { estatus: record.status, datos: record.data };
    const request = record.id
      ? supabase.from('notaria_isabi_expedientes').update(payload).eq('id', record.id)
      : supabase.from('notaria_isabi_expedientes').insert(payload);
    const { data, error } = await request.select('*').single();
    if (error) throw new Error(error.message);
    for (const document of documents) {
      const path = `${data.id}/${document.block}/${crypto.randomUUID()}-${safeName(document.file.name)}`;
      const upload = await supabase.storage.from(BUCKET).upload(path, document.file, { contentType: document.file.type, upsert: false });
      if (upload.error) throw new Error(upload.error.message);
      const inserted = await supabase.from('notaria_isabi_documentos').insert({ expediente_id: data.id, bloque: document.block, tipo_documento: document.expectedType, nombre_archivo: document.file.name, ruta: path, mime_type: document.file.type, tamano_bytes: document.file.size, confianza: document.confidence, datos_extraidos: document.extractedData, advertencias: document.warnings });
      if (inserted.error) { await supabase.storage.from(BUCKET).remove([path]); throw new Error(inserted.error.message); }
    }
    return { id: data.id as string, folioInterno: data.folio_interno as string };
  },
};
