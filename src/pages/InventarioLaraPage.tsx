import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, CircleDollarSign, Pencil, Plus, Search, X } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAlerts } from '../components/AlertProvider';
import { inventarioLaraApi } from '../services/inventarioLara';
import type { LaraInventoryMovement, LaraInventoryProduct } from '../types/inventarioLara';

const emptyProduct = (): LaraInventoryProduct => ({ sku: '', nombre: '', categoria: '', existencia: 0, stockMinimo: 1, costo: 0, precioVenta: 0, notas: '', activo: true });
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function InventarioLaraPage() {
  const [products, setProducts] = useState<LaraInventoryProduct[]>([]);
  const [movements, setMovements] = useState<LaraInventoryMovement[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [product, setProduct] = useState<LaraInventoryProduct>(emptyProduct());
  const [adjusting, setAdjusting] = useState<LaraInventoryProduct | null>(null);
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const { notify } = useAlerts();

  const load = async () => {
    setLoading(true);
    try { const [productRows, movementRows] = await Promise.all([inventarioLaraApi.listProducts(), inventarioLaraApi.listMovements()]); setProducts(productRows); setMovements(movementRows); }
    catch (error: any) { notify('error', 'No se pudo cargar el inventario', error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => products.filter((item) => `${item.sku} ${item.nombre} ${item.categoria}`.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const stats = useMemo(() => ({ products: products.filter((item) => item.activo).length, units: products.reduce((sum, item) => sum + item.existencia, 0), low: products.filter((item) => item.activo && item.existencia <= item.stockMinimo).length, value: products.reduce((sum, item) => sum + item.existencia * item.costo, 0) }), [products]);

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { product.id ? await inventarioLaraApi.updateProduct(product) : await inventarioLaraApi.createProduct(product); notify('success', product.id ? 'Producto actualizado' : 'Producto registrado', 'El inventario se actualizó correctamente.'); setFormOpen(false); setProduct(emptyProduct()); await load(); }
    catch (error: any) { notify('error', 'No se pudo guardar el producto', error.message); }
    finally { setSaving(false); }
  };
  const saveMovement = async (event: FormEvent) => {
    event.preventDefault(); if (!adjusting?.id) return; setSaving(true);
    try { await inventarioLaraApi.adjustStock(adjusting.id, movementType, quantity, reason); notify('success', 'Existencia actualizada', 'El movimiento quedó registrado en el historial.'); setAdjusting(null); setQuantity(1); setReason(''); await load(); }
    catch (error: any) { notify('error', 'No se pudo registrar el movimiento', error.message); }
    finally { setSaving(false); }
  };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h1 className="text-3xl font-bold">Control de inventario</h1><p className="mt-1 text-slate-500">Productos, existencias y movimientos de Importaciones Lara.</p></div><Button onClick={() => { setProduct(emptyProduct()); setFormOpen(true); }} leftIcon={<Plus className="h-5 w-5" />}>Nuevo producto</Button></div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Productos activos', stats.products, 'bg-blue-50 text-blue-700', Boxes],
      ['Unidades disponibles', stats.units.toLocaleString('es-MX'), 'bg-violet-50 text-violet-700', ArrowDownToLine],
      ['Stock bajo', stats.low, 'bg-amber-50 text-amber-700', AlertTriangle],
      ['Valor del inventario', money.format(stats.value), 'bg-emerald-50 text-emerald-700', CircleDollarSign],
    ].map(([label, value, color, Icon]: any) => <article key={label} className="rounded-2xl border bg-white p-5 shadow-sm"><div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{loading ? '—' : value}</p></article>)}</section>

    {formOpen && <form onSubmit={saveProduct} className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">{product.id ? 'Editar producto' : 'Registrar producto'}</h2><p className="text-sm text-slate-500">Los nombres y códigos se guardarán en mayúsculas.</p></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Input required label="SKU / Código" value={product.sku} onChange={(e) => setProduct({ ...product, sku: e.target.value.toUpperCase() })}/><Input required label="Nombre del producto" value={product.nombre} onChange={(e) => setProduct({ ...product, nombre: e.target.value.toUpperCase() })}/><Input label="Categoría" value={product.categoria} onChange={(e) => setProduct({ ...product, categoria: e.target.value.toUpperCase() })}/>{!product.id && <Input required label="Existencia inicial" type="number" min="0" step="1" value={product.existencia} onChange={(e) => setProduct({ ...product, existencia: Number(e.target.value) })}/>}<Input required label="Stock mínimo" type="number" min="0" step="1" value={product.stockMinimo} onChange={(e) => setProduct({ ...product, stockMinimo: Number(e.target.value) })}/><Input required label="Costo unitario" type="number" min="0" step="0.01" value={product.costo} onChange={(e) => setProduct({ ...product, costo: Number(e.target.value) })}/><Input required label="Precio de venta" type="number" min="0" step="0.01" value={product.precioVenta} onChange={(e) => setProduct({ ...product, precioVenta: Number(e.target.value) })}/><Input label="Notas" value={product.notas} onChange={(e) => setProduct({ ...product, notas: e.target.value.toUpperCase() })}/></div><div className="mt-5 flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit" isLoading={saving}>Guardar producto</Button></div></form>}

    {adjusting && <form onSubmit={saveMovement} className="rounded-2xl border border-violet-200 bg-violet-50/50 p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">Movimiento: {adjusting.nombre}</h2><p className="text-sm text-slate-500">Existencia actual: <strong>{adjusting.existencia}</strong></p></div><button type="button" onClick={() => setAdjusting(null)}><X className="h-5 w-5" /></button></div><div className="mt-4 grid gap-4 md:grid-cols-3"><label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">Tipo<select className="h-10 rounded-md border bg-white px-3" value={movementType} onChange={(e) => setMovementType(e.target.value as 'ENTRADA' | 'SALIDA')}><option>ENTRADA</option><option>SALIDA</option></select></label><Input required label="Cantidad" type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}/><Input required label="Motivo" placeholder="COMPRA, VENTA, AJUSTE..." value={reason} onChange={(e) => setReason(e.target.value.toUpperCase())}/></div><div className="mt-4 flex justify-end"><Button type="submit" isLoading={saving} leftIcon={movementType === 'ENTRADA' ? <ArrowDownToLine className="h-4 w-4"/> : <ArrowUpFromLine className="h-4 w-4"/>}>Registrar {movementType.toLowerCase()}</Button></div></form>}

    <div className="relative"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><Input className="h-11 pl-10" placeholder="Buscar por código, producto o categoría..." value={search} onChange={(e) => setSearch(e.target.value)}/></div>
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="border-b bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr><th className="px-5 py-4">Producto</th><th className="px-5 py-4">Categoría</th><th className="px-5 py-4">Existencia</th><th className="px-5 py-4">Costo</th><th className="px-5 py-4">Venta</th><th className="px-5 py-4 text-right">Acciones</th></tr></thead><tbody className="divide-y">{loading ? <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Cargando inventario...</td></tr> : filtered.length ? filtered.map((item) => <tr key={item.id} className={item.existencia <= item.stockMinimo ? 'bg-amber-50/50' : ''}><td className="px-5 py-4"><p className="font-bold">{item.nombre}</p><p className="text-xs text-slate-400">{item.sku}</p></td><td className="px-5 py-4 text-sm">{item.categoria || '—'}</td><td className="px-5 py-4"><p className={`text-lg font-black ${item.existencia <= item.stockMinimo ? 'text-amber-700' : 'text-slate-900'}`}>{item.existencia}</p><p className="text-xs text-slate-400">Mín. {item.stockMinimo}</p></td><td className="px-5 py-4 text-sm">{money.format(item.costo)}</td><td className="px-5 py-4 font-bold">{money.format(item.precioVenta)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setAdjusting(item); setMovementType('ENTRADA'); }}>Movimiento</Button><Button size="sm" variant="outline" leftIcon={<Pencil className="h-4 w-4"/>} onClick={() => { setProduct(item); setFormOpen(true); }}>Editar</Button></div></td></tr>) : <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No hay productos registrados.</td></tr>}</tbody></table></div></div>

    <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">Últimos movimientos</h2><div className="mt-4 divide-y">{movements.length ? movements.map((movement) => <div key={movement.id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"><div><p className="font-semibold">{movement.producto?.nombre || 'PRODUCTO'} <span className="text-xs font-normal text-slate-400">{movement.producto?.sku}</span></p><p className="text-xs text-slate-500">{movement.motivo} · {new Date(movement.createdAt).toLocaleString('es-MX')}</p></div><div className="text-right"><p className={`font-black ${movement.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'}`}>{movement.tipo === 'ENTRADA' ? '+' : '-'}{movement.cantidad}</p><p className="text-xs text-slate-400">{movement.existenciaAnterior} → {movement.existenciaNueva}</p></div></div>) : <p className="py-8 text-center text-sm text-slate-400">Todavía no hay movimientos.</p>}</div></section>
  </div>;
}
