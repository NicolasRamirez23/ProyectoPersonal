export type IsabiData = Record<string, string | boolean>;

export interface IsabiDocumentDraft {
  block: string;
  expectedType: string;
  file: File;
  extractedData: Record<string, unknown>;
  confidence: number;
  warnings: string[];
}

export interface IsabiRecord {
  id?: string;
  folioInterno?: string;
  status: 'BORRADOR' | 'LISTO' | 'PRESENTADO';
  data: IsabiData;
  createdAt?: string;
  updatedAt?: string;
}
