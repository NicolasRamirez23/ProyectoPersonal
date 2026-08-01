import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = req.headers.get('Authorization') || '';
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');

    const { data: profile, error: profileError } = await caller
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single();
    if (profileError) throw new Error(`No se pudo verificar tu perfil: ${profileError.message}`);
    if (!profile || !['admin', 'arquitectura'].includes(profile.rol)) {
      throw new Error('No tienes permiso para crear clientes.');
    }

    const { username, name, password } = await req.json();
    const cleanUsername = String(username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (cleanUsername.length < 3) throw new Error('El usuario debe tener al menos 3 caracteres.');
    if (String(password || '').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    if (!String(name || '').trim()) throw new Error('El nombre del cliente es obligatorio.');

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.auth.admin.createUser({
      email: `${cleanUsername}@avtech.local`,
      password,
      email_confirm: true,
      user_metadata: { nombre: String(name).trim(), rol: 'cliente' },
    });
    if (error) throw error;

    const { error: profileCreateError } = await admin
      .from('perfiles')
      .upsert({ id: data.user.id, nombre: String(name).trim(), rol: 'cliente' });
    if (profileCreateError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw new Error(`No se pudo crear el perfil del cliente: ${profileCreateError.message}`);
    }

    return Response.json(
      { id: data.user.id, username: cleanUsername, name: String(name).trim() },
      { headers: cors },
    );
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : 'No se pudo crear el cliente.' },
      { status: 400, headers: cors },
    );
  }
});
