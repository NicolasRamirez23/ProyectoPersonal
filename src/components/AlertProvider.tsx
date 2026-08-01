import { createContext, ReactNode, useContext, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';

type AlertType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; type: AlertType; title: string; message?: string }
interface Dialog {
  kind: 'confirm' | 'prompt';
  title: string;
  message: string;
  confirmText: string;
  danger?: boolean;
  required?: boolean;
  placeholder?: string;
  resolve: (value: boolean | string | null) => void;
}
interface AlertContextValue {
  notify: (type: AlertType, title: string, message?: string) => void;
  confirm: (title: string, message: string, options?: { confirmText?: string; danger?: boolean }) => Promise<boolean>;
  prompt: (title: string, message: string, options?: { confirmText?: string; required?: boolean; placeholder?: string; danger?: boolean }) => Promise<string | null>;
}
const AlertContext = createContext<AlertContextValue | null>(null);

const styles = {
  success: { icon: CheckCircle2, color: 'border-emerald-200 bg-emerald-50 text-emerald-800', iconColor: 'text-emerald-600' },
  error: { icon: ShieldAlert, color: 'border-red-200 bg-red-50 text-red-800', iconColor: 'text-red-600' },
  warning: { icon: AlertTriangle, color: 'border-amber-200 bg-amber-50 text-amber-800', iconColor: 'text-amber-600' },
  info: { icon: Info, color: 'border-blue-200 bg-blue-50 text-blue-800', iconColor: 'text-blue-600' },
};

export function AlertProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [input, setInput] = useState('');
  const nextId = useRef(1);

  const notify: AlertContextValue['notify'] = (type, title, message) => {
    const id = nextId.current++;
    setToasts((items) => [...items, { id, type, title, message }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5000);
  };
  const confirm: AlertContextValue['confirm'] = (title, message, options = {}) =>
    new Promise((resolve) => setDialog({ kind: 'confirm', title, message, confirmText: options.confirmText || 'Confirmar', danger: options.danger, resolve }));
  const prompt: AlertContextValue['prompt'] = (title, message, options = {}) =>
    new Promise((resolve) => { setInput(''); setDialog({ kind: 'prompt', title, message, confirmText: options.confirmText || 'Continuar', required: options.required, placeholder: options.placeholder, danger: options.danger, resolve }); });
  const closeDialog = (value: boolean | string | null) => { dialog?.resolve(value); setDialog(null); setInput(''); };

  return <AlertContext.Provider value={{ notify, confirm, prompt }}>
    {children}
    <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[min(92vw,390px)] flex-col gap-3">
      {toasts.map((toast) => {
        const config = styles[toast.type]; const Icon = config.icon;
        return <div key={toast.id} className={`pointer-events-auto flex gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur ${config.color}`}>
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconColor}`} />
          <div className="min-w-0 flex-1"><p className="text-sm font-bold">{toast.title}</p>{toast.message && <p className="mt-1 text-xs leading-relaxed opacity-80">{toast.message}</p>}</div>
          <button onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}><X className="h-4 w-4 opacity-60" /></button>
        </div>;
      })}
    </div>
    {dialog && <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className={`mb-4 inline-flex rounded-xl p-3 ${dialog.danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{dialog.danger ? <AlertTriangle className="h-6 w-6" /> : <Info className="h-6 w-6" />}</div>
        <h2 className="text-xl font-bold text-slate-900">{dialog.title}</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">{dialog.message}</p>
        {dialog.kind === 'prompt' && <textarea autoFocus rows={3} value={input} onChange={(event) => setInput(event.target.value)} placeholder={dialog.placeholder} className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />}
        <div className="mt-6 flex justify-end gap-2"><button onClick={() => closeDialog(dialog.kind === 'confirm' ? false : null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button><button disabled={dialog.kind === 'prompt' && dialog.required && !input.trim()} onClick={() => closeDialog(dialog.kind === 'confirm' ? true : input)} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 ${dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{dialog.confirmText}</button></div>
      </div>
    </div>}
  </AlertContext.Provider>;
}
export function useAlerts() { const value = useContext(AlertContext); if (!value) throw new Error('useAlerts requiere AlertProvider'); return value; }
