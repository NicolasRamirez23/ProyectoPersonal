import { supabase } from './supabaseClient';
import { ArchitecturalAttachment, ArchitecturalCharge, ArchitecturalExpense, ArchitecturalPayment, ArchitecturalProject, ArchitecturalStage, ArchitecturalSubconcept } from '../types/architecture';

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
  subconceptos: ArchitecturalSubconcept[] | null;
  archivos_conceptos_arquitectonicos?: DbAttachment[];
  pagos_conceptos_arquitectonicos?: DbPayment[];
}

interface DbPayment {
  id: string;
  importe: number;
  fecha: string;
  metodo: ArchitecturalPayment['method'];
  referencia: string | null;
  notas: string | null;
  etapas: ArchitecturalStage[] | null;
  comprobante_nombre: string | null;
  comprobante_ruta: string | null;
  comprobante_tipo: string | null;
  comprobante_tamano: number | null;
  created_at: string;
}

interface DbExpense {
  id: string; categoria: ArchitecturalExpense['category']; concepto: string; proveedor: string | null;
  importe: number; fecha: string; estatus: ArchitecturalExpense['status'];
  metodo_pago: ArchitecturalExpense['paymentMethod']; notas: string | null;
  comprobante_nombre: string | null; comprobante_ruta: string | null; comprobante_tipo: string | null;
  comprobante_tamano: number | null; created_at: string;
}

interface DbProject {
  id: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_usuario_id: string | null;
  estado_cotizacion: ArchitecturalProject['quotationStatus'];
  cotizacion_respondida_at: string | null;
  cotizacion_comentario: string | null;
  nombre_obra: string;
  tipo_construccion: string;
  tipo_proyecto: string;
  ubicacion: string | null;
  requiere_factura: boolean | null;
  razon_social: string | null;
  rfc: string | null;
  domicilio_fiscal: string | null;
  codigo_postal_fiscal: string | null;
  regimen_fiscal: string | null;
  correo_facturacion: string | null;
  uso_cfdi: string | null;
  estatus: ArchitecturalProject['status'];
  notas: string | null;
  created_at: string;
  updated_at: string;
  conceptos_cobro_arquitectonicos?: DbCharge[];
  gastos_proyectos_arquitectonicos?: DbExpense[];
}

