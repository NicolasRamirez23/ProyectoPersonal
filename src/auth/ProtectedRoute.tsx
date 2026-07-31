import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppRole, useAuth } from './AuthContext';

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: AppRole[] }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-medium text-slate-300">Cargando sesión...</div>;
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(profile.rol)) {
    return <Navigate to={profile.rol === 'arquitectura' ? '/arquitectura' : '/'} replace />;
  }
  return <Outlet />;
}
