import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, Check, Edit3, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';

const STATES = ['disponible', 'asignado', 'danado', 'baja'];
const TYPES = ['modem', 'sim', 'uniforme', 'herramienta', 'otro'];

type InventoryItem = {
  id: string;
  sku?: string;
  tipo: string;
  nombre: string;
  serial?: string;
  estado: string;
  assigned_to?: string;
  sale_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

const emptyForm = {
  sku: '',
  tipo: 'modem',
  nombre: '',
  serial: '',
  estado: 'disponible',
  assigned_to: '',
  sale_id: '',
  notes: '',
};

function badgeClass(status: string) {
  if (status === 'disponible') return 'border-emerald-400/30 text-emerald-300 bg-emerald-400/5';
  if (status === 'asignado') return 'border-cyan-400/30 text-cyan-300 bg-cyan-400/5';
  if (status === 'danado') return 'border-amber-400/30 text-amber-300 bg-amber-400/5';
  return 'border-rose-400/30 text-rose-300 bg-rose-400/5';
}

export default function InventoryView() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [stateFilter, setStateFilter] = useState('todos');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inventory');
      if (!res.ok) throw new Error('No se pudo cargar inventario.');
      setItems(await res.json());
    } catch (err: any) {
      setError(err.message || 'Error al cargar inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => {
      const matchesText = !needle || [item.nombre, item.sku, item.serial, item.assigned_to, item.sale_id]
        .some(value => String(value || '').toLowerCase().includes(needle));
      const matchesType = typeFilter === 'todos' || item.tipo === typeFilter;
      const matchesState = stateFilter === 'todos' || item.estado === stateFilter;
      return matchesText && matchesType && matchesState;
    });
  }, [items, query, typeFilter, stateFilter]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const edit = (item: InventoryItem) => {
    setEditingId(item.id);
    setForm({
      sku: item.sku || '',
      tipo: item.tipo || 'modem',
      nombre: item.nombre || '',
      serial: item.serial || '',
      estado: item.estado || 'disponible',
      assigned_to: item.assigned_to || '',
      sale_id: item.sale_id || '',
      notes: item.notes || '',
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value || null]));
      const res = await fetch(editingId ? `/api/inventory/${editingId}` : '/api/inventory', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el activo.');
      resetForm();
      await load();
    } catch (err: any) {
      setError(err.message || 'Error al guardar inventario.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (item: InventoryItem, estado: string) => {
    const res = await fetch(`/api/inventory/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    if (res.ok) load();
  };

  const remove = async (item: InventoryItem) => {
    if (!confirm(`Eliminar activo ${item.nombre}?`)) return;
    const res = await fetch(`/api/inventory/${item.id}`, { method: 'DELETE' });
    if (res.ok) load();
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-cyan-300" /> Inventario
          </h2>
          <p className="text-xs text-slate-400 mt-1">Activos, equipos, SIMs, uniformes y asignaciones operativas.</p>
        </div>
        <button onClick={load} className="h-9 px-3 rounded-lg border border-cyan-400/30 text-cyan-200 hover:bg-cyan-400/10 flex items-center gap-2 text-xs font-bold uppercase">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {error && <div className="border border-rose-400/30 bg-rose-400/10 text-rose-100 rounded-lg p-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
        <form onSubmit={save} className="border border-slate-800 bg-[#0a0d14]/80 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">{editingId ? 'Editar activo' : 'Nuevo activo'}</h3>
            {editingId && (
              <button type="button" onClick={resetForm} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" aria-label="Cancelar edicion">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del activo" className="w-full rounded-lg bg-black/30 border border-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="rounded-lg bg-black/30 border border-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50">
              {TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="rounded-lg bg-black/30 border border-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50">
              {STATES.map(state => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="SKU" className="rounded-lg bg-black/30 border border-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
            <input value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} placeholder="Serie / ICCID" className="rounded-lg bg-black/30 border border-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
          </div>
          <input value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} placeholder="Asignado a usuario/agente" className="w-full rounded-lg bg-black/30 border border-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
          <input value={form.sale_id} onChange={e => setForm({ ...form, sale_id: e.target.value })} placeholder="Venta o contrato relacionado" className="w-full rounded-lg bg-black/30 border border-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notas" className="w-full h-20 rounded-lg bg-black/30 border border-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
          <button disabled={saving} className="w-full h-10 rounded-lg bg-cyan-500 text-black text-xs font-black uppercase flex items-center justify-center gap-2 disabled:opacity-60">
            {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {saving ? 'Guardando' : editingId ? 'Guardar cambios' : 'Crear activo'}
          </button>
        </form>

        <section className="border border-slate-800 bg-[#0a0d14]/80 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-800 grid grid-cols-1 md:grid-cols-[1fr_160px_160px] gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, SKU, serie, asignado..." className="w-full rounded-lg bg-black/30 border border-slate-800 pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50" />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="rounded-lg bg-black/30 border border-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50">
              <option value="todos">Todos los tipos</option>
              {TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="rounded-lg bg-black/30 border border-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50">
              <option value="todos">Todos los estados</option>
              {STATES.map(state => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="text-left p-3">Activo</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-left p-3">Asignacion</th>
                  <th className="text-right p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b border-slate-900 hover:bg-white/[0.02]">
                    <td className="p-3">
                      <p className="font-semibold text-white">{item.nombre}</p>
                      <p className="text-[11px] text-slate-500">{item.serial || item.sku || 'sin serie'}</p>
                    </td>
                    <td className="p-3 text-slate-300 uppercase text-xs">{item.tipo}</td>
                    <td className="p-3">
                      <select value={item.estado} onChange={e => updateStatus(item, e.target.value)} className={`rounded border px-2 py-1 text-[10px] font-bold uppercase ${badgeClass(item.estado)} bg-[#0a0d14]`}>
                        {STATES.map(state => <option key={state} value={state}>{state}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <p className="text-xs text-slate-300">{item.assigned_to || 'Sin asignar'}</p>
                      {item.sale_id && <p className="text-[10px] text-cyan-300">{item.sale_id}</p>}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => edit(item)} className="p-2 rounded-lg border border-cyan-400/20 text-cyan-300 hover:bg-cyan-400/10" aria-label="Editar activo">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(item)} className="p-2 rounded-lg border border-rose-400/20 text-rose-300 hover:bg-rose-400/10" aria-label="Eliminar activo">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">Sin activos para los filtros actuales.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
