import { supabase } from './supabaseClient';

export interface CatalogValue {
  id: string;
  value: string;
  order: number;
  active: boolean;
}

export interface Catalog {
  id: string;
  key: string;
  name: string;
  description: string;
  values: CatalogValue[];
}

interface CatalogRow {
  id: string;
  clave: string;
  nombre: string;
  descripcion: string | null;
  catalogo_valores?: {
    id: string;
    valor: string;
    orden: number;
    activo: boolean;
  }[];
}

function mapCatalog(row: CatalogRow): Catalog {
  return {
    id: row.id,
    key: row.clave,
    name: row.nombre,
    description: row.descripcion || '',
    values: (row.catalogo_valores || [])
      .map((value) => ({
        id: value.id,
        value: value.valor,
        order: value.orden,
        active: value.activo,
      }))
      .sort((a, b) => a.order - b.order || a.value.localeCompare(b.value)),
  };
}

export const catalogsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('catalogos')
      .select('id, clave, nombre, descripcion, catalogo_valores(id, valor, orden, activo)')
      .order('nombre');
    if (error) throw error;
    return (data || []).map((row) => mapCatalog(row as CatalogRow));
  },

  async getActiveValues(key: string) {
    const { data, error } = await supabase
      .from('catalogos')
      .select('id, clave, nombre, descripcion, catalogo_valores(id, valor, orden, activo)')
      .eq('clave', key)
      .eq('catalogo_valores.activo', true)
      .single();
    if (error) throw error;
    return mapCatalog(data as CatalogRow).values;
  },

  async addValue(catalogId: string, value: string, order: number) {
    const { error } = await supabase.from('catalogo_valores').insert({
      catalogo_id: catalogId,
      valor: value.trim(),
      orden: order,
    });
    if (error) throw error;
  },

  async updateValue(id: string, patch: Partial<CatalogValue>) {
    const row: Record<string, string | number | boolean> = {};
    if (patch.value !== undefined) row.valor = patch.value.trim();
    if (patch.order !== undefined) row.orden = patch.order;
    if (patch.active !== undefined) row.activo = patch.active;
    const { error } = await supabase.from('catalogo_valores').update(row).eq('id', id);
    if (error) throw error;
  },

  async removeValue(id: string) {
    const { error } = await supabase.from('catalogo_valores').delete().eq('id', id);
    if (error) throw error;
  },
};
