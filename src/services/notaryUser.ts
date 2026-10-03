import { supabase } from './supabaseClient';

export const notaryUserApi = {
  async savePassword(input: { name: string; password: string }) {
    const { data, error } = await supabase.functions.invoke('manage-notary-user', { body: input });
    if (error) throw new Error(error.message);
    if (data?.message && !data?.username) throw new Error(data.message);
    return data as { username: string; name: string; created: boolean };
  },
};
