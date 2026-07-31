import { createClient } from '@supabase/supabase-js';


const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ Crítico: Las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no están definidas en el archivo .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const mockApi = {
  // Obtener los registros de la tabla 'padron'
  async getClientes() {
    const { data, error } = await supabase
      .from('padron')
      .select('id, nombre, celular')
      .order('nombre', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  },

  // Registrar cliente nuevo en la tabla 'padron'
  async createClienteNuevo(nombre: string, celular: string) {
    const { data, error } = await supabase
      .from('padron')
      .insert([{ nombre: nombre, celular: celular }])
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return data.id;
  },

  // Registrar proyecto en la tabla 'proyectos'
  async createProject(formData: any) {
    const { data, error } = await supabase
      .from('proyectos')
      .insert([formData]) // Recibe { cliente, pago, pago_inicial, tipo_pago, ... }
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async getProjects() {
    const { data, error } = await supabase
      .from('proyectos')
      .select(`
        id,
        created_at,
        pago,
        pago_inicial,
        fecha_inicio,
        fecha_firma_contrato,
        tipo_pago,
        padron!fk_padron (
          nombre,
          celular
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Error al obtener listado: ${error.message}`);
    
    // Mapeamos los datos para aplanarlos y que sean más fáciles de usar en React
    return (data || []).map((p: any) => ({
      id: p.id,
      pago: p.pago,
      pago_inicial: p.pago_inicial,
      fecha_inicio: p.fecha_inicio,
      fecha_firma_contrato: p.fecha_firma_contrato,
      tipo_pago: p.tipo_pago,
      // Extraemos limpiamente los datos desde la relación con padron
      cliente_nombre: p.padron?.nombre || 'Sin cliente asignado',
      cliente_celular: p.padron?.celular || 'Sin celular'
    }));
  },

  async getProjectById(id: string | number) {
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data; // Retorna el objeto con: cliente, pago, pago_inicial, etc.
  },

  // 2. Actualizar las columnas de un proyecto
  async updateProject(id: string | number, updateData: any) {
    const { data, error } = await supabase
      .from('proyectos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // 2. Registrar un pago (abono o liquidación) en un plazo específico
  async getPagosByProyecto(proyectoId: string | number) {
    const { data, error } = await supabase
      .from('pagos')
      .select(`
        *,
        recibos_abonos (
          id,
          monto_abonado,
          fecha_pago,
          metodo_pago,
          concepto,
          observaciones
        )
      `)
      .eq('credito_id', proyectoId)
      .order('id', { ascending: true });

    if (error) throw new Error(`Error al obtener plazos: ${error.message}`);
    return data;
  },

  // 2. Insertar el abono real en tu tabla 'recibos_abonos'
  async registrarReciboAbono(payload: {
    mensualidad_id: number;
    monto_abonado: number;
    fecha_pago: string;
    metodo_pago: string;
    concepto: string;
    observaciones?: string;
  }) {
    const { data, error } = await supabase
      .from('recibos_abonos')
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(`Error al guardar en recibos_abonos: ${error.message}`);
    return data;
  }
};
