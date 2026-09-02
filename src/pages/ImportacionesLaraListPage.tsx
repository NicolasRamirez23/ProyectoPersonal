import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDollarSign, Clock3, Download, Package, Pencil, Plus, ReceiptText, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAlerts } from '../components/AlertProvider';
import { importacionesLaraApi } from '../services/importacionesLara';
import { generateImportacionesLaraPdf } from '../lib/importacionesLaraPdf';
import type { LaraPaymentMethod, LaraReceipt } from '../types/importacionesLara';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const paymentMethods: LaraPaymentMethod[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'DEPÓSITO', 'OTRO'];

export function ImportacionesLaraListPage() {
  const [receipts, setReceipts] = useState<LaraReceipt[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { notify } = useAlerts();

  useEffect(() => {
    importacionesLaraApi.list()
      .then(setReceipts)
      .catch((error) => notify('error', 'No se pudieron cargar los recibos', error.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => receipts.filter((receipt) =>
    `${receipt.folio} ${receipt.metodoPago} ${receipt.estadoPago} ${receipt.conceptos.map((item) => item.descripcion).join(' ')}`
      .toLowerCase().includes(search.toLowerCase())), [receipts, search]);

  const stats = useMemo(() => {
    const completed = receipts.filter((receipt) => receipt.estadoPago === 'TERMINADO');
    const pending = receipts.filter((receipt) => receipt.estadoPago === 'EN PROCESO');
    return {
      total: receipts.length,
      amount: receipts.reduce((sum, receipt) => sum + receipt.total, 0),
      completed: completed.length,
      completedAmount: completed.reduce((sum, receipt) => sum + receipt.total, 0),
      pending: pending.length,
      pendingAmount: pending.reduce((sum, receipt) => sum + receipt.total, 0),
      units: receipts.reduce((sum, receipt) => sum + receipt.conceptos.reduce((subtotal, item) => subtotal + Number(item.cantidad || 0), 0), 0),
      methods: paymentMethods.map((method) => {
        const entries = receipts.filter((receipt) => receipt.metodoPago === method);
        return { method, count: entries.length, amount: entries.reduce((sum, receipt) => sum + receipt.total, 0) };
      }).filter((entry) => entry.count > 0),
    };
  }, [receipts]);

  const cards = [
    { label: 'Recibos totales', value: stats.total.toLocaleString('es-MX'), detail: `${stats.units.toLocaleString('es-MX')} unidades registradas`, icon: ReceiptText, color: 'bg-blue-50 text-blue-700' },
    { label: 'Importe acumulado', value: money.format(stats.amount), detail: 'Valor total de los recibos', icon: CircleDollarSign, color: 'bg-violet-50 text-violet-700' },
    { label: 'Pagos terminados', value: stats.completed.toLocaleString('es-MX'), detail: money.format(stats.completedAmount), icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Pagos en proceso', value: stats.pending.toLocaleString('es-MX'), detail: money.format(stats.pendingAmount), icon: Clock3, color: 'bg-amber-50 text-amber-700' },
  ];

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h1 className="text-3xl font-bold">Importaciones Lara</h1><p className="mt-1 text-slate-500">Administración y resumen de recibos comerciales.</p></div><Button onClick={() => navigate('/importaciones-lara/nuevo')} leftIcon={<Plus className="h-5 w-5" />}>Nuevo recibo</Button></div>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, detail, icon: Icon, color }) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{loading ? '—' : value}</p><p className="mt-1 text-xs font-medium text-slate-400">{loading ? 'Cargando información...' : detail}</p></article>)}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><Package className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-900">Métodos de pago</h2><p className="text-sm text-slate-500">Cantidad e importe acumulado por método.</p></div></div>
      {loading ? <p className="py-6 text-center text-sm text-slate-400">Cargando estadísticas...</p> : stats.methods.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{stats.methods.map(({ method, count, amount }) => <div key={method} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold tracking-wide text-slate-500">{method}</p><div className="mt-3 flex items-end justify-between gap-2"><p className="text-2xl font-black text-slate-900">{count}</p><p className="text-xs font-semibold text-slate-500">{count === 1 ? 'recibo' : 'recibos'}</p></div><p className="mt-2 border-t border-slate-200 pt-2 text-sm font-bold text-blue-700">{money.format(amount)}</p></div>)}</div> : <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-400">Las estadísticas aparecerán cuando existan recibos.</p>}
    </section>

    <div className="relative"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><Input className="h-11 pl-10" placeholder="Buscar por folio, concepto, método o estado..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="border-b bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr><th className="px-6 py-4">Folio</th><th className="px-6 py-4">Método</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4">Total</th><th className="px-6 py-4">Fecha</th><th className="px-6 py-4 text-right">Acciones</th></tr></thead><tbody className="divide-y">{loading ? <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Cargando recibos...</td></tr> : filtered.length ? filtered.map((receipt) => <tr key={receipt.id} className="hover:bg-blue-50/40"><td className="px-6 py-4 font-bold">{receipt.folio}</td><td className="px-6 py-4 text-sm">{receipt.metodoPago}</td><td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${receipt.estadoPago === 'TERMINADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{receipt.estadoPago}</span></td><td className="px-6 py-4 font-bold">{money.format(receipt.total)}</td><td className="px-6 py-4 text-sm text-slate-500">{receipt.createdAt ? new Date(receipt.createdAt).toLocaleDateString('es-MX') : ''}</td><td className="px-6 py-4"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/importaciones-lara/editar/${receipt.id}`)}>Editar</Button><Button size="sm" variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={() => generateImportacionesLaraPdf(receipt)}>PDF</Button></div></td></tr>) : <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No hay recibos registrados.</td></tr>}</tbody></table></div></div>
  </div>;
}
