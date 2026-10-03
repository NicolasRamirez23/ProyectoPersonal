import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!; const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!; const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');
    const { data: profile } = await caller.from('perfiles').select('rol').eq('id', user.id).single();
    if (profile?.rol !== 'admin') throw new Error('Solo el administrador puede gestionar esta cuenta.');
    const { name, password } = await req.json(); const cleanName = String(name || '').trim(); const cleanPassword = String(password || '');
    if (!cleanName) throw new Error('El nombre visible es obligatorio.');
    if (cleanPassword.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const email = 'vladimir_davis@avtech.local'; let existingId = ''; let page = 1;
    while (!existingId) { const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 }); if (error) throw error; existingId = data.users.find((item) => item.email?.toLowerCase() === email)?.id || ''; if (existingId || data.users.length < 100) break; page += 1; }
    let userId = existingId; const created = !existingId;
    if (existingId) { const { error } = await admin.auth.admin.updateUserById(existingId, { password: cleanPassword, user_metadata: { nombre: cleanName, rol: 'notaria' } }); if (error) throw error; }
    else { const { data, error } = await admin.auth.admin.createUser({ email, password: cleanPassword, email_confirm: true, user_metadata: { nombre: cleanName, rol: 'notaria' } }); if (error) throw error; userId = data.user.id; }
    const { error: profileError } = await admin.from('perfiles').upsert({ id: userId, nombre: cleanName, rol: 'notaria' });
    if (profileError) { if (created) await admin.auth.admin.deleteUser(userId); throw new Error(`No se pudo asignar el acceso de Notaría: ${profileError.message}`); }
    return json({ username: 'vladimir_davis', name: cleanName, created });
  } catch (error) { return json({ message: error instanceof Error ? error.message : 'No se pudo guardar el usuario.' }, 400); }
});
