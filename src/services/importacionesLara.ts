import { supabase } from './supabaseClient';
import type { LaraReceipt } from '../types/importacionesLara';

const mapRow = (row: any): LaraReceipt => ({
  id: row.id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  folio: row.folio,
  metodoPago: row.metodo_pago,
  estadoPago: row.estado_pago,
  conceptos: row.conceptos || [],
  total: Number(row.total || 0),
});

const payload = (receipt: LaraReceipt) => ({ metodo_pago: receipt.metodoPago, estado_pago: receipt.estadoPago, conceptos: receipt.conceptos, total: receipt.total });

export const importacionesLaraApi = {
  async list() {
    const { data, error } = await supabase.from('recibos_importaciones_lara').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapRow);
  },
  async getById(id: string) {
    const { data, error } = await supabase.from('recibos_importaciones_lara').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },
  async create(receipt: LaraReceipt) {
    const { data, error } = await supabase.from('recibos_importaciones_lara').insert(payload(receipt)).select('*').single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },
  async update(id: string, receipt: LaraReceipt) {
    const { data, error } = await supabase.from('recibos_importaciones_lara').update(payload(receipt)).eq('id', id).select('*').single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },
};
