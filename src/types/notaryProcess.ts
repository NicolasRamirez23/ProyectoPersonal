export type NotaryCaseStatus = 'borrador' | 'activo' | 'pausado' | 'concluido' | 'cancelado';
export type NotaryStageStatus = 'pendiente' | 'en_proceso' | 'completado' | 'detenido' | 'cancelado';

export interface NotaryClient {
  id: string; curp: string; nombres: string; apellidoPaterno: string; apellidoMaterno: string;
  rfc: string; email: string; telefono: string; domicilio: string; notas: string;
}
export interface NotaryStage {
  id: string; order: number; concept: string; description: string; status: NotaryStageStatus;
  deadline?: string; completedAt?: string; cost: number; responsible: string;
}
export interface NotaryPayment { id: string; date: string; amount: number; method: string; reference: string; notes: string; }
export interface NotaryPaymentOrder { id: string; folio: string; concept: string; amount: number; deadline?: string; status: 'pendiente' | 'pagada' | 'cancelada'; createdAt: string; }
export interface NotaryClientDocument { id: string; type: string; fileName: string; path: string; expiresAt?: string; createdAt: string; }
export interface NotaryCase {
  id: string; folio: string; title: string; operationType: string; description: string; status: NotaryCaseStatus;
  startDate: string; targetDate?: string; generalCost: number; discount: number; notes: string; createdAt: string;
  client: NotaryClient; stages: NotaryStage[]; payments: NotaryPayment[]; paymentOrders: NotaryPaymentOrder[]; documents: NotaryClientDocument[];
}
export interface NotaryStageDraft { concept: string; description: string; deadline: string; cost: number; responsible: string; }
