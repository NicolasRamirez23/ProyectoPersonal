export interface LaraInventoryProduct {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  sku: string;
  nombre: string;
  categoria: string;
  existencia: number;
  stockMinimo: number;
  costo: number;
  precioVenta: number;
  notas: string;
  activo: boolean;
}

export interface LaraInventoryMovement {
  id: string;
  createdAt: string;
  productoId: string;
  tipo: 'ENTRADA' | 'SALIDA';
  cantidad: number;
  existenciaAnterior: number;
  existenciaNueva: number;
  motivo: string;
  producto?: { nombre: string; sku: string } | null;
}
