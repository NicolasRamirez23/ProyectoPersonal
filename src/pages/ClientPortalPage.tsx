import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Download, File, WalletCards } from 'lucide-react';
import { architecturalProjectsService } from '../services/architecturalProjects';
import { formatCurrency } from '../lib/utils';
import { useAlerts } from '../components/AlertProvider';

export function ClientPortalPage() {
  const { prompt: promptAlert, notify } = useAlerts();
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof architecturalProjectsService.getAll>>>([]);
  const [error, setError] = useState('');
  const load = () => architecturalProjectsService.getAll().then(setProjects).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, []);
  const respond = async (projectId: string, response: 'aprobada' | 'rechazada') => {
    const comment = await promptAlert(
      response === 'aprobada' ? 'Aprobar cotización' : 'Rechazar cotización',
      response === 'aprobada' ? 'Confirma que estás de acuerdo con el alcance y los importes.' : 'Cuéntanos el motivo para que el equipo pueda realizar los ajustes.',
      { confirmText: response === 'aprobada' ? 'Aprobar' : 'Enviar rechazo', required: response === 'rechazada', danger: response === 'rechazada', placeholder: 'Escribe un comentario...' },
    );
    if (comment === null) return;
    try {
      await architecturalProjectsService.respondToQuotation(projectId, response, comment);
      notify('success', response === 'aprobada' ? 'Cotización aprobada' : 'Respuesta enviada', 'El equipo de arquitectura ya puede consultar tu respuesta.');
      await load();
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : 'No se pudo registrar la respuesta.');
    }
  };
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold text-slate-900">Mis proyectos</h1><p className="mt-1 text-slate-500">Consulta avances, pagos, actividades y documentos compartidos.</p></div>
    {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!projects.length && !error && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-500">Todavía no tienes proyectos asignados.</div>}
    {projects.map((project) => {
      const multiplier = project.invoiceRequested ? 1.16 : 1;
      const total = project.charges.reduce((sum, charge) => sum + charge.amount * multiplier, 0);
      const paid = project.charges.flatMap((charge) => charge.payments).reduce((sum, payment) => sum + payment.amount, 0);
      const tasks = project.stages.flatMap((stage) => stage.tasks);
      const progress = tasks.length ? Math.round(tasks.filter((task) => task.completed).length / tasks.length * 100) : 0;
      return <section key={project.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="bg-slate-900 p-6 text-white"><div className="flex items-center gap-3"><Building2 className="h-6 w-6 text-blue-300" /><div><h2 className="text-xl font-bold">{project.projectName}</h2><p className="text-sm text-slate-300">{project.projectType} · {project.location}</p></div></div></header>
        <div className="space-y-6 p-6">
          <div className={`rounded-xl border p-4 ${project.quotationStatus === 'aprobada' ? 'border-emerald-200 bg-emerald-50' : project.quotationStatus === 'rechazada' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-bold uppercase text-slate-500">Estado de cotización</p><p className="mt-1 font-bold capitalize text-slate-800">{project.quotationStatus}</p>{project.quotationComment && <p className="mt-1 text-xs text-slate-600">{project.quotationComment}</p>}</div>
              {project.quotationStatus === 'enviada' && <div className="flex gap-2"><button onClick={() => void respond(project.id, 'rechazada')} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600">Rechazar</button><button onClick={() => void respond(project.id, 'aprobada')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Aprobar cotización</button></div>}
            </div>
          </div>
          <div><div className="flex justify-between text-sm font-bold text-slate-700"><span>Avance del proyecto</span><span>{progress}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-cyan-500" style={{ width: `${progress}%` }} /></div></div>
          <div className="grid gap-3 sm:grid-cols-3"><Stat label="Total" value={formatCurrency(total)} /><Stat label="Pagado" value={formatCurrency(paid)} /><Stat label="Saldo" value={formatCurrency(total - paid)} /></div>
          <div><h3 className="mb-3 font-bold text-slate-800">Etapas</h3><div className="grid gap-3 md:grid-cols-2">{project.stages.map((stage) => <div key={stage.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><p className="font-bold text-slate-700">{stage.name}</p><span className="text-xs capitalize text-cyan-700">{stage.status.replace('_', ' ')}</span></div><p className="mt-1 text-xs text-slate-500">Responsable: {stage.responsible || 'Por asignar'} · Entrega: {stage.dueDate || 'Por definir'}</p><p className="mt-3 text-xs text-slate-500"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{stage.tasks.filter((task) => task.completed).length} de {stage.tasks.length} tareas completadas</p></div>)}</div></div>
          <div><h3 className="mb-3 font-bold text-slate-800">Servicios y documentos</h3><div className="space-y-3">{project.charges.map((charge) => <div key={charge.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><p className="font-bold text-slate-700">{charge.concept}</p><p className="font-bold text-slate-900">{formatCurrency(charge.amount * multiplier)}</p></div><p className="mt-1 text-sm text-slate-500">{charge.description}</p>{charge.attachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{charge.attachments.map((attachment) => <a key={attachment.id} href={attachment.dataUrl} download={attachment.name} className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><File className="h-3.5 w-3.5" />{attachment.name}<Download className="h-3.5 w-3.5" /></a>)}</div>}</div>)}</div></div>
        </div>
      </section>;
    })}
  </div>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-900">{value}</p></div>; }
