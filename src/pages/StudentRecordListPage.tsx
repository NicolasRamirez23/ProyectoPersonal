import { useEffect, useMemo, useState } from 'react';
import { FileDown, Pencil, Plus, Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAlerts } from '../components/AlertProvider';
import { useAuth } from '../auth/AuthContext';
import { generateStudentRecordPdf } from '../lib/studentRecordPdf';
import { studentRecordsApi } from '../services/studentRecords';
import type { StudentRecordData } from '../types/studentRecord';

export function StudentRecordListPage() {
  const [records, setRecords] = useState<StudentRecordData[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { notify } = useAlerts();
  const { profile } = useAuth();
  const isAdmin = profile?.rol === 'admin';

  useEffect(() => {
    let active = true;
    studentRecordsApi.list()
      .then((data) => { if (active) setRecords(data); })
      .catch((error) => { if (active) notify('error', 'No se pudieron cargar las fichas', error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => records.filter((record) => `${record.nombre} ${record.escuela} ${record.gradoGrupo}`.toLowerCase().includes(search.toLowerCase())), [records, search]);

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h1 className="text-3xl font-bold tracking-tight">Fichas de estudiantes</h1><p className="mt-1 text-slate-500">Registros generales y fichas de identificación escolar.</p></div><Button onClick={() => navigate('/fichas/nueva-interna')} leftIcon={<Plus className="h-5 w-5" />}>Nueva ficha</Button></div>
    <div className="relative"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><Input className="h-11 pl-10" placeholder="Buscar por alumno, escuela o grupo..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left">
      <thead className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-4">Estudiante</th><th className="px-6 py-4">Escuela</th><th className="px-6 py-4">Grado y grupo</th><th className="px-6 py-4">Fecha</th><th className="px-6 py-4 text-right">Acciones</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">Cargando fichas...</td></tr> : filtered.length ? filtered.map((record) => <tr key={record.id} className="hover:bg-blue-50/40">
        <td className="px-6 py-4"><div className="flex items-center gap-3">{record.foto ? <img src={record.foto} alt={`Fotografía de ${record.nombre}`} className="h-11 w-11 rounded-full object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100"><UserRound className="h-5 w-5" /></div>}<span className="font-semibold">{record.nombre}</span></div></td>
        <td className="px-6 py-4 text-sm text-slate-600">{record.escuela}</td><td className="px-6 py-4 text-sm">{record.gradoGrupo}</td><td className="px-6 py-4 text-sm text-slate-500">{record.createdAt ? new Date(record.createdAt).toLocaleDateString('es-MX') : ''}</td>
        <td className="px-6 py-4"><div className="flex justify-end gap-2">{isAdmin && <Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/fichas/editar/${record.id}`)}>Editar</Button>}<Button variant="outline" size="sm" leftIcon={<FileDown className="h-4 w-4" />} onClick={() => generateStudentRecordPdf(record)}>Descargar</Button></div></td>
      </tr>) : <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No hay fichas registradas.</td></tr>}</tbody>
    </table></div></div>
  </div>;
}
