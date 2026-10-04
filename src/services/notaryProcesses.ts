import { supabase } from './supabaseClient';
import type { NotaryCase, NotaryClient, NotaryStageDraft, NotaryStageStatus } from '../types/notaryProcess';

const BUCKET = 'expedientes-notaria';
const clientFromRow = (row: any): NotaryClient => ({
  id: row.id, curp: row.curp, nombres: row.nombres, apellidoPaterno: row.apellido_paterno || '', apellidoMaterno: row.apellido_materno || '',
  rfc: row.rfc || '', email: row.email || '', telefono: row.telefono || '', domicilio: row.domicilio || '', notas: row.notas || '',
});
const nameOf = (client: NotaryClient) => [client.nombres, client.apellidoPaterno, client.apellidoMaterno].filter(Boolean).join(' ');
const caseFromRows = (row: any, stages: any[] = [], payments: any[] = [], orders: any[] = [], documents: any[] = []): NotaryCase => ({
  id: row.id, folio: row.folio, title: row.titulo, operationType: row.tipo_operacion, description: row.descripcion || '', status: row.estatus,
  startDate: row.fecha_inicio, targetDate: row.fecha_objetivo || undefined, generalCost: Number(row.costo_general || 0), discount: Number(row.descuento || 0), notes: row.notas || '', createdAt: row.created_at,
  client: clientFromRow(row.notaria_clientes),
  stages: stages.map((item) => ({ id: item.id, order: item.orden, concept: item.concepto, description: item.descripcion || '', status: item.estatus, deadline: item.fecha_limite || undefined, completedAt: item.fecha_completado || undefined, cost: Number(item.costo || 0), responsible: item.responsable || '' })).sort((a, b) => a.order - b.order),
  payments: payments.map((item) => ({ id: item.id, date: item.fecha_pago, amount: Number(item.monto), method: item.metodo, reference: item.referencia || '', notes: item.notas || '' })),
  paymentOrders: orders.map((item) => ({ id: item.id, folio: item.folio, concept: item.concepto, amount: Number(item.monto), deadline: item.fecha_limite || undefined, status: item.estatus, createdAt: item.created_at })),
  documents: documents.map((item) => ({ id: item.id, type: item.tipo, fileName: item.nombre_archivo, path: item.ruta, expiresAt: item.vence_el || undefined, createdAt: item.created_at })),
});

