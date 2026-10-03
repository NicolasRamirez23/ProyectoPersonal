import { supabase } from './supabaseClient';
import type { LaraInventoryMovement, LaraInventoryProduct } from '../types/inventarioLara';

const BUCKET = 'inventario-lara';
const mapProduct = (row: any, imagenUrl?: string): LaraInventoryProduct => ({ id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, sku: row.sku, nombre: row.nombre, categoria: row.categoria || '', existencia: Number(row.existencia), stockMinimo: Number(row.stock_minimo), costo: Number(row.costo), precioVenta: Number(row.precio_venta), notas: row.notas || '', activo: row.activo, imagenRuta: row.imagen_ruta || undefined, imagenUrl });
const productPayload = (product: LaraInventoryProduct) => ({ sku: product.sku.trim().toUpperCase(), nombre: product.nombre.trim().toUpperCase(), categoria: product.categoria.trim().toUpperCase(), existencia: product.existencia, stock_minimo: product.stockMinimo, costo: product.costo, precio_venta: product.precioVenta, notas: product.notas.trim().toUpperCase(), activo: product.activo });

async function uploadProductImage(productId: string, image: File) {
  const extension = image.name.split('.').pop()?.toLowerCase() || image.type.split('/')[1] || 'jpg';
  const path = `${productId}/producto-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, image, { contentType: image.type, upsert: false });
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);
  return path;
}

async function saveImage(product: LaraInventoryProduct, image?: File) {
  if (!image || !product.id) return product;
  const oldPath = product.imagenRuta;
  const imagenRuta = await uploadProductImage(product.id, image);
  const { data, error } = await supabase.from('productos_importaciones_lara').update({ imagen_ruta: imagenRuta }).eq('id', product.id).select('*').single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([imagenRuta]);
    throw new Error(error.message);
  }
  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
  return mapProduct(data);
}

export const inventarioLaraApi = {
  async listProducts() {
    const { data, error } = await supabase.from('productos_importaciones_lara').select('*').order('nombre');
    if (error) throw new Error(error.message);
    const rows = data || [];
    const paths = rows.map((row: any) => row.imagen_ruta).filter(Boolean);
    const signedUrls = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      urls?.forEach((item) => { if (item.signedUrl) signedUrls.set(item.path, item.signedUrl); });
    }
    return rows.map((row: any) => mapProduct(row, signedUrls.get(row.imagen_ruta)));
  },
  async createProduct(product: LaraInventoryProduct, image?: File) {
    const { data, error } = await supabase.from('productos_importaciones_lara').insert(productPayload(product)).select('*').single();
    if (error) throw new Error(error.message);
    return saveImage(mapProduct(data), image);
  },
  async updateProduct(product: LaraInventoryProduct, image?: File) {
    const { existencia: _existencia, ...changes } = productPayload(product);
    const { data, error } = await supabase.from('productos_importaciones_lara').update(changes).eq('id', product.id!).select('*').single();
    if (error) throw new Error(error.message);
    return saveImage({ ...mapProduct(data), imagenRuta: product.imagenRuta }, image);
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
