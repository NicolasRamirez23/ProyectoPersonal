export type ArchitecturalProjectStatus = 'cotizacion' | 'activo' | 'pausado' | 'terminado';
export type ArchitecturalChargeStatus = 'pendiente' | 'parcial' | 'pagado';

export interface ArchitecturalAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  storagePath?: string;
  createdAt: string;
}

export interface ArchitecturalSubconcept {
  id: string;
  name: string;
  scope: string;
  amount?: number;
}

export interface ArchitecturalPayment {
  id: string;
  amount: number;
  date: string;
  method: 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque' | 'otro';
  reference: string;
  notes: string;
  proof?: ArchitecturalAttachment;
}

export interface ArchitecturalTask {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
}

export interface ArchitecturalStage {
  id: string;
  name: string;
  responsible: string;
  startDate: string;
  dueDate: string;
  status: 'pendiente' | 'en_proceso' | 'completada';
  notes: string;
  tasks: ArchitecturalTask[];
}

export interface ArchitecturalExpense {
  id: string;
  category: 'honorarios' | 'impresiones' | 'traslados' | 'permisos' | 'materiales' | 'administrativo' | 'otro';
  concept: string;
  supplier: string;
  amount: number;
  date: string;
  status: 'pendiente' | 'pagado';
  paymentMethod: 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque' | 'otro';
  notes: string;
  proof?: ArchitecturalAttachment;
}

export interface ArchitecturalCharge {
  id: string;
  concept: string;
  description: string;
  amount: number;
  status: ArchitecturalChargeStatus;
  paymentDate?: string;
  attachments: ArchitecturalAttachment[];
  subconcepts: ArchitecturalSubconcept[];
  payments: ArchitecturalPayment[];
}

export interface ArchitecturalProject {
  id: string;
  clientName: string;
  clientPhone: string;
  clientUserId: string;
  quotationStatus: 'borrador' | 'enviada' | 'aprobada' | 'rechazada' | 'vencida';
  quotationRespondedAt?: string;
  quotationComment: string;
  projectName: string;
  constructionType: string;
  projectType: string;
  location: string;
  invoiceRequested: boolean;
  businessName: string;
  taxId: string;
  taxAddress: string;
  taxPostalCode: string;
  taxRegime: string;
  billingEmail: string;
  cfdiUse: string;
  status: ArchitecturalProjectStatus;
  notes: string;
  stages: ArchitecturalStage[];
  expenses: ArchitecturalExpense[];
  charges: ArchitecturalCharge[];
  createdAt: string;
  updatedAt: string;
}
