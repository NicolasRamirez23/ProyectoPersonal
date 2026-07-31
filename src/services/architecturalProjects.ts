import { supabase } from './supabaseClient';
import { ArchitecturalAttachment, ArchitecturalCharge, ArchitecturalProject } from '../types/architecture';

const BUCKET = 'arquitectura';

interface DbAttachment {
  id: string;
  nombre_archivo: string;
  ruta_storage: string;
  tipo_mime: string;
  tamano: number;
  created_at: string;
}

interface DbCharge {
  id: string;
  concepto: string;
  descripcion: string | null;
  importe: number;
  estatus: ArchitecturalCharge['status'];
  fecha_pago: string | null;
  archivos_conceptos_arquitectonicos?: DbAttachment[];
}

interface DbProject {
  id: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  nombre_obra: string;
  tipo_construccion: string;
  tipo_proyecto: string;
  ubicacion: string | null;
  estatus: ArchitecturalProject['status'];
  notas: string | null;
  created_at: string;
  updated_at: string;
  conceptos_cobro_arquitectonicos?: DbCharge[];
}

async function mapProjects(rows: DbProject[]): Promise<ArchitecturalProject[]> {
  const paths = rows.flatMap((project) =>
    (project.conceptos_cobro_arquitectonicos || []).flatMap((charge) =>
      (charge.archivos_conceptos_arquitectonicos || []).map((file) => file.ruta_storage)));
  const signedUrls = new Map<string, string>();

  if (paths.length) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    if (error) throw error;
    data?.forEach((item, index) => {
      if (item.signedUrl) signedUrls.set(paths[index], item.signedUrl);
    });
  }

  return rows.map((project) => ({
    id: project.id,
    clientName: project.cliente_nombre,
    clientPhone: project.cliente_telefono || '',
    projectName: project.nombre_obra,
    constructionType: project.tipo_construccion,
    projectType: project.tipo_proyecto,
    location: project.ubicacion || '',
    status: project.estatus,
    notes: project.notas || '',
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    charges: (project.conceptos_cobro_arquitectonicos || []).map((charge) => ({
      id: charge.id,
      concept: charge.concepto,
      description: charge.descripcion || '',
      amount: Number(charge.importe),
      status: charge.estatus,
      paymentDate: charge.fecha_pago || undefined,
      attachments: (charge.archivos_conceptos_arquitectonicos || []).map((file): ArchitecturalAttachment => ({
        id: file.id,
        name: file.nombre_archivo,
        type: file.tipo_mime,
        size: Number(file.tamano),
        storagePath: file.ruta_storage,
        dataUrl: signedUrls.get(file.ruta_storage),
        createdAt: file.created_at,
      })),
    })),
  }));
}

async function queryProjects(id?: string) {
  let query = supabase
    .from('proyectos_arquitectonicos')
    .select(`
      *,
      conceptos_cobro_arquitectonicos (
        *,
        archivos_conceptos_arquitectonicos (*)
      )
    `)
    .order('updated_at', { ascending: false });
  if (id) query = query.eq('id', id);
  const { data, error } = await query;
  if (error) throw error;
  return mapProjects((data || []) as DbProject[]);
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, encoded] = dataUrl.split(',');
  const mime = metadata.match(/data:(.*?);base64/)?.[1] || 'application/octet-stream';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function safeName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function removeStorageFiles(paths: string[]) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
}

export const architecturalProjectsService = {
  async getAll() {
    return queryProjects();
  },

  async getById(id: string) {
    const projects = await queryProjects(id);
    return projects[0];
  },

  async save(project: Omit<ArchitecturalProject, 'id' | 'createdAt' | 'updatedAt'>, id?: string) {
    const projectRow = {
      cliente_nombre: project.clientName,
      cliente_telefono: project.clientPhone || null,
      nombre_obra: project.projectName,
      tipo_construccion: project.constructionType,
      tipo_proyecto: project.projectType,
      ubicacion: project.location || null,
      estatus: project.status,
      notas: project.notes || null,
    };
    const projectQuery = id
      ? supabase.from('proyectos_arquitectonicos').update(projectRow).eq('id', id).select('id').single()
      : supabase.from('proyectos_arquitectonicos').insert(projectRow).select('id').single();
    const { data: savedProject, error: projectError } = await projectQuery;
    if (projectError) throw projectError;
    const projectId = savedProject.id as string;

    const { data: oldCharges, error: oldError } = await supabase
      .from('conceptos_cobro_arquitectonicos')
      .select('id, archivos_conceptos_arquitectonicos(id, ruta_storage)')
      .eq('proyecto_id', projectId);
    if (oldError) throw oldError;

    const submittedChargeIds = new Set(project.charges.map((charge) => charge.id));
    const removedCharges = (oldCharges || []).filter((charge) => !submittedChargeIds.has(charge.id));
    const removedChargePaths = removedCharges.flatMap((charge) =>
      (charge.archivos_conceptos_arquitectonicos || []).map((file: { ruta_storage: string }) => file.ruta_storage));
    await removeStorageFiles(removedChargePaths);
    if (removedCharges.length) {
      const { error } = await supabase.from('conceptos_cobro_arquitectonicos').delete().in('id', removedCharges.map((charge) => charge.id));
      if (error) throw error;
    }

    for (const charge of project.charges) {
      const { error: chargeError } = await supabase.from('conceptos_cobro_arquitectonicos').upsert({
        id: charge.id,
        proyecto_id: projectId,
        concepto: charge.concept,
        descripcion: charge.description || null,
        importe: charge.amount,
        estatus: charge.status,
        fecha_pago: charge.status === 'pagado' ? charge.paymentDate || new Date().toISOString().slice(0, 10) : null,
      });
      if (chargeError) throw chargeError;

      const oldCharge = (oldCharges || []).find((item) => item.id === charge.id);
      const submittedAttachmentIds = new Set(charge.attachments.map((attachment) => attachment.id));
      const removedFiles = (oldCharge?.archivos_conceptos_arquitectonicos || [])
        .filter((file: { id: string }) => !submittedAttachmentIds.has(file.id));
      await removeStorageFiles(removedFiles.map((file: { ruta_storage: string }) => file.ruta_storage));
      if (removedFiles.length) {
        const { error } = await supabase.from('archivos_conceptos_arquitectonicos').delete().in('id', removedFiles.map((file: { id: string }) => file.id));
        if (error) throw error;
      }

      for (const attachment of charge.attachments.filter((file) => !file.storagePath && file.dataUrl)) {
        const path = `${projectId}/${charge.id}/${attachment.id}-${safeName(attachment.name)}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, dataUrlToBlob(attachment.dataUrl!), {
          contentType: attachment.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const { error: fileError } = await supabase.from('archivos_conceptos_arquitectonicos').insert({
          id: attachment.id,
          concepto_id: charge.id,
          nombre_archivo: attachment.name,
          ruta_storage: path,
          tipo_mime: attachment.type,
          tamano: attachment.size,
        });
        if (fileError) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw fileError;
        }
      }
    }
    return this.getById(projectId);
  },

  async remove(id: string) {
    const project = await this.getById(id);
    const paths = project?.charges.flatMap((charge) => charge.attachments.map((file) => file.storagePath).filter(Boolean) as string[]) || [];
    await removeStorageFiles(paths);
    const { error } = await supabase.from('proyectos_arquitectonicos').delete().eq('id', id);
    if (error) throw error;
  },
};
