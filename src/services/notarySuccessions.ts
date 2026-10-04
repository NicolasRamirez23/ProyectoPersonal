import { supabase } from './supabaseClient';
import { notaryProcessesApi } from './notaryProcesses';
import type { NotarySuccession, SuccessionPerson, SuccessionRoute } from '../types/notaryProcess';

const requirementsByRoute = {
  intestamentaria: [
    ['ACTA_DEFUNCION', 'Acta certificada de defunción'], ['ACTA_MATRIMONIO', 'Acta certificada de matrimonio, cuando corresponda'],
    ['ACTAS_NACIMIENTO', 'Actas certificadas de nacimiento de los hijos'], ['DOS_TESTIGOS', 'Datos e identificación de dos testigos'],
  ],
  testamentaria: [
    ['ACTA_DEFUNCION', 'Acta certificada de defunción'], ['TESTAMENTO', 'Testamento'],
    ['IDENTIFICACION', 'Identificación oficial'], ['CSF', 'Constancia de situación fiscal con vigencia máxima de tres meses'],
  ],
} as const;

const mapClient = (row: any) => ({ id: row.id, curp: row.curp, nombres: row.nombres, apellidoPaterno: row.apellido_paterno || '', apellidoMaterno: row.apellido_materno || '', rfc: row.rfc || '', email: row.email || '', telefono: row.telefono || '', domicilio: row.domicilio || '', notas: row.notas || '', birthPlace: row.lugar_nacimiento || '', birthDate: row.fecha_nacimiento || '', nationality: row.nacionalidad || '', maritalStatus: row.estado_civil || '', occupation: row.ocupacion || '' });

