import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CircleDollarSign, Edit3, HardHat, Plus, Search, Trash2, WalletCards } from 'lucide-react';
import { architecturalProjectsService } from '../services/architecturalProjects';
import { formatCurrency } from '../lib/utils';

const statusStyles: Record<string, string> = {
  cotizacion: 'bg-violet-50 text-violet-700',
  activo: 'bg-blue-50 text-blue-700',
  pausado: 'bg-amber-50 text-amber-700',
  terminado: 'bg-emerald-50 text-emerald-700',
};

export function ArchitecturalProjectListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof architecturalProjectsService.getAll>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      setProjects(await architecturalProjectsService.getAll());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los proyectos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);
  const filtered = useMemo(() => projects.filter((project) =>
    [project.clientName, project.projectName, project.constructionType, project.projectType]
      .some((value) => value.toLowerCase().includes(search.toLowerCase()))), [projects, search]);
  const totals = useMemo(() => projects.reduce((acc, project) => {
    const total = project.charges.reduce((sum, charge) => sum + Number(charge.amount), 0);
    const paid = project.charges.filter((charge) => charge.status === 'pagado').reduce((sum, charge) => sum + Number(charge.amount), 0);
    return { quoted: acc.quoted + total, paid: acc.paid + paid };
  }, { quoted: 0, paid: 0 }), [projects]);

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar el proyecto "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await architecturalProjectsService.remove(id);
      await loadProjects();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'No se pudo eliminar el proyecto.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight text-slate-900">Proyectos arquitectónicos</h1><p className="mt-1 text-slate-500">Administra obras y cobra cada servicio por separado.</p></div>
        <button onClick={() => navigate('/arquitectura/nuevo')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"><Plus className="h-5 w-5" /> Nuevo proyecto arquitectónico</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={HardHat} label="Proyectos" value={String(projects.length)} />
        <Stat icon={CircleDollarSign} label="Total cotizado" value={formatCurrency(totals.quoted)} />
        <Stat icon={WalletCards} label="Saldo por cobrar" value={formatCurrency(totals.quoted - totals.paid)} />
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por cliente, obra o tipo de construcción..." className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
      </div>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm font-medium text-slate-500">Cargando proyectos desde Supabase...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Building2 className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-bold text-slate-700">{projects.length ? 'No encontramos coincidencias' : 'Aún no hay proyectos arquitectónicos'}</h2>
          <p className="mt-1 text-sm text-slate-500">Crea el primero y agrega todos sus conceptos de cobro.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filtered.map((project) => {
            const total = project.charges.reduce((sum, charge) => sum + Number(charge.amount), 0);
            const paid = project.charges.filter((charge) => charge.status === 'pagado').reduce((sum, charge) => sum + Number(charge.amount), 0);
            const percentage = total ? Math.round((paid / total) * 100) : 0;
            return (
              <article key={project.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3"><div className="rounded-xl bg-slate-900 p-3 text-white"><Building2 className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-900">{project.projectName}</h2><p className="text-sm text-slate-500">{project.clientName}</p></div></div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${statusStyles[project.status]}`}>{project.status}</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">{project.constructionType}</span>
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">{project.projectType}</span>
                  <span className="rounded-lg bg-blue-50 px-3 py-1.5 font-medium text-blue-700">{project.charges.length} conceptos</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-slate-400">Total del proyecto</p><p className="font-bold text-slate-900">{formatCurrency(total)}</p></div>
                  <div className="text-right"><p className="text-xs text-slate-400">Pendiente</p><p className="font-bold text-amber-600">{formatCurrency(total - paid)}</p></div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} /></div>
                <div className="mt-2 flex justify-between text-[11px] text-slate-400"><span>{percentage}% cobrado</span><span>{formatCurrency(paid)} pagado</span></div>
                <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
                  <button onClick={() => navigate(`/arquitectura/editar/${project.id}`)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"><Edit3 className="h-4 w-4" /> Ver y editar</button>
                  <button onClick={() => void remove(project.id, project.projectName)} title="Eliminar" className="rounded-xl border border-red-100 p-2.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof HardHat; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Icon className="h-5 w-5" /></div><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="text-xl font-bold text-slate-900">{value}</p></div></div></div>;
}
