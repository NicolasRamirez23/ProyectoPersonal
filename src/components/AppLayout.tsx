import { ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { 
  House, 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  CreditCard, 
  Menu, 
  Calendar, 
  User, 
  X,
  Sprout,
  ChevronDown, // 🚀 Nuevo para subcarpetas
  Building2    // 🚀 Icono para identificar el módulo de Propiedades
} from 'lucide-react';
import { DraftingCompass, Code2, ContactRound, PackageSearch, ReceiptText, Boxes, Landmark, FileSpreadsheet, Split, Scale, FileSearch, FolderKanban, ScanLine, FileInput } from 'lucide-react';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../auth/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // 🚀 Estado para controlar cuáles subcarpetas están abiertas (por su label)
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'Proyectos de Programación': true,
    'Proyectos Arquitectónicos': true,
    'Módulo General': true,
    'Importaciones Lara': true,
    'Herramientas bancarias': true,
    'Notaría': true,
  });

  const toggleFolder = (label: string) => {
    setOpenFolders((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // 🚀 Estructura nueva con soporte para carpetas (isFolder) e hijos (children)
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
    {
      label: 'Notaría',
      icon: Scale,
      roles: ['admin', 'notaria'],
      isFolder: true,
      children: [
        { to: '/notaria/expedientes', label: 'Expedientes', icon: FolderKanban, roles: ['admin', 'notaria'] },
        { to: '/notaria/recepcion', label: 'Documentos', icon: ScanLine, roles: ['admin', 'notaria'] },
        { to: '/notaria/calendario', label: 'Calendario', icon: Calendar, roles: ['admin', 'notaria'] },
        { to: '/notaria', label: 'Formatos', icon: FileSearch, roles: ['admin', 'notaria'] },
        { to: '/notaria/isabi', label: 'Expedientes ISABI', icon: FileInput, roles: ['admin', 'notaria'] },
      ]
    },
    {
      label: 'Herramientas bancarias',
      icon: Landmark,
      roles: ['admin'],
      isFolder: true,
      children: [
        { to: '/bancos/convertir', label: 'Estado de cuenta a Excel', icon: FileSpreadsheet },
        { to: '/bancos/conciliar', label: 'Conciliar pagos', icon: Split },
      ]
    },
    {
      label: 'Proyectos de Programación',
      icon: Code2,
      roles: ['admin'],
      isFolder: true,
      children: [
        { to: '/listado', label: 'Proyectos', icon: House },
        { to: '/registro', label: 'Nuevo proyecto', icon: PlusCircle },
        // 💡 Cuando quieras agregar más sub-módulos, solo colócalos aquí abajo:
        // { to: '/mantenimiento', label: 'Mantenimiento', icon: Wrench }
      ]
    },
    {
      label: 'Módulo General',
      icon: ContactRound,
      roles: ['admin', 'fichas'],
      isFolder: true,
      children: [
        { to: '/fichas', label: 'Fichas de estudiantes', icon: ContactRound },
        { to: '/fichas/nueva-interna', label: 'Nueva ficha', icon: PlusCircle },
      ]
    },
    {
      label: 'Importaciones Lara',
      icon: PackageSearch,
      roles: ['admin', 'importaciones_lara'],
      isFolder: true,
      children: [
        { to: '/importaciones-lara', label: 'Recibos', icon: ReceiptText },
        { to: '/importaciones-lara/nuevo', label: 'Nuevo recibo', icon: PlusCircle },
        { to: '/importaciones-lara/inventario', label: 'Control de inventario', icon: Boxes },
      ]
    },
    {
      label: 'Proyectos Arquitectónicos',
      icon: DraftingCompass,
      roles: ['admin', 'arquitectura'],
      isFolder: true,
      children: [
        { to: '/arquitectura/resumen', label: 'Resumen', icon: LayoutDashboard },
        { to: '/arquitectura', label: 'Proyectos', icon: Building2 },
        { to: '/arquitectura/nuevo', label: 'Nuevo proyecto', icon: PlusCircle },
      ]
    },
    { to: '/catalogos', label: 'Catálogos', icon: Settings, roles: ['admin', 'arquitectura'] },
    { to: '/cliente', label: 'Mis proyectos', icon: Building2, roles: ['cliente'] },
    // {
    //   label: 'Fumigación',
    //   icon: Sprout,
    //   isFolder: true,
    //   children: [
    //     { to: '/calendario', label: 'Calendario', icon: Calendar },
    //     { to: '/clienteFumigacion', label: 'Nuevo Cliente', icon: User },
    //     // 💡 Cuando quieras agregar más sub-módulos, solo colócalos aquí abajo:
    //     // { to: '/mantenimiento', label: 'Mantenimiento', icon: Wrench }
    //   ]
    // },
  ].filter((item) => item.roles.includes(profile?.rol || 'arquitectura'));

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 transform transition-transform lg:translate-x-0 lg:static flex flex-col shadow-xl lg:shadow-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              C
            </div>
            <span className="font-bold text-xl tracking-tight text-white">AvTech</span>
          </Link>
        </div>

        {/* 🚀 Sistema Avanzado de Navegación por Carpetas */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            
            // CASO A: Es una carpeta desplegable
            if (item.isFolder) {
              const isFolderOpen = !!openFolders[item.label];
              const FolderIcon = item.icon;
              const hasActiveChild = item.children?.some((child) => child.to === '/notaria'
                ? location.pathname === child.to
                : location.pathname === child.to || location.pathname.startsWith(`${child.to}/`));

              return (
                <div key={item.label} className="space-y-1">
                  {/* Botón de la carpeta contenedora */}
                  <button
                    type="button"
                    onClick={() => toggleFolder(item.label)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all font-medium",
                      hasActiveChild
                        ? "border-slate-700 bg-slate-800/90 text-slate-100 shadow-sm"
                        : "border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <FolderIcon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform duration-200 text-slate-500",
                      isFolderOpen && "transform rotate-180 text-white"
                    )} />
                  </button>

                  {/* Sub-elementos animados con Framer Motion */}
                  <AnimatePresence initial={false}>
                    {isFolderOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="relative ml-7 space-y-1 overflow-hidden border-l-2 border-slate-700/80 pb-1 pl-5 pt-1"
                      >
                        {item.children?.filter((child) => !child.roles || child.roles.includes(profile?.rol || 'arquitectura')).map((child) => {
                          const ChildIcon = child.icon;
                          return (
                            <NavLink
                              key={child.to}
                              to={child.to}
                              end={child.to === '/notaria'}
                              onClick={() => setIsSidebarOpen(false)}
                              className={({ isActive }) => cn(
                                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all before:absolute before:-left-[22px] before:top-1/2 before:h-px before:w-4 before:bg-slate-700",
                                isActive 
                                  ? "bg-blue-500/10 text-blue-400 font-semibold ring-1 ring-inset ring-blue-400/15 before:bg-blue-400 [&>span:first-child]:border-blue-400 [&>span:first-child]:bg-blue-400"
                                  : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-200"
                              )}
                            >
                              <span className="absolute -left-[26px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border-2 border-slate-700 bg-slate-900 transition-colors" />
                              <ChildIcon className="h-4 w-4 shrink-0 opacity-80" />
                              <span>{child.label}</span>
                            </NavLink>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            // CASO B: Link directo e independiente (Como Dashboard)
            const LinkIcon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                  isActive 
                    ? "bg-slate-800 text-white shadow-sm border border-slate-700" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                )}
              >
                <LinkIcon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full relative">
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 sticky top-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-slate-600"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex-1 lg:max-w-md mx-6">
             <div className="flex items-center bg-slate-100 rounded-full px-4 py-2 w-full border border-slate-200/50">
               <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
               <input type="text" placeholder="Buscar proyecto por nombre o folio..." className="bg-transparent border-none text-sm ml-3 focus:ring-0 w-full outline-none text-slate-600" />
             </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-800 leading-none">{profile?.nombre || 'Usuario'}</p>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">{profile?.rol === 'admin' ? 'Administrador' : profile?.rol === 'cliente' ? 'Cliente' : profile?.rol === 'fichas' ? 'FICHAS' : profile?.rol === 'importaciones_lara' ? 'IMPORTACIONES LARA' : profile?.rol === 'notaria' ? 'NOTARÍA' : 'Arquitectura'}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold shadow-sm">
              {(profile?.nombre || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