export const notarySuccessionsApi = {
  async list() {
    const { data, error } = await supabase.from('notaria_sucesiones').select('id, via, estatus, autor_nombre, expediente_id, notaria_expedientes(id, folio, titulo, created_at, notaria_clientes(nombres, apellido_paterno, apellido_materno))').order('created_at', { ascending: false });
    if (error) throw new Error(error.message); return data || [];
  },
  async create(input: { route: SuccessionRoute; title: string; startDate: string; targetDate: string; generalCost: number; deceased: NotarySuccession['deceased']; will: NotarySuccession['will']; people: SuccessionPerson[] }) {
    const savedPeople = await Promise.all(input.people.map(async (person) => ({ ...person, saved: await notaryProcessesApi.saveClient(person.client) })));
    const principal = savedPeople.find((person) => person.principal)?.saved || savedPeople[0]?.saved;
    if (!principal) throw new Error('Agrega al menos un solicitante o heredero.');
    const stages = input.route === 'testamentaria' ? [
      'Integración y validación de documentos', 'Solicitud de búsquedas testamentarias', 'Recepción de ambas respuestas', 'Proyecto de aceptación de herencia y radicación', 'Firma y autorización', 'Publicaciones legales', 'Inventario, avalúo y adjudicación',
    ] : ['Integración y validación de documentos', 'Solicitud de búsquedas testamentarias', 'Recepción de ambas respuestas', 'Audiencia testimonial', 'Declaración de herederos y designación de albacea', 'Publicaciones legales', 'Inventario, avalúo y adjudicación'];
    const createdCase = await notaryProcessesApi.createCase({ clientId: principal.id, title: input.title, operationType: input.route === 'testamentaria' ? 'Sucesión testamentaria' : 'Sucesión intestamentaria', description: `Sucesión a bienes de ${input.deceased.name}.`, startDate: input.startDate, targetDate: input.targetDate, generalCost: input.generalCost, discount: 0, notes: '', stages: stages.map((concept) => ({ concept, description: '', deadline: '', cost: 0, responsible: '' })) });
    const { data: succession, error } = await supabase.from('notaria_sucesiones').insert({ expediente_id: createdCase.id, via: input.route, autor_nombre: input.deceased.name.trim().toUpperCase(), autor_genero: input.deceased.gender, autor_fecha_nacimiento: input.deceased.birthDate || null, autor_lugar_nacimiento: input.deceased.birthPlace, autor_nacionalidad: input.deceased.nationality, autor_estado_civil: input.deceased.maritalStatus, autor_ocupacion: input.deceased.occupation, autor_curp: input.deceased.curp, autor_rfc: input.deceased.rfc, autor_domicilio: input.deceased.address, fecha_defuncion: input.deceased.deathDate, lugar_defuncion: input.deceased.deathPlace, acta_defuncion: input.deceased.deathCertificate, testamento_instrumento: input.will.instrument, testamento_volumen: input.will.volume, testamento_fecha: input.will.date || null, testamento_notario: input.will.notary, testamento_notaria: input.will.notaryNumber, testamento_lugar: input.will.place, disposicion_principal: input.will.mainDisposition }).select('*').single();
    if (error) { await supabase.from('notaria_expedientes').delete().eq('id', createdCase.id); throw new Error(error.message); }
    const peoplePayload = savedPeople.map((person) => ({ sucesion_id: succession.id, cliente_id: person.saved.id, rol: person.role, parentesco: person.relationship, es_principal: person.principal }));
    const requirementPayload = requirementsByRoute[input.route].map(([code, name]) => ({ sucesion_id: succession.id, codigo: code, nombre: name }));
    const [peopleResult, requirementsResult, searchesResult] = await Promise.all([
      supabase.from('notaria_sucesion_comparecientes').insert(peoplePayload), supabase.from('notaria_sucesion_requisitos').insert(requirementPayload),
      supabase.from('notaria_sucesion_busquedas').insert([{ sucesion_id: succession.id, autoridad: 'registro_publico' }, { sucesion_id: succession.id, autoridad: 'archivo_notarias' }]),
    ]);
    const relatedError = peopleResult.error || requirementsResult.error || searchesResult.error; if (relatedError) throw new Error(relatedError.message);
    return { id: succession.id, caseId: createdCase.id };
  },
  async get(id: string): Promise<NotarySuccession> {
    const { data: row, error } = await supabase.from('notaria_sucesiones').select('*').eq('id', id).single(); if (error) throw new Error(error.message);
    const [caseData, peopleResult, requirementsResult, searchesResult] = await Promise.all([
      notaryProcessesApi.getCase(row.expediente_id),
      supabase.from('notaria_sucesion_comparecientes').select('*, notaria_clientes(*)').eq('sucesion_id', id).order('created_at'),
      supabase.from('notaria_sucesion_requisitos').select('*').eq('sucesion_id', id).order('created_at'),
      supabase.from('notaria_sucesion_busquedas').select('*').eq('sucesion_id', id).order('autoridad'),
    ]);
    const relatedError = peopleResult.error || requirementsResult.error || searchesResult.error; if (relatedError) throw new Error(relatedError.message);
    return { id: row.id, caseId: row.expediente_id, route: row.via, status: row.estatus, case: caseData,
      deceased: { name: row.autor_nombre, gender: row.autor_genero, birthDate: row.autor_fecha_nacimiento || '', birthPlace: row.autor_lugar_nacimiento, nationality: row.autor_nacionalidad, maritalStatus: row.autor_estado_civil, occupation: row.autor_ocupacion, curp: row.autor_curp, rfc: row.autor_rfc, address: row.autor_domicilio, deathDate: row.fecha_defuncion, deathPlace: row.lugar_defuncion, deathCertificate: row.acta_defuncion },
      will: { instrument: row.testamento_instrumento, volume: row.testamento_volumen, date: row.testamento_fecha || '', notary: row.testamento_notario, notaryNumber: row.testamento_notaria, place: row.testamento_lugar, mainDisposition: row.disposicion_principal },
      people: (peopleResult.data || []).map((item: any) => ({ client: mapClient(item.notaria_clientes), role: item.rol, relationship: item.parentesco, principal: item.es_principal })),
      requirements: (requirementsResult.data || []).map((item: any) => ({ id: item.id, code: item.codigo, name: item.nombre, required: item.obligatorio, status: item.estatus, fileName: item.nombre_archivo || undefined, path: item.ruta || undefined, expiresAt: item.vence_el || undefined, notes: item.notas || '' })),
      searches: (searchesResult.data || []).map((item: any) => ({ id: item.id, authority: item.autoridad, status: item.estatus, requestDate: item.fecha_solicitud || undefined, requestFolio: item.folio_solicitud || '', responseDate: item.fecha_respuesta || undefined, responseFolio: item.folio_respuesta || '', result: item.resultado || '', notes: item.notas || '' })),
    };
  },
  async updateRequirement(id: string, status: string, file?: File, expiresAt?: string) {
    let patch: any = { estatus: status, vence_el: expiresAt || null }; if (file) { const path = `sucesiones/${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, '-')}`; const upload = await supabase.storage.from('expedientes-notaria').upload(path, file, { contentType: file.type }); if (upload.error) throw new Error(upload.error.message); patch = { ...patch, ruta: path, nombre_archivo: file.name, estatus: 'recibido' }; }
    const { error } = await supabase.from('notaria_sucesion_requisitos').update(patch).eq('id', id); if (error) throw new Error(error.message);
  },
  async updateSearch(id: string, input: { status: string; requestDate: string; requestFolio: string; responseDate: string; responseFolio: string; result: string }) {
    const { error } = await supabase.from('notaria_sucesion_busquedas').update({ estatus: input.status, fecha_solicitud: input.requestDate || null, folio_solicitud: input.requestFolio, fecha_respuesta: input.responseDate || null, folio_respuesta: input.responseFolio, resultado: input.result }).eq('id', id); if (error) throw new Error(error.message);
  },
};
