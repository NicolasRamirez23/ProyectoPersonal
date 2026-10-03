import { useRef, useState } from 'react';
import { AlertCircle, BadgeCheck, Download, FileSpreadsheet, FileUp, LockKeyhole, RefreshCw } from 'lucide-react';
import { downloadBankStatementExcel, parseBankStatement, type BankStatementResult } from '../lib/bankStatement';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function BankStatementConverterPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BankStatementResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const processFile = async (selected: File) => {
    setFile(selected);
    setResult(null);
    setError('');
    setProgress(0);
    if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
      setError('Selecciona un archivo PDF válido.');
      return;
    }
    if (selected.size > 30 * 1024 * 1024) {
      setError('El archivo excede el límite de 30 MB.');
      return;
    }
    setProcessing(true);
    try {
      setResult(await parseBankStatement(selected, setProgress));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible procesar el estado de cuenta.');
    } finally {
      setProcessing(false);
    }
  };

  const clear = () => {
    setFile(null); setResult(null); setError(''); setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
            <LockKeyhole className="h-3.5 w-3.5" /> Solo administrador
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Estados de cuenta a Excel</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Carga un estado de cuenta de Banco Inbursa y obtén los movimientos listos para filtrar, conciliar y analizar en Excel.</p>
        </div>
        {file && <button type="button" onClick={clear} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Procesar otro archivo</button>}
      </div>

      {!result && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void processFile(selected); }} />
          <button
            type="button"
            disabled={processing}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); const selected = event.dataTransfer.files?.[0]; if (selected && !processing) void processFile(selected); }}
            className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 px-6 text-center transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-wait"
          >
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200"><FileUp className="h-8 w-8" /></div>
            <p className="text-lg font-bold text-slate-800">{processing ? `Leyendo ${file?.name || 'archivo'}...` : 'Selecciona o arrastra el PDF del banco'}</p>
            <p className="mt-2 text-sm text-slate-500">PDF de hasta 30 MB · El archivo se procesa localmente en tu navegador</p>
            {processing && <div className="mt-6 w-full max-w-md"><div className="h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs font-bold text-blue-700">{progress}% completado</p></div>}
          </button>
          {error && <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">No se pudo convertir el archivo</p><p className="mt-1">{error}</p></div></div>}
        </section>
      )}

      {result && file && (
        <>
          <section className={`rounded-2xl border p-5 ${result.conciliado ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex items-start gap-3">
                {result.conciliado ? <BadgeCheck className="h-7 w-7 shrink-0 text-emerald-600" /> : <AlertCircle className="h-7 w-7 shrink-0 text-amber-600" />}
                <div><p className="font-bold text-slate-900">{result.conciliado ? 'Estado de cuenta conciliado' : 'Conversión terminada con diferencias'}</p><p className="mt-1 text-sm text-slate-600">{result.movimientos.length} movimientos encontrados en {file.name}. {result.conciliado ? 'Los cargos, abonos y saldo final coinciden con el resumen del banco.' : 'Revisa la vista previa antes de descargar.'}</p></div>
              </div>
              <button type="button" onClick={() => void downloadBankStatementExcel(result, file.name)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"><Download className="h-5 w-5" /> Descargar Excel</button>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[['Movimientos', String(result.movimientos.length), FileSpreadsheet], ['Cargos', money.format(result.totalCargos), null], ['Abonos', money.format(result.totalAbonos), null], ['Saldo final', money.format(result.movimientos.at(-1)?.saldo || 0), null]].map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{String(label)}</p>{Icon && <Icon className="h-5 w-5 text-blue-600" />}</div><p className="mt-2 text-2xl font-bold text-slate-900">{String(value)}</p></div>
            ))}
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-900">Vista previa de movimientos</h2><p className="mt-1 text-xs text-slate-500">Se muestran los primeros 25 registros. El Excel incluye todos.</p></div>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-white"><tr>{['Fecha', 'Referencia', 'Tipo', 'Persona', 'Banco', 'Detalle', 'Cargos', 'Abonos', 'Saldo'].map((header) => <th key={header} className="px-4 py-3 font-bold">{header}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{result.movimientos.slice(0, 25).map((row, index) => <tr key={`${row.pagina}-${row.referencia}-${index}`} className="hover:bg-blue-50/50"><td className="whitespace-nowrap px-4 py-3">{row.fecha}</td><td className="px-4 py-3 font-mono text-xs">{row.referencia}</td><td className="px-4 py-3 font-medium">{row.tipo}</td><td className="px-4 py-3">{row.persona || '—'}</td><td className="px-4 py-3">{row.banco || '—'}</td><td className="max-w-xs px-4 py-3 text-slate-600">{row.detalle || '—'}</td><td className="whitespace-nowrap px-4 py-3 text-right">{row.cargos ? money.format(row.cargos) : '—'}</td><td className="whitespace-nowrap px-4 py-3 text-right text-emerald-700">{row.abonos ? money.format(row.abonos) : '—'}</td><td className="whitespace-nowrap px-4 py-3 text-right font-medium">{money.format(row.saldo)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
