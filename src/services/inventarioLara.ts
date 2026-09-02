import { supabase } from './supabaseClient';
import type { LaraInventoryMovement, LaraInventoryProduct } from '../types/inventarioLara';

const mapProduct = (row: any): LaraInventoryProduct => ({ id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, sku: row.sku, nombre: row.nombre, categoria: row.categoria || '', existencia: Number(row.existencia), stockMinimo: Number(row.stock_minimo), costo: Number(row.costo), precioVenta: Number(row.precio_venta), notas: row.notas || '', activo: row.activo });
const productPayload = (product: LaraInventoryProduct) => ({ sku: product.sku.trim().toUpperCase(), nombre: product.nombre.trim().toUpperCase(), categoria: product.categoria.trim().toUpperCase(), existencia: product.existencia, stock_minimo: product.stockMinimo, costo: product.costo, precio_venta: product.precioVenta, notas: product.notas.trim().toUpperCase(), activo: product.activo });

export const inventarioLaraApi = {
  async listProducts() {
    const { data, error } = await supabase.from('productos_importaciones_lara').select('*').order('nombre');
    if (error) throw new Error(error.message);
    return (data || []).map(mapProduct);
  },
  async createProduct(product: LaraInventoryProduct) {
    const { data, error } = await supabase.from('productos_importaciones_lara').insert(productPayload(product)).select('*').single();
    if (error) throw new Error(error.message);
    return mapProduct(data);
  },
  async updateProduct(product: LaraInventoryProduct) {
    const { existencia: _existencia, ...changes } = productPayload(product);
    const { data, error } = await supabase.from('productos_importaciones_lara').update(changes).eq('id', product.id!).select('*').single();
    if (error) throw new Error(error.message);
    return mapProduct(data);
  },
  async adjustStock(productId: string, type: 'ENTRADA' | 'SALIDA', quantity: number, reason: string) {
    const { error } = await supabase.rpc('registrar_movimiento_inventario_lara', { p_producto_id: productId, p_tipo: type, p_cantidad: quantity, p_motivo: reason.trim().toUpperCase() });
    if (error) throw new Error(error.message);
  },
  async listMovements() {
    const { data, error } = await supabase.from('movimientos_inventario_lara').select('*, producto:productos_importaciones_lara(nombre, sku)').order('created_at', { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    return (data || []).map((row: any): LaraInventoryMovement => ({ id: row.id, createdAt: row.created_at, productoId: row.producto_id, tipo: row.tipo, cantidad: Number(row.cantidad), existenciaAnterior: Number(row.existencia_anterior), existenciaNueva: Number(row.existencia_nueva), motivo: row.motivo, producto: row.producto }));
  },
};
