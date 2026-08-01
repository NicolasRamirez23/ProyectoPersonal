import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Building2, Eye, EyeOff, Loader2, LockKeyhole, UserRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { session, profile, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session && profile) {
      const requested = (location.state as { from?: string } | null)?.from;
      navigate(requested || (profile.rol === 'admin' ? '/' : profile.rol === 'cliente' ? '/cliente' : '/arquitectura/resumen'), { replace: true });
    }
  }, [session, profile, location.state, navigate]);

  if (session && profile) return <Navigate to={profile.rol === 'admin' ? '/' : profile.rol === 'cliente' ? '/cliente' : '/arquitectura/resumen'} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(`${username.trim().toLowerCase()}@avtech.local`, password);
    } catch {
      setError('Nombre de usuario o contraseña incorrectos, o el usuario todavía no tiene un perfil asignado.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <section className="hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-3 text-xl font-black"><div className="rounded-xl bg-white/15 p-2"><Building2 className="h-6 w-6" /></div>AVTECH</div>
        <div className="max-w-lg">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.3em] text-blue-200">Gestión centralizada</p>
          <h1 className="text-5xl font-black leading-tight">Tus proyectos y cobros, en un solo lugar.</h1>
          <p className="mt-5 text-lg leading-relaxed text-blue-100/80">Accede de forma segura según las responsabilidades de tu cuenta.</p>
        </div>
        <p className="text-xs text-blue-200/60">Sistema administrativo AvTech</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl sm:p-10">
          <div className="mb-8 lg:hidden"><p className="text-xl font-black text-white">AVTECH</p></div>
          <h2 className="text-3xl font-bold text-white">Iniciar sesión</h2>
          <p className="mt-2 text-sm text-slate-400">Ingresa con la cuenta asignada por el administrador.</p>
          <label className="mt-8 block text-sm font-medium text-slate-300">Nombre de usuario
            <div className="relative mt-2"><UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input type="text" required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ''))} placeholder="Ej. admin" className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950 pl-11 pr-4 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></div>
          </label>
          <label className="mt-5 block text-sm font-medium text-slate-300">Contraseña
            <div className="relative mt-2"><LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950 pl-11 pr-12 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:text-white">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          </label>
          {error && <p className="mt-5 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</p>}
          <button disabled={submitting} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-500 disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />} Entrar</button>
        </form>
      </section>
    </main>
  );
}
