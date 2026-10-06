export type NotaryCaseStatus = 'borrador' | 'activo' | 'pausado' | 'concluido' | 'cancelado';
export type NotaryStageStatus = 'pendiente' | 'en_proceso' | 'completado' | 'detenido' | 'cancelado';

export interface NotaryClient {
  id: string; curp: string; nombres: string; apellidoPaterno: string; apellidoMaterno: string;
  rfc: string; email: string; telefono: string; domicilio: string; notas: string;
  birthPlace?: string; birthDate?: string; nationality?: string; maritalStatus?: string; occupation?: string;
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

export type NotaryDocumentStatus = 'pendiente' | 'procesando' | 'por_revisar' | 'confirmado' | 'rechazado' | 'error';
export interface NotaryExtractedData { nombre?: string; curp?: string; rfc?: string; domicilio?: string; fechaNacimiento?: string; claveElector?: string; numeroDocumento?: string; [key: string]: string | undefined; }
export interface NotaryInboxDocument {
  id: string; createdAt: string; caseId: string; caseFolio: string; caseTitle: string; clientId?: string;
  fileName: string; path: string; mimeType: string; size: number; hash: string; detectedType: string;
  confirmedType: string; detectedRole: string; confirmedRole: string; status: NotaryDocumentStatus;
  confidence: number; extractedData: NotaryExtractedData; extractedText: string; notes: string;
  analyzedWithAi?: boolean; aiProvider?: string; aiModel?: string; aiAnalyzedAt?: string;
}

export type SuccessionRoute = 'testamentaria' | 'intestamentaria';
export interface SuccessionPerson { client: Omit<NotaryClient, 'id'> & { id?: string }; role: 'solicitante' | 'heredero' | 'albacea' | 'testigo' | 'otro'; relationship: string; principal: boolean; }
export interface SuccessionRequirement { id: string; code: string; name: string; required: boolean; status: 'pendiente' | 'recibido' | 'validado' | 'rechazado' | 'no_aplica'; fileName?: string; path?: string; expiresAt?: string; notes: string; }
export interface SuccessionSearch { id: string; authority: 'registro_publico' | 'archivo_notarias'; status: 'pendiente' | 'enviada' | 'respondida'; requestDate?: string; requestFolio: string; responseDate?: string; responseFolio: string; result: string; notes: string; }
export interface NotarySuccession {
  id: string; caseId: string; route: SuccessionRoute; status: string; case: NotaryCase;
  deceased: { name: string; gender: 'M' | 'F'; birthDate: string; birthPlace: string; nationality: string; maritalStatus: string; occupation: string; curp: string; rfc: string; address: string; deathDate: string; deathPlace: string; deathCertificate: string; };
  will: { instrument: string; volume: string; date: string; notary: string; notaryNumber: string; place: string; mainDisposition: string; };
  people: SuccessionPerson[]; requirements: SuccessionRequirement[]; searches: SuccessionSearch[];
}
