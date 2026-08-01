import { supabase } from './supabaseClient';

export const clientAccessService = {
  async getClients() {
    const { data, error } = await supabase.from('perfiles')
      .select('id, nombre').eq('rol', 'cliente').order('nombre');
    if (error) throw error;
    return (data || []) as { id: string; nombre: string }[];
  },
  async createClient(input: { username: string; name: string; password: string }) {
    const { data, error } = await supabase.functions.invoke('create-client-user', { body: input });
    if (error) {
      const response = (error as { context?: Response }).context;
      if (response) {
        let serverMessage = '';
        try {
          const body = await response.clone().json() as { message?: string };
          serverMessage = body.message || '';
        } catch {
          // Some infrastructure errors return HTML or an empty response.
        }
        if (serverMessage) throw new Error(serverMessage);
      }
      throw new Error(error.message || 'La función de Supabase no respondió correctamente.');
    }
    if (data?.message) throw new Error(data.message);
    return data as { id: string; username: string; name: string };
  },
};
