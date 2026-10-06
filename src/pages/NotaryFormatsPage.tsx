import { Archive, ArrowRight, FileSearch, Files, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function NotaryFormatsPage() {
  const { profile } = useAuth();
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold tracking-tight">Formatos notariales</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Selecciona un formato, captura los datos una sola vez y genera el documento listo para revisar, imprimir o enviar.</p></div>{profile?.rol === 'admin' ? <Link to="/notaria/usuario" className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"><Settings className="h-4 w-4"/>Administrar acceso</Link> : null}</div>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <Link to="/notaria/busqueda-radicacion" className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white"><FileSearch className="h-6 w-6"/></div><div className="mt-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Oficio</p><h2 className="mt-1 text-lg font-bold">Búsqueda de radicación</h2><p className="mt-2 text-sm leading-6 text-slate-500">Solicitud de informe sobre testamento dirigida al Archivo General de Notarías u otra autoridad.</p></div><ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600"/></div></Link>
      <div className="rounded-2xl border border-dashed bg-slate-50 p-6 text-slate-400"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200"><Files className="h-6 w-6"/></div><p className="mt-5 text-xs font-bold uppercase tracking-wide">Próximamente</p><h2 className="mt-1 text-lg font-bold text-slate-500">Nuevos formatos</h2><p className="mt-2 text-sm leading-6">Este catálogo crecerá sin modificar los formatos existentes.</p></div>
    </div>
    <Link to="/notaria/documentos" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"><Archive className="h-5 w-5 text-blue-600"/>Consultar archivo de documentos</Link>
  </div>;
}
