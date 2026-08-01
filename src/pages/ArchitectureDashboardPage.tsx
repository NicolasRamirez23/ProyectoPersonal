import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CalendarClock, CheckCircle2, CircleDollarSign, FileCheck2, ReceiptText, TrendingUp, WalletCards } from 'lucide-react';
import { architecturalProjectsService } from '../services/architecturalProjects';
import { formatCurrency } from '../lib/utils';

export function ArchitectureDashboardPage() {
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof architecturalProjectsService.getAll>>>([]);
  const [error, setError] = useState('');
  useEffect(() => { void architecturalProjectsService.getAll().then(setProjects).catch((e) => setError(e.message)); }, []);

  const data = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let quoted = 0, collected = 0, expenses = 0, paidExpenses = 0;
    const deadlines: { project: string; stage: string; date: string; overdue: boolean }[] = [];
    projects.forEach((project) => {
      const multiplier = project.invoiceRequested ? 1.16 : 1;
      quoted += project.charges.reduce((sum, charge) => sum + Number(charge.amount) * multiplier, 0);
      collected += project.charges.flatMap((charge) => charge.payments).reduce((sum, payment) => sum + Number(payment.amount), 0);
      expenses += project.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
      paidExpenses += project.expenses.filter((expense) => expense.status === 'pagado').reduce((sum, expense) => sum + Number(expense.amount), 0);
      project.stages.filter((stage) => stage.status !== 'completada' && stage.dueDate).forEach((stage) => {
        const due = new Date(`${stage.dueDate}T12:00:00`);
        const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
        if (days <= 15) deadlines.push({ project: project.projectName, stage: stage.name, date: stage.dueDate, overdue: days < 0 });
      });
    });
    return {
      quoted, collected, expenses, paidExpenses,
      estimatedProfit: quoted - expenses,
      realProfit: collected - paidExpenses,
      pending: quoted - collected,
      active: projects.filter((project) => project.status === 'activo').length,
      approved: projects.filter((project) => project.quotationStatus === 'aprobada').length,
      awaiting: projects.filter((project) => project.quotationStatus === 'enviada').length,
      deadlines: deadlines.sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [projects]);

  const collectionRate = data.quoted > 0 ? Math.min(100, Math.round(data.collected / data.quoted * 100)) : 0;
  const statusCounts = ['cotizacion', 'activo', 'pausado', 'terminado'].map((status) => ({
    status, count: projects.filter((project) => project.status === status).length,
  }));

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight text-slate-900">Resumen de arquitectura</h1><p className="mt-1 text-slate-500">Indicadores financieros, operación y próximas entregas.</p></div>
    {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Building2} label="Proyectos activos" value={String(data.active)} color="blue" />
      <Metric icon={CircleDollarSign} label="Total cotizado" value={formatCurrency(data.quoted)} color="violet" />
      <Metric icon={WalletCards} label="Total cobrado" value={formatCurrency(data.collected)} color="emerald" />
      <Metric icon={TrendingUp} label="Utilidad real" value={formatCurrency(data.realProfit)} color="cyan" />
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-slate-900">Resumen financiero</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Finance label="Saldo por cobrar" value={data.pending} color="text-amber-600" />
          <Finance label="Gastos estimados" value={data.expenses} color="text-rose-600" />
          <Finance label="Gastos pagados" value={data.paidExpenses} color="text-red-600" />
          <Finance label="Utilidad estimada" value={data.estimatedProfit} color="text-blue-700" />
        </div>
        <div className="mt-6"><div className="flex justify-between text-sm font-bold text-slate-600"><span>Avance de cobranza</span><span>{collectionRate}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${collectionRate}%` }} /></div></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-slate-900">Cotizaciones</h2>
        <div className="mt-5 space-y-3">
          <SmallStat icon={FileCheck2} label="Aprobadas" value={data.approved} color="text-emerald-600 bg-emerald-50" />
          <SmallStat icon={ReceiptText} label="Esperando respuesta" value={data.awaiting} color="text-blue-600 bg-blue-50" />
          <SmallStat icon={CheckCircle2} label="Proyectos terminados" value={projects.filter((project) => project.status === 'terminado').length} color="text-violet-600 bg-violet-50" />
        </div>
      </section>
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-slate-900">Estado de proyectos</h2>
        <div className="mt-5 space-y-4">{statusCounts.map((item) => {
          const percentage = projects.length ? Math.round(item.count / projects.length * 100) : 0;
          return <div key={item.status}><div className="flex justify-between text-sm capitalize text-slate-600"><span>{item.status}</span><span className="font-bold">{item.count}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${percentage}%` }} /></div></div>;
        })}</div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Entregas próximas</h2><CalendarClock className="h-5 w-5 text-slate-400" /></div>
        <div className="mt-4 space-y-2">{data.deadlines.slice(0, 8).map((item, index) => <div key={`${item.project}-${item.stage}-${index}`} className={`flex items-center gap-3 rounded-xl border p-3 ${item.overdue ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}><AlertTriangle className={`h-4 w-4 shrink-0 ${item.overdue ? 'text-red-600' : 'text-amber-600'}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-700">{item.stage}</p><p className="truncate text-xs text-slate-500">{item.project}</p></div><span className="text-xs font-bold text-slate-600">{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-MX')}</span></div>)}{!data.deadlines.length && <p className="py-8 text-center text-sm text-slate-400">No hay entregas próximas o vencidas.</p>}</div>
      </section>
    </div>
  </div>;
}

function Metric({ icon: Icon, label, value, color }: { icon: typeof Building2; label: string; value: string; color: string }) {
  const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', violet: 'bg-violet-50 text-violet-600', emerald: 'bg-emerald-50 text-emerald-600', cyan: 'bg-cyan-50 text-cyan-600' };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`inline-flex rounded-xl p-2.5 ${colors[color]}`}><Icon className="h-5 w-5" /></div><p className="mt-4 text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>;
}
function Finance({ label, value, color }: { label: string; value: number; color: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-lg font-bold ${color}`}>{formatCurrency(value)}</p></div>; }
function SmallStat({ icon: Icon, label, value, color }: { icon: typeof FileCheck2; label: string; value: number; color: string }) { return <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className={`rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></div><span className="flex-1 text-sm text-slate-600">{label}</span><span className="font-bold text-slate-900">{value}</span></div>; }