export const notaryProcessesApi = {
  clientName: nameOf,
  async findClientByCurp(curp: string) {
    const { data, error } = await supabase.from('notaria_clientes').select('*').ilike('curp', curp.trim()).maybeSingle();
    if (error) throw new Error(error.message); return data ? clientFromRow(data) : null;
  },
  async saveClient(input: Omit<NotaryClient, 'id'> & { id?: string }) {
    const payload = { curp: input.curp.trim().toUpperCase(), nombres: input.nombres.trim().toUpperCase(), apellido_paterno: input.apellidoPaterno.trim().toUpperCase(), apellido_materno: input.apellidoMaterno.trim().toUpperCase(), rfc: input.rfc.trim().toUpperCase(), email: input.email.trim().toLowerCase(), telefono: input.telefono.trim(), domicilio: input.domicilio.trim(), notas: input.notas.trim(), updated_at: new Date().toISOString() };
    const query = input.id ? supabase.from('notaria_clientes').update(payload).eq('id', input.id) : supabase.from('notaria_clientes').insert(payload);
    const { data, error } = await query.select('*').single(); if (error) throw new Error(error.message); return clientFromRow(data);
  },
  async createCase(input: { clientId: string; title: string; operationType: string; description: string; startDate: string; targetDate: string; generalCost: number; discount: number; notes: string; stages: NotaryStageDraft[] }) {
    const { data: row, error } = await supabase.from('notaria_expedientes').insert({ cliente_id: input.clientId, titulo: input.title.trim(), tipo_operacion: input.operationType, descripcion: input.description.trim(), fecha_inicio: input.startDate, fecha_objetivo: input.targetDate || null, costo_general: input.generalCost || 0, descuento: input.discount || 0, notas: input.notes.trim() }).select('*, notaria_clientes(*)').single();
    if (error) throw new Error(error.message);
    const payload = input.stages.map((stage, index) => ({ expediente_id: row.id, orden: index + 1, concepto: stage.concept.trim(), descripcion: stage.description.trim(), fecha_limite: stage.deadline || null, costo: stage.cost || 0, responsable: stage.responsible.trim() }));
    const { data: stages, error: stagesError } = await supabase.from('notaria_etapas').insert(payload).select('*');
    if (stagesError) { await supabase.from('notaria_expedientes').delete().eq('id', row.id); throw new Error(stagesError.message); }
    return caseFromRows(row, stages || []);
  },
  async listCases(query = '') {
    let request = supabase.from('notaria_expedientes').select('*, notaria_clientes(*)').order('created_at', { ascending: false });
    if (query.trim()) request = request.or(`folio.ilike.%${query.trim()}%,titulo.ilike.%${query.trim()}%`);
    const { data, error } = await request; if (error) throw new Error(error.message);
    return (data || []).map((row) => caseFromRows(row));
  },
  async getCase(id: string) {
    const [caseResult, stagesResult, paymentsResult, ordersResult] = await Promise.all([
      supabase.from('notaria_expedientes').select('*, notaria_clientes(*)').eq('id', id).single(),
      supabase.from('notaria_etapas').select('*').eq('expediente_id', id).order('orden'),
      supabase.from('notaria_pagos').select('*').eq('expediente_id', id).order('fecha_pago', { ascending: false }),
      supabase.from('notaria_ordenes_pago').select('*').eq('expediente_id', id).order('created_at', { ascending: false }),
    ]);
    if (caseResult.error) throw new Error(caseResult.error.message);
    const { data: documents, error: documentError } = await supabase.from('notaria_cliente_documentos').select('*').eq('cliente_id', caseResult.data.cliente_id).order('created_at', { ascending: false });
    const error = stagesResult.error || paymentsResult.error || ordersResult.error || documentError; if (error) throw new Error(error.message);
    return caseFromRows(caseResult.data, stagesResult.data || [], paymentsResult.data || [], ordersResult.data || [], documents || []);
  },
  async updateStage(id: string, status: NotaryStageStatus) {
    const { error } = await supabase.from('notaria_etapas').update({ estatus: status, fecha_completado: status === 'completado' ? new Date().toISOString().slice(0, 10) : null }).eq('id', id); if (error) throw new Error(error.message);
  },
  async addPayment(expedienteId: string, input: { date: string; amount: number; method: string; reference: string; notes: string }) {
    const { error } = await supabase.from('notaria_pagos').insert({ expediente_id: expedienteId, fecha_pago: input.date, monto: input.amount, metodo: input.method, referencia: input.reference.trim(), notas: input.notes.trim() }); if (error) throw new Error(error.message);
  },
  async createPaymentOrder(expedienteId: string, input: { concept: string; amount: number; deadline: string }) {
    const { data, error } = await supabase.from('notaria_ordenes_pago').insert({ expediente_id: expedienteId, concepto: input.concept.trim(), monto: input.amount, fecha_limite: input.deadline || null }).select('*').single(); if (error) throw new Error(error.message); return data;
  },
  async uploadClientDocument(clientId: string, input: { type: string; expiresAt: string; notes: string; file: File }) {
    const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]+/g, '-'); const path = `${clientId}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from(BUCKET).upload(path, input.file, { contentType: input.file.type }); if (upload.error) throw new Error(upload.error.message);
    const { error } = await supabase.from('notaria_cliente_documentos').insert({ cliente_id: clientId, tipo: input.type, nombre_archivo: input.file.name, ruta: path, vence_el: input.expiresAt || null, notas: input.notes.trim() });
    if (error) { await supabase.storage.from(BUCKET).remove([path]); throw new Error(error.message); }
  },
  async downloadClientDocument(path: string) { const { data, error } = await supabase.storage.from(BUCKET).download(path); if (error) throw new Error(error.message); return data; },
  async calendar(from: string, to: string) {
    const { data, error } = await supabase.from('notaria_etapas').select('*, notaria_expedientes(id, folio, titulo, notaria_clientes(nombres, apellido_paterno, apellido_materno))').gte('fecha_limite', from).lte('fecha_limite', to).neq('estatus', 'cancelado').order('fecha_limite');
    if (error) throw new Error(error.message); return data || [];
  },
};
