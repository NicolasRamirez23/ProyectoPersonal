import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, BadgeCheck, Download, FileSpreadsheet, FileUp, Landmark, LockKeyhole, Search, Split } from 'lucide-react';
import { downloadReconciliationExcel, parseBankExcel, parseReceiptsCsv, reconcilePayments, type ReconciliationResult, type ReconciliationStatus } from '../lib/paymentReconciliation';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const labels: Record<ReconciliationStatus | 'sin_recibo', string> = { exacto: 'Exacto', alta: 'Alta', posible: 'Posible', agrupado: 'Agrupado', sin_movimiento: 'Sin movimiento', sin_recibo: 'Sin recibo' };
const colors: Record<ReconciliationStatus | 'sin_recibo', string> = { exacto: 'bg-emerald-100 text-emerald-700', alta: 'bg-blue-100 text-blue-700', posible: 'bg-amber-100 text-amber-700', agrupado: 'bg-violet-100 text-violet-700', sin_movimiento: 'bg-red-100 text-red-700', sin_recibo: 'bg-slate-200 text-slate-700' };

export function BankReconciliationPage() {
  const receiptsRef = useRef<HTMLInputElement>(null); const bankRef = useRef<HTMLInputElement>(null);
  const [receiptsFile, setReceiptsFile] = useState<File | null>(null); const [bankFile, setBankFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReconciliationResult | null>(null); const [error, setError] = useState(''); const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'todos' | ReconciliationStatus | 'sin_recibo'>('todos'); const [query, setQuery] = useState('');

  const process = async () => {
    if (!receiptsFile || !bankFile) { setError('Selecciona los dos archivos para iniciar.'); return; }
    if (receiptsFile.name === bankFile.name && receiptsFile.size === bankFile.size && receiptsFile.lastModified === bankFile.lastModified) {
      setError('Seleccionaste el mismo archivo en ambos espacios. A la izquierda carga RECIBOS y a la derecha el Excel de movimientos de Inbursa.');
      return;
    }
    setProcessing(true); setError(''); setResult(null);
    try { setResult(reconcilePayments(await parseReceiptsCsv(receiptsFile), await parseBankExcel(bankFile))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible conciliar los archivos.'); }
    finally { setProcessing(false); }
  };
  const rows = useMemo(() => {
    if (!result) return [];
    const regular = result.rows.map((row) => ({ ...row, displayStatus: row.status as ReconciliationStatus | 'sin_recibo' }));
    const bankOnly = result.unmatchedBank.map((bank) => ({ id: `UB-${bank.id}`, status: 'sin_movimiento' as const, displayStatus: 'sin_recibo' as const, confidence: 0, reasons: [] as string[], receipts: [], bank }));
    return [...regular, ...bankOnly].filter((row) => {
      if (filter !== 'todos' && row.displayStatus !== filter) return false;
      const text = `${row.receipts.map((r) => `${r.recibo} ${r.tipoOrigen} ${r.folioOrigen} ${r.cliente} ${r.referenciaPago}`).join(' ')} ${row.bank?.persona || ''} ${row.bank?.referencia || ''}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });
  }, [result, filter, query]);
  const count = (status: ReconciliationStatus | 'sin_recibo') => status === 'sin_recibo' ? result?.unmatchedBank.length || 0 : result?.rows.filter((row) => row.status === status).length || 0;

  return <div className="space-y-6">
    <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700"><LockKeyhole className="h-3.5 w-3.5" /> Solo administrador</div><h1 className="text-3xl font-bold tracking-tight">Conciliación de pagos</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Compara los recibos del sistema con los abonos bancarios mediante referencia de pago, importe, fecha, cliente, manzana y lote.</p></div>
    <section className="grid gap-4 rounded-2xl border bg-white p-6 shadow-sm lg:grid-cols-2">
      <FilePicker title="Recibos del sistema" hint="CSV con la columna referencia_pago" file={receiptsFile} onClick={() => receiptsRef.current?.click()} icon={<FileSpreadsheet className="h-6 w-6" />} />
      <input ref={receiptsRef} className="hidden" type="file" accept=".csv,text/csv" onChange={(e) => { setReceiptsFile(e.target.files?.[0] || null); setResult(null); }} />
      <FilePicker title="Movimientos del banco" hint="Selecciona INBURSA AGOSTO o el Excel generado desde el PDF" file={bankFile} onClick={() => bankRef.current?.click()} icon={<Landmark className="h-6 w-6" />} />
      <input ref={bankRef} className="hidden" type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { setBankFile(e.target.files?.[0] || null); setResult(null); }} />
      <div className="lg:col-span-2 flex flex-col items-start justify-between gap-3 border-t pt-5 sm:flex-row sm:items-center"><p className="text-xs text-slate-500">Los archivos se procesan localmente en tu navegador y no se almacenan.</p><button type="button" disabled={!receiptsFile || !bankFile || processing} onClick={() => void process()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Split className="h-5 w-5" />{processing ? 'Conciliando...' : 'Comparar pagos'}</button></div>
      {error && <div className="lg:col-span-2 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-5 w-5 shrink-0" /><span>{error}</span></div>}
    </section>
    {result && <>
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center"><div className="flex gap-3"><BadgeCheck className="h-7 w-7 text-emerald-600" /><div><p className="font-bold">Conciliación terminada</p><p className="text-sm text-slate-600">{result.receiptCount} recibos y {result.bankCount} abonos analizados.</p></div></div><button onClick={() => void downloadReconciliationExcel(result)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"><Download className="h-5 w-5" />Exportar conciliación</button></section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Recibos', result.receiptCount, money.format(result.receiptTotal)], ['Abonos', result.bankCount, money.format(result.bankTotal)], ['Conciliados', count('exacto') + count('alta') + count('agrupado'), 'Exactos, altos y agrupados'], ['Por revisar', count('posible') + count('sin_movimiento') + count('sin_recibo'), 'Posibles y no encontrados']].map(([label, value, detail]) => <div key={String(label)} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>)}</div>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-wrap gap-2">{(['todos', 'exacto', 'alta', 'posible', 'agrupado', 'sin_movimiento', 'sin_recibo'] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === item ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{item === 'todos' ? `Todos (${result.rows.length + result.unmatchedBank.length})` : `${labels[item]} (${count(item)})`}</button>)}</div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Recibo, cliente o referencia" className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 xl:w-72" /></div></div>
        <div className="overflow-x-auto"><table className="min-w-[1250px] w-full text-left text-sm"><thead className="bg-slate-900 text-xs uppercase text-white"><tr>{['Estado', 'Recibo', 'Origen', 'Cliente', 'Mza/Lote', 'Referencia pago', 'Monto recibo', 'Fecha banco', 'Persona banco', 'Referencia banco', 'Abono', 'Criterios'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id} className="hover:bg-blue-50/40"><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${colors[row.displayStatus]}`}>{labels[row.displayStatus]}</span>{row.confidence > 0 && <p className="mt-1 text-[11px] text-slate-400">{row.confidence}%</p>}</td><td className="px-4 py-3 font-bold">{row.receipts.map((r) => r.recibo).join(', ') || '—'}</td><td className="px-4 py-3"><p className="font-medium">{row.receipts.map((r) => r.tipoOrigen).join(', ') || '—'}</p><p className="text-xs text-slate-400">{row.receipts.map((r) => r.folioOrigen).join(', ')}</p></td><td className="max-w-56 px-4 py-3">{row.receipts.map((r) => r.cliente).join(' / ') || '—'}</td><td className="px-4 py-3">{row.receipts.map((r) => r.manzana && r.lote ? `M${r.manzana} L${r.lote}` : 'No aplica').join(', ') || '—'}</td><td className="px-4 py-3 font-mono text-xs">{row.receipts.map((r) => r.referenciaPago).filter(Boolean).join(', ') || '—'}</td><td className="px-4 py-3 text-right font-medium">{row.receipts.length ? money.format(row.receipts.reduce((s, r) => s + r.monto, 0)) : '—'}</td><td className="px-4 py-3">{row.bank?.fecha || '—'}</td><td className="max-w-56 px-4 py-3">{row.bank?.persona || '—'}</td><td className="px-4 py-3 font-mono text-xs">{row.bank?.referencia || '—'}</td><td className="px-4 py-3 text-right font-medium text-emerald-700">{row.bank ? money.format(row.bank.abono) : '—'}</td><td className="max-w-52 px-4 py-3 text-xs text-slate-500">{row.reasons.join(', ') || '—'}</td></tr>)}{!rows.length && <tr><td colSpan={12} className="p-10 text-center text-slate-400">No hay resultados para este filtro.</td></tr>}</tbody></table></div>
      </section>
    </>}
  </div>;
}

function FilePicker({ title, hint, file, onClick, icon }: { title: string; hint: string; file: File | null; onClick: () => void; icon: ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex min-h-36 items-center gap-4 rounded-2xl border-2 border-dashed p-5 text-left transition ${file ? 'border-emerald-300 bg-emerald-50' : 'border-blue-200 bg-blue-50/40 hover:border-blue-400'}`}><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${file ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'}`}>{file ? <BadgeCheck className="h-6 w-6" /> : icon}</div><div><p className="font-bold text-slate-800">{file?.name || title}</p><p className="mt-1 text-xs text-slate-500">{file ? `${(file.size / 1024).toFixed(1)} KB · clic para cambiar` : hint}</p></div></button>;
}
