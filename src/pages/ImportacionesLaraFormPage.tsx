import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAlerts } from '../components/AlertProvider';
import { importacionesLaraApi } from '../services/importacionesLara';
import { generateImportacionesLaraPdf } from '../lib/importacionesLaraPdf';
import type { LaraPaymentMethod, LaraPaymentStatus, LaraReceipt, LaraReceiptItem } from '../types/importacionesLara';

const newItem = (): LaraReceiptItem => ({ id: crypto.randomUUID(), descripcion: '', cantidad: 1, precioUnitario: 0, importe: 0 });
const initialReceipt = (): LaraReceipt => ({ folio: '', metodoPago: 'EFECTIVO', estadoPago: 'EN PROCESO', conceptos: [newItem()], total: 0 });

export function ImportacionesLaraFormPage() {
  const [receipt, setReceipt] = useState<LaraReceipt>(initialReceipt);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { notify } = useAlerts();
  const total = useMemo(() => receipt.conceptos.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0), [receipt.conceptos]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    importacionesLaraApi.getById(id).then(setReceipt).catch((error) => notify('error', 'No se pudo cargar el recibo', error.message)).finally(() => setLoading(false));
  }, [id]);

  const updateItem = (itemId: string, patch: Partial<LaraReceiptItem>) => setReceipt((current) => ({ ...current, conceptos: current.conceptos.map((item) => item.id === itemId ? { ...item, ...patch, importe: Number(patch.cantidad ?? item.cantidad) * Number(patch.precioUnitario ?? item.precioUnitario) } : item) }));
  const removeItem = (itemId: string) => setReceipt((current) => ({ ...current, conceptos: current.conceptos.filter((item) => item.id !== itemId) }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!receipt.conceptos.length) return notify('warning', 'Agrega un concepto', 'El recibo debe contener al menos un concepto.');
    setSaving(true);
    try {
      const normalized = { ...receipt, folio: receipt.folio.trim().toUpperCase(), conceptos: receipt.conceptos.map((item) => ({ ...item, descripcion: item.descripcion.trim().toUpperCase(), importe: item.cantidad * item.precioUnitario })), total };
      const saved = editing && id ? await importacionesLaraApi.update(id, normalized) : await importacionesLaraApi.create(normalized);
      await generateImportacionesLaraPdf(saved);
      notify('success', editing ? 'Recibo actualizado' : 'Recibo creado', 'El PDF comenzó a descargarse.');
      navigate('/importaciones-lara');
    } catch (error: any) { notify('error', 'No se pudo guardar el recibo', error.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-20 text-center text-slate-500">Cargando recibo...</div>;
  return <form onSubmit={submit} className="mx-auto max-w-5xl space-y-6">
    <div className="flex items-center gap-4"><button type="button" onClick={() => navigate('/importaciones-lara')} className="rounded-xl border bg-white p-2.5 text-slate-600"><ArrowLeft className="h-5 w-5" /></button><div><h1 className="text-3xl font-bold">{editing ? 'Editar recibo' : 'Nuevo recibo'}</h1><p className="text-slate-500">Importaciones Lara - recibo comercial</p></div></div>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="grid gap-4 md:grid-cols-2"><label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">Método de pago<select className="h-11 rounded-md border bg-white px-3" value={receipt.metodoPago} onChange={(event) => setReceipt({ ...receipt, metodoPago: event.target.value as LaraPaymentMethod })}>{['EFECTIVO','TRANSFERENCIA','TARJETA','DEPÓSITO','OTRO'].map((value) => <option key={value}>{value}</option>)}</select></label><label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">Estado del pago<select className="h-11 rounded-md border bg-white px-3" value={receipt.estadoPago} onChange={(event) => setReceipt({ ...receipt, estadoPago: event.target.value as LaraPaymentStatus })}><option>EN PROCESO</option><option>TERMINADO</option></select></label></div></section>
    <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">Conceptos</h2><p className="text-sm text-slate-500">El importe se calcula con cantidad × precio unitario.</p></div><Button type="button" variant="outline" size="sm" disabled={receipt.conceptos.length >= 10} leftIcon={<Plus className="h-4 w-4" />} onClick={() => setReceipt({ ...receipt, conceptos: [...receipt.conceptos, newItem()] })}>Agregar</Button></div><div className="space-y-4">{receipt.conceptos.map((item, index) => <div key={item.id} className="grid gap-3 rounded-xl border bg-slate-50 p-4 md:grid-cols-[1fr_100px_150px_150px_42px]"><Input required label={`Concepto / descripción ${index + 1}`} value={item.descripcion} onChange={(event) => updateItem(item.id, { descripcion: event.target.value.toUpperCase() })} /><Input required label="Cantidad" type="number" min="0.01" step="0.01" value={item.cantidad} onChange={(event) => updateItem(item.id, { cantidad: Number(event.target.value) })} /><Input required label="Precio unitario" type="number" min="0" step="0.01" value={item.precioUnitario} onChange={(event) => updateItem(item.id, { precioUnitario: Number(event.target.value) })} /><Input label="Importe" readOnly value={new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.cantidad * item.precioUnitario)} className="bg-slate-100 font-bold" /><button type="button" aria-label="Eliminar concepto" disabled={receipt.conceptos.length === 1} onClick={() => removeItem(item.id)} className="mt-6 flex h-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div>)}</div><div className="mt-6 flex justify-end border-t pt-5"><div className="text-right"><p className="text-xs font-bold uppercase text-slate-400">Total</p><p className="text-3xl font-black text-blue-700">{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total)}</p></div></div></section>
    <div className="sticky bottom-4 flex justify-end gap-3 rounded-2xl border bg-white/95 p-4 shadow-lg backdrop-blur"><Button type="button" variant="outline" onClick={() => navigate('/importaciones-lara')}>Cancelar</Button><Button type="submit" isLoading={saving} leftIcon={<Save className="h-4 w-4" />}>{editing ? 'Guardar cambios y generar PDF' : 'Guardar y generar PDF'}</Button></div>
  </form>;
}
