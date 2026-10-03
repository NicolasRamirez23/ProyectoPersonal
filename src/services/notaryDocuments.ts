import { supabase } from './supabaseClient';
import { createNotarySearchOfficeDocx, createNotarySearchOfficePdf } from '../lib/notaryDocuments';
import type { NotarySearchOfficeData, NotaryStoredDocument } from '../types/notary';

const BUCKET = 'documentos-notaria';
const mapDocument = (row: any, urls?: Map<string, string>): NotaryStoredDocument => ({
  id: row.id, folio: row.folio, createdAt: row.created_at, formatType: row.tipo_formato,
  referenceName: row.nombre_referencia, authority: row.autoridad, data: row.datos,
  docxPath: row.ruta_docx || undefined, pdfPath: row.ruta_pdf || undefined,
  docxUrl: row.ruta_docx ? urls?.get(row.ruta_docx) : undefined,
  pdfUrl: row.ruta_pdf ? urls?.get(row.ruta_pdf) : undefined,
});

export const notaryDocumentsApi = {
  async createSearchOffice(data: NotarySearchOfficeData) {
    const { data: row, error } = await supabase.from('documentos_notaria').insert({
      tipo_formato: 'BUSQUEDA_RADICACION', nombre_referencia: data.deceasedName.trim().toUpperCase(),
      autoridad: data.authorityName.trim().toUpperCase(), datos: data,
    }).select('*').single();
    if (error) throw new Error(error.message);
    const basePath = `${row.id}/${row.folio}`;
    const docxPath = `${basePath}.docx`; const pdfPath = `${basePath}.pdf`;
    const [docx, pdf] = await Promise.all([createNotarySearchOfficeDocx(data), Promise.resolve(createNotarySearchOfficePdf(data))]);
    const [docxUpload, pdfUpload] = await Promise.all([
      supabase.storage.from(BUCKET).upload(docxPath, docx, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      supabase.storage.from(BUCKET).upload(pdfPath, pdf, { contentType: 'application/pdf' }),
    ]);
    if (docxUpload.error || pdfUpload.error) {
      await supabase.storage.from(BUCKET).remove([docxPath, pdfPath]);
      await supabase.from('documentos_notaria').delete().eq('id', row.id);
      throw new Error(docxUpload.error?.message || pdfUpload.error?.message || 'No fue posible guardar los archivos.');
    }
    const { data: saved, error: updateError } = await supabase.from('documentos_notaria').update({ ruta_docx: docxPath, ruta_pdf: pdfPath }).eq('id', row.id).select('*').single();
    if (updateError) {
      await supabase.storage.from(BUCKET).remove([docxPath, pdfPath]);
      await supabase.from('documentos_notaria').delete().eq('id', row.id);
      throw new Error(updateError.message);
    }
    return mapDocument(saved);
  },
  async list() {
    const { data, error } = await supabase.from('documentos_notaria').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data || []; const paths = rows.flatMap((row: any) => [row.ruta_docx, row.ruta_pdf]).filter(Boolean);
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      if (signError) throw new Error(signError.message);
      signed?.forEach((item) => { if (item.signedUrl) urls.set(item.path, item.signedUrl); });
    }
    return rows.map((row: any) => mapDocument(row, urls));
  },
  async download(document: NotaryStoredDocument, type: 'word' | 'pdf') {
    const path = type === 'word' ? document.docxPath : document.pdfPath;
    if (!path) throw new Error(`El archivo ${type === 'word' ? 'Word' : 'PDF'} todavía no está disponible.`);
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error) throw new Error(error.message);
    return data;
  },
};
