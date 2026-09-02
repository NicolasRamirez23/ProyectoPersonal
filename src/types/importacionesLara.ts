export type LaraPaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'DEPÓSITO' | 'OTRO';
export type LaraPaymentStatus = 'EN PROCESO' | 'TERMINADO';

export interface LaraReceiptItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
}

export interface LaraReceipt {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  folio: string;
  metodoPago: LaraPaymentMethod;
  estadoPago: LaraPaymentStatus;
  conceptos: LaraReceiptItem[];
  total: number;
}
