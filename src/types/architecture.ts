export type ArchitecturalProjectStatus = 'cotizacion' | 'activo' | 'pausado' | 'terminado';
export type ArchitecturalChargeStatus = 'pendiente' | 'pagado';

export interface ArchitecturalAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  storagePath?: string;
  createdAt: string;
}

export interface ArchitecturalCharge {
  id: string;
  concept: string;
  description: string;
  amount: number;
  status: ArchitecturalChargeStatus;
  paymentDate?: string;
  attachments: ArchitecturalAttachment[];
}

export interface ArchitecturalProject {
  id: string;
  clientName: string;
  clientPhone: string;
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
  charges: ArchitecturalCharge[];
  createdAt: string;
  updatedAt: string;
}