async function mapProjects(rows: DbProject[]): Promise<ArchitecturalProject[]> {
  const paths = rows.flatMap((project) =>
    [...(project.gastos_proyectos_arquitectonicos || []).map((expense) => expense.comprobante_ruta).filter(Boolean) as string[],
    ...(project.conceptos_cobro_arquitectonicos || []).flatMap((charge) =>
      [
        ...(charge.archivos_conceptos_arquitectonicos || []).map((file) => file.ruta_storage),
        ...(charge.pagos_conceptos_arquitectonicos || []).map((payment) => payment.comprobante_ruta).filter(Boolean) as string[],
      ])]);
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
    clientUserId: project.cliente_usuario_id || '',
    quotationStatus: project.estado_cotizacion || 'borrador',
    quotationRespondedAt: project.cotizacion_respondida_at || undefined,
    quotationComment: project.cotizacion_comentario || '',
    projectName: project.nombre_obra,
    constructionType: project.tipo_construccion,
    projectType: project.tipo_proyecto,
    location: project.ubicacion || '',
    invoiceRequested: Boolean(project.requiere_factura),
    businessName: project.razon_social || '',
    taxId: project.rfc || '',
    taxAddress: project.domicilio_fiscal || '',
    taxPostalCode: project.codigo_postal_fiscal || '',
    taxRegime: project.regimen_fiscal || '',
    billingEmail: project.correo_facturacion || '',
    cfdiUse: project.uso_cfdi || '',
    status: project.estatus,
    notes: project.notas || '',
    stages: Array.isArray(project.etapas) ? project.etapas : [],
    expenses: (project.gastos_proyectos_arquitectonicos || []).map((expense): ArchitecturalExpense => ({
      id: expense.id, category: expense.categoria, concept: expense.concepto, supplier: expense.proveedor || '',
      amount: Number(expense.importe), date: expense.fecha, status: expense.estatus,
      paymentMethod: expense.metodo_pago, notes: expense.notas || '',
      proof: expense.comprobante_ruta ? {
        id: `expense-${expense.id}`, name: expense.comprobante_nombre || 'comprobante',
        type: expense.comprobante_tipo || 'application/octet-stream', size: Number(expense.comprobante_tamano || 0),
        storagePath: expense.comprobante_ruta, dataUrl: signedUrls.get(expense.comprobante_ruta), createdAt: expense.created_at,
      } : undefined,
    })),
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    charges: (project.conceptos_cobro_arquitectonicos || []).map((charge) => ({
      id: charge.id,
      concept: charge.concepto,
      description: charge.descripcion || '',
      amount: Number(charge.importe),
      status: charge.estatus,
      paymentDate: charge.fecha_pago || undefined,
      subconcepts: Array.isArray(charge.subconceptos) ? charge.subconceptos : [],
      payments: (charge.pagos_conceptos_arquitectonicos || []).map((payment): ArchitecturalPayment => ({
        id: payment.id,
        amount: Number(payment.importe),
        date: payment.fecha,
        method: payment.metodo,
        reference: payment.referencia || '',
        notes: payment.notas || '',
        proof: payment.comprobante_ruta ? {
          id: `proof-${payment.id}`,
          name: payment.comprobante_nombre || 'comprobante',
          type: payment.comprobante_tipo || 'application/octet-stream',
          size: Number(payment.comprobante_tamano || 0),
          storagePath: payment.comprobante_ruta,
          dataUrl: signedUrls.get(payment.comprobante_ruta),
          createdAt: payment.created_at,
        } : undefined,
      })),
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
      gastos_proyectos_arquitectonicos (*),
      conceptos_cobro_arquitectonicos (
        *,
        archivos_conceptos_arquitectonicos (*),
        pagos_conceptos_arquitectonicos (*)
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

  async assignClient(projectId: string, clientUserId: string) {
    const { data, error } = await supabase
      .from('proyectos_arquitectonicos')
      .update({ cliente_usuario_id: clientUserId })
      .eq('id', projectId)
      .is('cliente_usuario_id', null)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (data) return;

    const { data: current, error: currentError } = await supabase
      .from('proyectos_arquitectonicos')
      .select('cliente_usuario_id')
      .eq('id', projectId)
      .single();
    if (currentError) throw currentError;
    if (current.cliente_usuario_id !== clientUserId) {
      throw new Error('Este proyecto ya tiene otro cliente asignado.');
    }
  },

  async save(project: Omit<ArchitecturalProject, 'id' | 'createdAt' | 'updatedAt'>, id?: string) {
    const projectRow = {
      cliente_nombre: project.clientName,
      cliente_telefono: project.clientPhone || null,
      cliente_usuario_id: project.clientUserId || null,
      estado_cotizacion: project.quotationStatus,
      cotizacion_respondida_at: project.quotationRespondedAt || null,
      cotizacion_comentario: project.quotationComment || null,
      nombre_obra: project.projectName,
      tipo_construccion: project.constructionType,
      tipo_proyecto: project.projectType,
      ubicacion: project.location || null,
      requiere_factura: project.invoiceRequested,
      razon_social: project.businessName || null,
      rfc: project.taxId || null,
      domicilio_fiscal: project.taxAddress || null,
      codigo_postal_fiscal: project.taxPostalCode || null,
      regimen_fiscal: project.taxRegime || null,
      correo_facturacion: project.billingEmail || null,
      uso_cfdi: project.cfdiUse || null,
      estatus: project.status,
      notas: project.notes || null,
      etapas: project.stages,
    };
    const projectQuery = id
      ? supabase.from('proyectos_arquitectonicos').update(projectRow).eq('id', id).select('id').single()
      : supabase.from('proyectos_arquitectonicos').insert(projectRow).select('id').single();
    const { data: savedProject, error: projectError } = await projectQuery;
    if (projectError) throw projectError;
    const projectId = savedProject.id as string;

    const { data: oldExpenses, error: oldExpensesError } = await supabase
      .from('gastos_proyectos_arquitectonicos').select('*').eq('proyecto_id', projectId);
    if (oldExpensesError) throw oldExpensesError;
    const submittedExpenseIds = new Set(project.expenses.map((expense) => expense.id));
    const removedExpenses = (oldExpenses || []).filter((expense) => !submittedExpenseIds.has(expense.id));
    await removeStorageFiles(removedExpenses.map((expense) => expense.comprobante_ruta).filter(Boolean));
    if (removedExpenses.length) {
      const { error } = await supabase.from('gastos_proyectos_arquitectonicos').delete()
        .in('id', removedExpenses.map((expense) => expense.id));
      if (error) throw error;
    }
    for (const expense of project.expenses) {
      let proofPath = expense.proof?.storagePath || null;
      if (expense.proof?.dataUrl && !expense.proof.storagePath) {
        proofPath = `${projectId}/gastos/${expense.id}-${safeName(expense.proof.name)}`;
        const { error } = await supabase.storage.from(BUCKET).upload(proofPath, dataUrlToBlob(expense.proof.dataUrl), {
          contentType: expense.proof.type, upsert: false,
        });
        if (error) throw error;
      }
      const previousPath = (oldExpenses || []).find((oldExpense) => oldExpense.id === expense.id)?.comprobante_ruta;
      if (previousPath && previousPath !== proofPath) await removeStorageFiles([previousPath]);
      const { error } = await supabase.from('gastos_proyectos_arquitectonicos').upsert({
        id: expense.id, proyecto_id: projectId, categoria: expense.category, concepto: expense.concept,
        proveedor: expense.supplier || null, importe: expense.amount, fecha: expense.date,
        estatus: expense.status, metodo_pago: expense.paymentMethod, notas: expense.notes || null,
        comprobante_nombre: expense.proof?.name || null, comprobante_ruta: proofPath,
        comprobante_tipo: expense.proof?.type || null, comprobante_tamano: expense.proof?.size || null,
      });
      if (error) throw error;
    }

    const { data: oldCharges, error: oldError } = await supabase
      .from('conceptos_cobro_arquitectonicos')
      .select('id, archivos_conceptos_arquitectonicos(id, ruta_storage), pagos_conceptos_arquitectonicos(id, comprobante_ruta)')
      .eq('proyecto_id', projectId);
    if (oldError) throw oldError;

    const submittedChargeIds = new Set(project.charges.map((charge) => charge.id));
    const removedCharges = (oldCharges || []).filter((charge) => !submittedChargeIds.has(charge.id));
    const removedChargePaths = removedCharges.flatMap((charge) =>
      [
        ...(charge.archivos_conceptos_arquitectonicos || []).map((file: { ruta_storage: string }) => file.ruta_storage),
        ...(charge.pagos_conceptos_arquitectonicos || []).map((payment: { comprobante_ruta: string | null }) => payment.comprobante_ruta).filter(Boolean),
      ] as string[]);
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
        subconceptos: charge.subconcepts,
      });
      if (chargeError) throw chargeError;

      const { data: oldPayments, error: oldPaymentsError } = await supabase
        .from('pagos_conceptos_arquitectonicos')
        .select('*')
        .eq('concepto_id', charge.id);
      if (oldPaymentsError) throw oldPaymentsError;
      const submittedPaymentIds = new Set(charge.payments.map((payment) => payment.id));
      const removedPayments = (oldPayments || []).filter((payment) => !submittedPaymentIds.has(payment.id));
      await removeStorageFiles(removedPayments.map((payment) => payment.comprobante_ruta).filter(Boolean));
      if (removedPayments.length) {
        const { error } = await supabase.from('pagos_conceptos_arquitectonicos')
          .delete().in('id', removedPayments.map((payment) => payment.id));
        if (error) throw error;
      }

      for (const payment of charge.payments) {
        let proofPath = payment.proof?.storagePath || null;
        if (payment.proof?.dataUrl && !payment.proof.storagePath) {
          proofPath = `${projectId}/${charge.id}/pagos/${payment.id}-${safeName(payment.proof.name)}`;
          const { error: uploadError } = await supabase.storage.from(BUCKET)
            .upload(proofPath, dataUrlToBlob(payment.proof.dataUrl), {
              contentType: payment.proof.type,
              upsert: false,
            });
          if (uploadError) throw uploadError;
        }
        const previousProofPath = (oldPayments || [])
          .find((oldPayment) => oldPayment.id === payment.id)?.comprobante_ruta;
        if (previousProofPath && previousProofPath !== proofPath) {
          await removeStorageFiles([previousProofPath]);
        }
        const { error: paymentError } = await supabase.from('pagos_conceptos_arquitectonicos').upsert({
          id: payment.id,
          concepto_id: charge.id,
          importe: payment.amount,
          fecha: payment.date,
          metodo: payment.method,
          referencia: payment.reference || null,
          notas: payment.notes || null,
          comprobante_nombre: payment.proof?.name || null,
          comprobante_ruta: proofPath,
          comprobante_tipo: payment.proof?.type || null,
          comprobante_tamano: payment.proof?.size || null,
        });
        if (paymentError) throw paymentError;
      }

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
    const paths = project?.charges.flatMap((charge) => [
      ...charge.attachments.map((file) => file.storagePath).filter(Boolean),
      ...charge.payments.map((payment) => payment.proof?.storagePath).filter(Boolean),
    ] as string[]) || [];
    paths.push(...(project?.expenses.map((expense) => expense.proof?.storagePath).filter(Boolean) as string[] || []));
    await removeStorageFiles(paths);
    const { error } = await supabase.from('proyectos_arquitectonicos').delete().eq('id', id);
    if (error) throw error;
  },

  async respondToQuotation(projectId: string, response: 'aprobada' | 'rechazada', comment: string) {
    const { error } = await supabase.rpc('responder_cotizacion', {
      p_proyecto_id: projectId,
      p_respuesta: response,
      p_comentario: comment || null,
    });
    if (error) throw error;
  },
};
