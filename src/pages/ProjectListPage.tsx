import { useEffect, useState } from 'react';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Search, Plus, Filter, MoreHorizontal, ChevronLeft, ChevronRight, Phone, Calendar, DollarSign, User } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { PaymentSection } from '../components/PaymentSection';
import { mockApi } from '../services/api';

export function ProjectListPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<any | null>(null);
  const [isHudOpen, setIsHudOpen] = useState(false);
  const [isPaymentsOpen, setIsPaymentsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  // Función para consultar la API directamente
  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const data = await mockApi.getProjects();
      setDepartments(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // 🚀 Buscador adaptado a las nuevas columnas
  const filtered = departments.filter(d => 
    d.cliente_nombre.toLowerCase().includes(search.toLowerCase()) ||
    d.id.toString().includes(search) ||
    d.cliente_celular.includes(search)
  );

  const paginated = filtered.slice((page - 1) * 10, page * 10);
  const totalPages = Math.ceil(filtered.length / 10);

  const openHud = (d: any) => {
    setSelectedDepartment(d);
    setIsHudOpen(true);
  };

  const handleEdit = () => {
    if (selectedDepartment) {
      navigate(`/editar/${selectedDepartment.id}`);
    }
  };

  const handlePay = () => {
    setIsHudOpen(false);
    setIsPaymentsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Proyectos de programación</h1>
          <p className="text-slate-500 mt-1">Gestiona y monitorea todos los contratos y plazos de pago activos.</p>
        </div>
        <Button 
          onClick={() => navigate('/registro')} 
          leftIcon={<Plus className="h-5 w-5" />}
          className="shadow-md"
        >
          Nuevo Proyecto
        </Button>
      </div>

      {/* Buscador */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input 
            placeholder="Buscar por nombre de cliente, celular o ID..." 
            className="pl-10 h-11"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Button variant="outline" className="h-11" leftIcon={<Filter className="h-4 w-4" />}>
          Filtros
        </Button>
      </div>

      {/* Tabla de Resultados */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID / Cliente</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Celular</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Esquema de Pagos</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha Inicio</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    Cargando proyectos desde la base de datos...
                  </td>
                </tr>
              ) : paginated.length > 0 ? paginated.map((d) => (
                <tr 
                  key={d.id} 
                  className="hover:bg-blue-50/50 transition-all cursor-pointer group border-l-4 border-l-transparent hover:border-l-blue-600"
                  onClick={() => openHud(d)}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">
                        {d.cliente_nombre.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{d.cliente_nombre}</p>
                        <p className="text-xs font-mono text-blue-600 font-medium">Proyecto #{d.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm text-slate-700 font-medium flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" /> {d.cliente_celular}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(d.pago)}</p>
                    <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tighter">Frecuencia: {d.tipo_pago}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-xs text-slate-600 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" /> {d.fecha_inicio}
                    </p>
                  </td>
                  <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No se encontraron proyectos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Mostrando {paginated.length} de {filtered.length} resultados
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal - Ficha Técnica */}
      <Modal 
        isOpen={isHudOpen} 
        onClose={() => setIsHudOpen(false)} 
        title={`Resumen de Contrato - Proyecto #${selectedDepartment?.id}`}
      >
        <div className="-mx-6 -mt-6">
          <div className="p-6 bg-slate-900 text-white rounded-t-lg">
             <div className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-1">Ficha Técnica</div>
             <h3 className="text-2xl font-bold">Proyecto #{selectedDepartment?.id}</h3>
             <p className="text-slate-400 text-sm">Estatus Comercial</p>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-2 tracking-widest">Información del Cliente</label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-lg">
                  {selectedDepartment?.cliente_nombre.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-base">{selectedDepartment?.cliente_nombre}</div>
                  <div className="text-xs text-blue-600 font-semibold underline flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" /> {selectedDepartment?.cliente_celular}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 tracking-tighter">Pago Frecuente</label>
                <div className="text-base font-bold text-slate-900">{formatCurrency(selectedDepartment?.pago || 0)}</div>
                <span className="text-[10px] text-slate-400 capitalize">{selectedDepartment?.tipo_pago}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 tracking-tighter">Pago Inicial / Enganche</label>
                <div className="text-base font-bold text-slate-900">{formatCurrency(selectedDepartment?.pago_inicial || 0)}</div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-3 tracking-widest">Fechas clave</label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 font-medium">Firma de Contrato</span>
                  <span className="text-sm text-slate-900 font-bold">{selectedDepartment?.fecha_firma_contrato}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 font-medium">Primer Pago Vence</span>
                  <span className="text-sm text-slate-900 font-bold">{selectedDepartment?.fecha_inicio}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 rounded-b-xl flex gap-3">
            <Button variant="outline" className="flex-1 font-bold h-12" onClick={handleEdit}>
              Editar Contrato
            </Button>
            <Button className="flex-1 font-bold h-12 shadow-lg shadow-blue-100" onClick={handlePay}>
              Mostrar Plazos
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Pagos */}
      <Modal 
        isOpen={isPaymentsOpen} 
        onClose={() => setIsPaymentsOpen(false)} 
        title={`Historial de Pagos - ${selectedDepartment?.cliente_nombre}`}
      >
        {selectedDepartment && <PaymentSection proyecto={selectedDepartment} />}
      </Modal>
    </div>
  );
}
