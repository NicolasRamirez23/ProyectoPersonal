import { supabase } from './supabaseClient';
import type { StudentRecordData } from '../types/studentRecord';

const mapRow = (row: any): StudentRecordData => ({
  ...row.datos,
  id: row.id,
  createdAt: row.created_at,
  nombre: row.nombre,
  escuela: row.escuela,
  gradoGrupo: row.grado_grupo,
  foto: row.foto,
});

export const studentRecordsApi = {
  async list() {
    const { data, error } = await supabase
      .from('fichas_estudiantes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapRow);
  },

  async create(record: StudentRecordData) {
    const { error } = await supabase
      .from('fichas_estudiantes')
      .insert({
        nombre: record.nombre,
        escuela: record.escuela,
        grado_grupo: record.gradoGrupo,
        foto: record.foto,
        datos: record,
      });
    if (error) throw new Error(error.message);
    // El usuario de captura no tiene permiso de lectura. Conservamos únicamente
    // los datos enviados en memoria para generar su PDF inmediatamente.
    return record;
  },

  async createPublic(record: StudentRecordData, captchaToken: string, website = '') {
    const { data, error } = await supabase.functions.invoke('create-public-student-record', {
      body: { record, captchaToken, website },
    });
    if (error) throw new Error((data as any)?.message || error.message);
    if (!data?.record) throw new Error('La solicitud no devolvió el registro creado.');
    return data.record as StudentRecordData;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('fichas_estudiantes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },

  async update(id: string, record: StudentRecordData) {
    const { data, error } = await supabase
      .from('fichas_estudiantes')
      .update({
        nombre: record.nombre,
        escuela: record.escuela,
        grado_grupo: record.gradoGrupo,
        foto: record.foto,
        datos: record,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },
};
