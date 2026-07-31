import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, GripVertical, Loader2, Plus, Power, Save, Trash2, X } from 'lucide-react';
import { Catalog, catalogsService, CatalogValue } from '../services/catalogs';

export function CatalogsPage() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selected = useMemo(() => catalogs.find((catalog) => catalog.key === selectedKey), [catalogs, selectedKey]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await catalogsService.getAll();
      setCatalogs(data);
      setSelectedKey((current) => current || data[0]?.key || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los catálogos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const addValue = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !newValue.trim()) return;
    setSaving(true);
    setError('');
    try {
      const nextOrder = Math.max(0, ...selected.values.map((value) => value.order)) + 10;
      await catalogsService.addValue(selected.id, newValue, nextOrder);
      setNewValue('');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo agregar el valor.');
    } finally {
      setSaving(false);
    }
  };

  const updateValue = async (value: CatalogValue, patch: Partial<CatalogValue>) => {
    setError('');
    try {
      await catalogsService.updateValue(value.id, patch);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar el valor.');
    }
  };

  const removeValue = async (value: CatalogValue) => {
    if (!window.confirm(`¿Eliminar "${value.value}" del catálogo? Los proyectos existentes conservarán el texto guardado.`)) return;
    setError('');
    try {
      await catalogsService.removeValue(value.id);
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'No se pudo eliminar el valor.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Catálogos</h1>
        <p className="mt-1 text-slate-500">Administra las opciones utilizadas en los formularios del sistema.</p>
      </div>

      {error && <div className="flex items-start justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"><span>{error}</span><button onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}

      {loading && !catalogs.length ? (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-20 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando catálogos...</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Selecciona un catálogo</p>
            <div className="space-y-1">
              {catalogs.map((catalog) => (
                <button key={catalog.id} onClick={() => setSelectedKey(catalog.key)} className={`w-full rounded-xl px-4 py-3 text-left transition ${selectedKey === catalog.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <span className="flex items-center justify-between gap-2"><span className="text-sm font-bold">{catalog.name}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selectedKey === catalog.key ? 'bg-white/20' : 'bg-slate-100'}`}>{catalog.values.length}</span></span>
                </button>
              ))}
            </div>
          </aside>

          {selected && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 p-6">
                <div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><BookOpen className="h-5 w-5" /></div><div><h2 className="text-xl font-bold text-slate-900">{selected.name}</h2><p className="text-sm text-slate-500">{selected.description}</p></div></div>
                <form onSubmit={addValue} className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <input required value={newValue} onChange={(event) => setNewValue(event.target.value)} placeholder="Escribe un nuevo valor..." className="h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                  <button disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar valor</button>
                </form>
              </header>

              <div className="divide-y divide-slate-100">
                {selected.values.map((value) => (
                  <CatalogValueRow key={value.id} value={value} onUpdate={updateValue} onRemove={removeValue} />
                ))}
                {!selected.values.length && <p className="p-10 text-center text-sm text-slate-400">Este catálogo todavía no tiene valores.</p>}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function CatalogValueRow({ value, onUpdate, onRemove }: { value: CatalogValue; onUpdate: (value: CatalogValue, patch: Partial<CatalogValue>) => Promise<void>; onRemove: (value: CatalogValue) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(value.value);
  const [order, setOrder] = useState(String(value.order));

  return (
    <div className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${!value.active ? 'bg-slate-50 opacity-65' : ''}`}>
      <GripVertical className="hidden h-5 w-5 shrink-0 text-slate-300 sm:block" />
      {editing ? (
        <>
          <input value={name} onChange={(event) => setName(event.target.value)} className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" />
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500">Orden<input type="number" value={order} onChange={(event) => setOrder(event.target.value)} className="h-10 w-20 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" /></label>
          <button onClick={() => { void onUpdate(value, { value: name, order: Number(order) }); setEditing(false); }} className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600 hover:bg-emerald-100" title="Guardar"><Check className="h-4 w-4" /></button>
          <button onClick={() => { setName(value.value); setOrder(String(value.order)); setEditing(false); }} className="rounded-lg bg-slate-100 p-2.5 text-slate-500 hover:bg-slate-200" title="Cancelar"><X className="h-4 w-4" /></button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1"><p className="font-bold text-slate-700">{value.value}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">Orden {value.order} · {value.active ? 'Activo' : 'Inactivo'}</p></div>
          <button onClick={() => setEditing(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Save className="h-3.5 w-3.5" /> Editar</button>
          <button onClick={() => void onUpdate(value, { active: !value.active })} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${value.active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}><Power className="h-3.5 w-3.5" /> {value.active ? 'Desactivar' : 'Activar'}</button>
          <button onClick={() => void onRemove(value)} className="rounded-lg border border-red-100 p-2.5 text-red-500 hover:bg-red-50" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
        </>
      )}
    </div>
  );
}
