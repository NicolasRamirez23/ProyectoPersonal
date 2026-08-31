import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status: number, origin: string) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'vary': 'Origin' } });
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const validCurp = (value: unknown) => /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(String(value || ''));
const validPhone = (value: unknown) => /^\d{3}-\d{3}-\d{4}$/.test(String(value || ''));
const validDate = (value: unknown) => /^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/.test(String(value || ''));

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin') || '';
  const allowedOrigins = (Deno.env.get('PUBLIC_FORM_ORIGINS') || '').split(',').map((value) => value.trim()).filter(Boolean);
  const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] || requestOrigin;
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'access-control-allow-origin': corsOrigin, 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'vary': 'Origin' } });
  if (req.method !== 'POST') return json({ message: 'Método no permitido.' }, 405, corsOrigin);
  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) return json({ message: 'Origen no autorizado.' }, 403, corsOrigin);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const rateSalt = Deno.env.get('RATE_LIMIT_SALT')!;
  if (!rateSalt) return json({ message: 'La protección del formulario no está configurada.' }, 503, corsOrigin);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
  const ipHash = await sha256(`${rateSalt}:${ip}`);
  const metadata = { ip_hash: ipHash, user_agent: req.headers.get('user-agent'), origin: requestOrigin, referer: req.headers.get('referer'), country: req.headers.get('cf-ipcountry'), cf_ray: req.headers.get('cf-ray'), language: req.headers.get('accept-language')?.slice(0, 120) };
  const log = async (status: string, reason: string, payloadSize = 0, recordId?: string) => { await admin.from('fichas_estudiantes_bitacora').insert({ ...metadata, status, reason, payload_size: payloadSize, record_id: recordId || null }); };

  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > 1_500_000) { await log('blocked', 'payload_too_large', contentLength); return json({ message: 'La fotografía o la solicitud es demasiado grande.' }, 413, corsOrigin); }
    const since15m = new Date(Date.now() - 15 * 60_000).toISOString();
    const since1h = new Date(Date.now() - 60 * 60_000).toISOString();
    const [{ count: recentAttempts }, { count: recentSuccess }, { count: globalMinute }] = await Promise.all([
      admin.from('fichas_estudiantes_bitacora').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since15m),
      admin.from('fichas_estudiantes_bitacora').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).eq('status', 'accepted').gte('created_at', since1h),
      admin.from('fichas_estudiantes_bitacora').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 60_000).toISOString()),
    ]);
    if ((globalMinute || 0) >= 50) { await log('blocked', 'global_rate_limit'); return json({ message: 'El servicio tiene alta demanda. Inténtalo en unos minutos.' }, 429, corsOrigin); }
    if ((recentAttempts || 0) >= 5 || (recentSuccess || 0) >= 3) { await log('blocked', 'ip_rate_limit'); return json({ message: 'Se alcanzó el límite de envíos. Inténtalo más tarde.' }, 429, corsOrigin); }

    const body = await req.json();
    const payloadSize = JSON.stringify(body).length;
    if (payloadSize > 1_500_000) { await log('blocked', 'payload_too_large', payloadSize); return json({ message: 'La fotografía o la solicitud es demasiado grande.' }, 413, corsOrigin); }
    if (String(body.website || '').trim()) { await log('blocked', 'honeypot', payloadSize); return json({ message: 'Solicitud rechazada.' }, 400, corsOrigin); }

    const record = body.record || {};
    if (!record.nombre || !record.gradoGrupo || !record.foto || !String(record.foto).startsWith('data:image/jpeg;base64,')) throw new Error('Faltan datos obligatorios o la fotografía no es válida.');
    if (!validDate(record.fechaNacimiento) || !validDate(record.madre?.fechaNacimiento) || !validDate(record.padre?.fechaNacimiento)) throw new Error('Una fecha de nacimiento no tiene el formato DD-MM-YYYY.');
    if (!validCurp(record.curp) || !validCurp(record.madre?.curp) || !validCurp(record.padre?.curp)) throw new Error('Una CURP no tiene una estructura válida.');
    const phones = [record.telefono, record.madre?.telefonoTrabajo, record.madre?.celular, record.padre?.telefonoTrabajo, record.padre?.celular, ...(record.emergencias || []).map((item: any) => item.telefono)];
    if (phones.some((phone) => !validPhone(phone))) throw new Error('Uno de los teléfonos no tiene 10 dígitos.');

    const { data, error } = await admin.from('fichas_estudiantes').insert({ nombre: record.nombre, escuela: record.escuela, grado_grupo: record.gradoGrupo, foto: record.foto, datos: record }).select('*').single();
    if (error) throw error;
    await log('accepted', 'created', payloadSize, data.id);
    return json({ record: { ...data.datos, id: data.id, createdAt: data.created_at, nombre: data.nombre, escuela: data.escuela, gradoGrupo: data.grado_grupo, foto: data.foto } }, 201, corsOrigin);
  } catch (error) {
    await log('rejected', 'validation_or_server_error');
    return json({ message: error instanceof Error ? error.message : 'No se pudo procesar la ficha.' }, 400, corsOrigin);
  }
});
