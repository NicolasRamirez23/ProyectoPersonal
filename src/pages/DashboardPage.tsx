import { useProjectStore } from '../store/useProjectStore';
import { useEffect, useState } from 'react';
import { 
  Building2, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  CreditCard,
  ArrowRight
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export function DashboardPage() {
  const { projects, fetchProjects } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, []);

  const totalMonthlyIncome = projects.reduce((acc, w) => acc + w.monthlyCost, 0);
  const recentProjects = projects.slice(-3).reverse();

  const stats = [
    { label: 'Total Proyectos', value: projects.length, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Ingreso Estimado', value: formatCurrency(totalMonthlyIncome), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pagos Pendientes', value: '5', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Proyectos Activos', value: projects.length, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-indigo-50' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard General</h1>
        <p className="text-slate-500 mt-1">Resumen del estado actual de tus proyectos.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label} 
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"
          >
            <div className={`p-2 w-fit rounded-xl ${stat.bg} ${stat.color} mb-4`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800">Proyectos Recientes</h3>
            <Link to="/listado" className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {recentProjects.length > 0 ? recentProjects.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-600 font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">
                    {w.ownerName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{w.ownerName}</p>
                    <p className="text-xs font-mono text-blue-500">{w.folio}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(w.monthlyCost)}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">MENSUAL</p>
                </div>
              </div>
            )) : (
              <p className="text-center py-8 text-slate-400 text-sm italic">No hay proyectos registrados todavía.</p>
            )}
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden flex flex-col justify-between border border-slate-800">
          <div className="relative z-10">
            <CreditCard className="h-12 w-12 text-blue-500 mb-6" />
            <h3 className="text-2xl font-bold mb-2">Control de Flujo</h3>
            <p className="text-slate-400 text-sm leading-relaxed opacity-90">
              Mantén el control total de tus ingresos por proyectos. El sistema genera automáticamente los plazos de pago para cada proyecto.
            </p>
          </div>
          <div className="mt-8 relative z-10">
             <Link to="/listado">
               <button className="bg-blue-600 py-3 px-8 rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 w-full sm:w-auto">
                 Ver Pagos Pendientes
               </button>
             </Link>
          </div>
          
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-blue-600/10 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 bg-slate-100/5 rounded-full blur-3xl opacity-30" />
        </div>
      </div>
    </div>
  );
}
