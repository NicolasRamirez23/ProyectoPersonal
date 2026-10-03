import { supabase } from './supabaseClient';

export const notaryUserApi = {
  async savePassword(input: { name: string; password: string }) {
    const { data, error } = await supabase.functions.invoke('manage-notary-user', { body: input });
    if (error) {
      let message = error.message;
      const response = (error as { context?: Response }).context;

      if (response instanceof Response) {
        try {
          const body = await response.clone().json() as { message?: string };
          if (body.message) message = body.message;
        } catch {
          // Conserva el mensaje original cuando la respuesta no contiene JSON.
        }
      }

      throw new Error(message);
    }
    if (data?.message && !data?.username) throw new Error(data.message);
    return data as { username: string; name: string; created: boolean };
  },
};
