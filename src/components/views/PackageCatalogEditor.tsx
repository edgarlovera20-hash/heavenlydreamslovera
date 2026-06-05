import React, { useEffect, useState, useMemo } from 'react';
import { Package, Plus, Trash2, Save, Edit2, X, Check } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { logAudit } from '../../lib/auditLog';
import { auth } from '../../lib/firebase';
import { toast } from 'sonner';
import { PackagesAPI } from '../../services/db';

export interface CatalogPackage {
  id: string;
  nombre: string;
  megas: number;
  rentaMensual: number;
  segmento: 'RESIDENCIAL' | 'EMPRESARIAL' | 'AMBOS';
  tipoCliente: 'NUEVO' | 'MIGRACION' | 'AMBOS';
  extras?: string[];
  activo: boolean;
}

const EMPTY: Omit<CatalogPackage, 'id'> = {
  nombre: '', megas: 100, rentaMensual: 399, segmento: 'RESIDENCIAL', tipoCliente: 'NUEVO', extras: [], activo: true,
};

export default function PackageCatalogEditor() {
  const [catalog, setCatalog] = useState<CatalogPackage[]>([]);
  const [loadError, setLoadError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Omit<CatalogPackage, 'id'>>(EMPTY);
  const [extrasInput, setExtrasInput] = useState('');

  const activeCount = useMemo(() => catalog.filter(p => p.activo).length, [catalog]);

  const loadCatalog = async () => {
    try {
      const rows = await PackagesAPI.getAll();
      setCatalog((Array.isArray(rows) ? rows : []).map((row: any) => ({
        id: row.id,
        nombre: row.nombre,
        megas: Number(row.megas || 0),
        rentaMensual: Number(row.precio ?? row.rentaMensual ?? 0),
        segmento: row.segmento || 'RESIDENCIAL',
        tipoCliente: row.tipo_cliente || row.tipoCliente || 'AMBOS',
        extras: row.descripcion ? String(row.descripcion).split(',').map(s => s.trim()).filter(Boolean) : [],
        activo: row.activo !== 0,
      })));
      setLoadError('');
    } catch (err) {
      setCatalog([]);
      setLoadError(err instanceof Error ? err.message : 'Backend no disponible');
    }
  };

  useEffect(() => { void loadCatalog(); }, []);

  const update = async (id: string, changes: Partial<CatalogPackage>) => {
    await PackagesAPI.update(id, {
      nombre: changes.nombre,
      megas: changes.megas,
      precio: changes.rentaMensual,
      descripcion: changes.extras?.join(', '),
      segmento: changes.segmento,
      tipo_cliente: changes.tipoCliente,
      activo: changes.activo === false ? 0 : 1,
    });
    await loadCatalog();
  };

  const startEdit = (pkg: CatalogPackage) => {
    setEditingId(pkg.id);
    setForm({ nombre: pkg.nombre, megas: pkg.megas, rentaMensual: pkg.rentaMensual, segmento: pkg.segmento, tipoCliente: pkg.tipoCliente, extras: pkg.extras || [], activo: pkg.activo });
    setExtrasInput((pkg.extras || []).join(', '));
    setShowNew(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const extras = extrasInput.split(',').map(s => s.trim()).filter(Boolean);
    await update(editingId, { ...form, extras });
    logAudit('VENTA_EDITADA', auth.currentUser?.uid || '', auth.currentUser?.displayName || '', { details: `Paquete editado: ${form.nombre}` });
    toast.success('Paquete actualizado.');
    setEditingId(null);
  };

  const createNew = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido.'); return; }
    const extras = extrasInput.split(',').map(s => s.trim()).filter(Boolean);
    await PackagesAPI.create({
      nombre: form.nombre,
      megas: form.megas,
      precio: form.rentaMensual,
      descripcion: extras.join(', '),
      segmento: form.segmento,
      tipo_cliente: form.tipoCliente,
    });
    await loadCatalog();
    logAudit('VENTA_EDITADA', auth.currentUser?.uid || '', auth.currentUser?.displayName || '', { details: `Paquete creado: ${form.nombre}` });
    toast.success('Paquete creado.');
    setForm(EMPTY); setExtrasInput(''); setShowNew(false);
  };

  const remove = async (id: string) => {
    await PackagesAPI.delete(id);
    await loadCatalog();
    toast.success('Paquete eliminado.');
  };

  const FormRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <label className="text-[10px] text-slate-500 uppercase font-bold">{label}</label>
      {children}
    </div>
  );

  const inputCls = "w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none";
  const selectCls = "w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none [color-scheme:dark]";

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-purple-400" />
            Catálogo de Paquetes
          </h1>
          <p className="text-slate-400 text-sm">{activeCount} paquetes activos · edita precios, megas y extras sin tocar el código.</p>
        </div>
        <button onClick={() => { setShowNew(true); setEditingId(null); setForm(EMPTY); setExtrasInput(''); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-xl text-xs font-bold hover:bg-purple-500/20 transition-colors">
          <Plus className="w-4 h-4" /> Nuevo paquete
        </button>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          No se pudo cargar el catálogo real del servidor: {loadError}
        </div>
      )}

      {/* New package form */}
      {showNew && (
        <div className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-purple-400">Nuevo paquete</p>
            <button onClick={() => setShowNew(false)} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormRow label="Nombre"><input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Ultra 500MB" className={inputCls} /></FormRow>
            <FormRow label="Megas"><input type="number" value={form.megas} onChange={e => setForm(f => ({ ...f, megas: +e.target.value }))} className={inputCls} /></FormRow>
            <FormRow label="Renta mensual $"><input type="number" value={form.rentaMensual} onChange={e => setForm(f => ({ ...f, rentaMensual: +e.target.value }))} className={inputCls} /></FormRow>
            <FormRow label="Segmento">
              <select value={form.segmento} onChange={e => setForm(f => ({ ...f, segmento: e.target.value as any }))} className={selectCls}>
                <option value="RESIDENCIAL">Residencial</option>
                <option value="EMPRESARIAL">Empresarial</option>
                <option value="AMBOS">Ambos</option>
              </select>
            </FormRow>
            <FormRow label="Tipo cliente">
              <select value={form.tipoCliente} onChange={e => setForm(f => ({ ...f, tipoCliente: e.target.value as any }))} className={selectCls}>
                <option value="NUEVO">Nuevo</option>
                <option value="MIGRACION">Migración</option>
                <option value="AMBOS">Ambos</option>
              </select>
            </FormRow>
            <FormRow label="Extras (coma separados)"><input value={extrasInput} onChange={e => setExtrasInput(e.target.value)} placeholder="WiFi gratis, instalación incluida" className={inputCls} /></FormRow>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-white/10 text-slate-300 rounded-xl text-xs font-bold hover:bg-white/5 transition-colors">Cancelar</button>
            <button onClick={createNew} className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-xl text-xs font-bold hover:bg-purple-500/30 transition-colors">
              <Check className="w-3.5 h-3.5" /> Crear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950/80">
              <tr>
                {['Paquete', 'Megas', 'Renta/mes', 'Segmento', 'Tipo', 'Extras', 'Activo', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {catalog.map(pkg => {
                const isEditing = editingId === pkg.id;
                return (
                  <tr key={pkg.id} className={cn('transition-colors', isEditing ? 'bg-purple-500/5' : 'hover:bg-white/5')}>
                    <td className="px-4 py-3">
                      {isEditing
                        ? <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={cn(inputCls, 'w-36')} />
                        : <span className="text-sm font-bold text-white">{pkg.nombre}</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {isEditing
                        ? <input type="number" value={form.megas} onChange={e => setForm(f => ({ ...f, megas: +e.target.value }))} className={cn(inputCls, 'w-20')} />
                        : <span className="text-sm text-cyan-400 font-bold">{pkg.megas} MB</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {isEditing
                        ? <input type="number" value={form.rentaMensual} onChange={e => setForm(f => ({ ...f, rentaMensual: +e.target.value }))} className={cn(inputCls, 'w-24')} />
                        : <span className="text-sm text-emerald-400 font-bold">{formatCurrency(pkg.rentaMensual)}</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {isEditing
                        ? <select value={form.segmento} onChange={e => setForm(f => ({ ...f, segmento: e.target.value as any }))} className={cn(selectCls, 'w-32')}><option value="RESIDENCIAL">Residencial</option><option value="EMPRESARIAL">Empresarial</option><option value="AMBOS">Ambos</option></select>
                        : <span className="text-xs text-slate-300">{pkg.segmento}</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {isEditing
                        ? <select value={form.tipoCliente} onChange={e => setForm(f => ({ ...f, tipoCliente: e.target.value as any }))} className={cn(selectCls, 'w-28')}><option value="NUEVO">Nuevo</option><option value="MIGRACION">Migración</option><option value="AMBOS">Ambos</option></select>
                        : <span className="text-xs text-slate-300">{pkg.tipoCliente}</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {isEditing
                        ? <input value={extrasInput} onChange={e => setExtrasInput(e.target.value)} placeholder="Extra1, Extra2" className={cn(inputCls, 'w-40')} />
                        : <span className="text-[10px] text-slate-400">{(pkg.extras || []).join(', ') || '—'}</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => update(pkg.id, { activo: !pkg.activo })}
                        className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors', pkg.activo ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-slate-700/30 border-slate-600/30 text-slate-500')}>
                        {pkg.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-white/5 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(pkg)} className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => remove(pkg.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
