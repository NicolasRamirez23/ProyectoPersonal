import { supabase } from './supabaseClient';
import { analyzeNotaryDocument, sha256 } from '../lib/notaryLocalExtraction';
import type { NotaryDocumentStatus, NotaryExtractedData, NotaryInboxDocument } from '../types/notaryProcess';

const BUCKET = 'expedientes-notaria';
const fromRow = (row: any): NotaryInboxDocument => ({
  id: row.id, createdAt: row.created_at, caseId: row.expediente_id, caseFolio: row.notaria_expedientes?.folio || '', caseTitle: row.notaria_expedientes?.titulo || '', clientId: row.cliente_id || undefined,
  fileName: row.nombre_archivo, path: row.ruta, mimeType: row.mime_type, size: Number(row.tamano_bytes), hash: row.hash_sha256,
  indicatedType: row.tipo_indicado || '',
  detectedType: row.tipo_detectado, confirmedType: row.tipo_confirmado || '', detectedRole: row.rol_detectado || '', confirmedRole: row.rol_confirmado || '', status: row.estado,
  confidence: Number(row.confianza || 0), extractedData: row.datos_extraidos || {}, extractedText: row.texto_extraido || '', notes: row.notas || '',
  analyzedWithAi: !!row.analizado_con_ia, aiProvider: row.proveedor_ia || '', aiModel: row.modelo_ia || '', aiAnalyzedAt: row.analizado_ia_el || undefined,
});
async function audit(documentId: string, action: string, detail: Record<string, unknown> = {}) {
  const { error } = await supabase.from('notaria_documentos_bitacora').insert({ documento_id: documentId, accion: action, detalle: detail });
  if (error) throw new Error(error.message);
}

export const notaryInboxApi = {
  async cases() {
    const { data, error } = await supabase.from('notaria_expedientes').select('id, folio, titulo, cliente_id').neq('estatus', 'cancelado').order('created_at', { ascending: false });
    if (error) throw new Error(error.message); return data || [];
  },
  async list(status = '') {
    let query = supabase.from('notaria_documentos_expediente').select('*, notaria_expedientes(folio,titulo)').order('created_at', { ascending: false });
    if (status) query = query.eq('estado', status);
    const { data, error } = await query; if (error) throw new Error(error.message); return (data || []).map(fromRow);
  },
  async matchingClients(data: NotaryExtractedData) {
    const filters = [data.curp && `curp.ilike.${data.curp}`, data.rfc && `rfc.ilike.${data.rfc}`].filter(Boolean).join(',');
    if (!filters) return [];
    const { data: rows, error } = await supabase.from('notaria_clientes').select('id, curp, rfc, nombres, apellido_paterno, apellido_materno, domicilio').or(filters).limit(5);
    if (error) throw new Error(error.message); return rows || [];
  },
  async upload(caseData: { id: string; clientId: string }, file: File, expectedType = '', progress?: (message: string) => void) {
    if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name}: supera el límite de 15 MB.`);
    const allowed = ['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) throw new Error(`${file.name}: tipo de archivo no permitido.`);
    progress?.('Comprobando que no esté duplicado…');
    const hash = await sha256(file);
    const { data: duplicate, error: duplicateError } = await supabase.from('notaria_documentos_expediente').select('id, nombre_archivo, estado').eq('expediente_id', caseData.id).eq('hash_sha256', hash).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate && duplicate.estado !== 'rechazado') throw new Error(`${file.name}: ya existe como ${duplicate.nombre_archivo}. Rechaza la versión anterior si necesitas sustituirla.`);
    const analysis = await analyzeNotaryDocument(file, progress, expectedType);
    progress?.('Guardando original en el expediente privado…');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
    const path = `${caseData.id}/recepcion/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) throw new Error(upload.error.message);
    const payload = { expediente_id: caseData.id, cliente_id: caseData.clientId, documento_anterior_id: duplicate?.id || null, nombre_archivo: file.name, ruta: path, mime_type: file.type, tamano_bytes: file.size, hash_sha256: hash, tipo_indicado: expectedType, tipo_detectado: analysis.type, rol_detectado: analysis.role, estado: 'por_revisar', confianza: analysis.confidence, datos_extraidos: analysis.data, texto_extraido: analysis.text.slice(0, 100000) };
    let result = await supabase.from('notaria_documentos_expediente').insert(payload).select('*, notaria_expedientes(folio,titulo)').single();
    if (result.error?.message.includes('tipo_indicado')) {
      const compatiblePayload: Record<string, unknown> = { ...payload };
      delete compatiblePayload.tipo_indicado;
      result = await supabase.from('notaria_documentos_expediente').insert(compatiblePayload).select('*, notaria_expedientes(folio,titulo)').single();
    }
    const { data, error } = result;
    if (error) { await supabase.storage.from(BUCKET).remove([path]); throw new Error(error.message); }
    await audit(data.id, 'carga', { nombre: file.name, hash });
    await audit(data.id, 'lectura_local', { tipo: analysis.type, confianza: analysis.confidence });
    if (duplicate) await audit(data.id, 'sustitucion', { documento_anterior_id: duplicate.id, motivo: 'La versión anterior fue rechazada.' });
    return fromRow(data);
  },
  async analyzeWithAi(documentId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    let response: Response;
    try {
      response = await fetch('/api/analyze-notary-document', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId }), signal: controller.signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new Error('El análisis tardó más de 90 segundos. El archivo sigue guardado y puedes reintentarlo.');
      throw error;
    } finally { window.clearTimeout(timeout); }
    const data = await response.json().catch(() => ({ message: 'La función devolvió una respuesta no válida.' }));
    if (!response.ok) throw new Error(data?.message || 'No se pudo analizar el documento con IA.');
    if (!data?.ok) throw new Error(data?.message || 'No se pudo analizar el documento con IA.');
    return data;
  },
  async review(id: string, input: { status: NotaryDocumentStatus; type: string; role: string; data: NotaryExtractedData; notes: string; clientId?: string }) {
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('notaria_documentos_expediente').update({ estado: input.status, tipo_confirmado: input.type, rol_confirmado: input.role, datos_extraidos: input.data, notas: input.notes, cliente_id: input.clientId || null, revisado_por: user.user?.id, revisado_el: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    await audit(id, input.status === 'confirmado' ? 'confirmacion' : input.status === 'rechazado' ? 'rechazo' : 'revision', { tipo: input.type, rol: input.role });
  },
  async download(document: NotaryInboxDocument) {
    const { data, error } = await supabase.storage.from(BUCKET).download(document.path); if (error) throw new Error(error.message);
    await audit(document.id, 'descarga', { nombre: document.fileName }); return data;
  },
};
