'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Trash2, Edit2, X, Check, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { get, post, patch, del } from '@/lib/api';

// ── types ────────────────────────────────────────────────────

interface CatalogPackage {
  id: string;
  nombre: string;
  megas: number | null;
  precio: number | null;
  descripcion: string | null;
  active: boolean;
  createdAt: string;
}

interface PackageForm {
  nombre: string;
  megas: string;
  precio: string;
  descripcion: string;
  active: boolean;
}

const EMPTY_FORM: PackageForm = { nombre: '', megas: '', precio: '', descripcion: '', active: true };

function formatCurrency(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);
}

// ── component ────────────────────────────────────────────────

export default function PackagesPage() {
  const [packages, setPackages] = useState<CatalogPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<PackageForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<CatalogPackage[]>('/packages');
      setPackages(data ?? []);
    } catch {
      toast.error('Error al cargar paquetes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (pkg: CatalogPackage) => {
    setEditingId(pkg.id);
    setForm({
      nombre: pkg.nombre,
      megas: pkg.megas?.toString() ?? '',
      precio: pkg.precio?.toString() ?? '',
      descripcion: pkg.descripcion ?? '',
      active: pkg.active,
    });
    setShowNew(false);
  };

  const cancelEdit = () => { setEditingId(null); setShowNew(false); setForm(EMPTY_FORM); };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await patch(`/packages/${editingId}`, {
        nombre: form.nombre,
        megas: form.megas ? Number(form.megas) : undefined,
        precio: form.precio ? Number(form.precio) : undefined,
        descripcion: form.descripcion || undefined,
        active: form.active,
      });
      toast.success('Paquete actualizado');
      cancelEdit();
      await load();
    } catch {
      toast.error('Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const createNew = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      await post('/packages', {
        nombre: form.nombre,
        megas: form.megas ? Number(form.megas) : undefined,
        precio: form.precio ? Number(form.precio) : undefined,
        descripcion: form.descripcion || undefined,
        active: form.active,
      });
      toast.success('Paquete creado');
      cancelEdit();
      await load();
    } catch {
      toast.error('Error al crear paquete');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await del(`/packages/${id}`);
      toast.success('Paquete eliminado');
      await load();
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = packages.filter((p) => p.active).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/50">
            <Package className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Catálogo de Paquetes</h2>
            <p className="text-sm text-gray-400">
              {activeCount} paquetes activos de {packages.length} totales
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => { setShowNew(true); setEditingId(null); setForm(EMPTY_FORM); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo paquete
          </button>
        </div>
      </div>

      {/* New package form */}
      {showNew && (
        <div className="rounded-xl border border-emerald-500/30 bg-gray-900 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-emerald-400">Nuevo paquete</h3>
          <PackageForm form={form} onChange={setForm} />
          <div className="flex gap-2">
            <button
              onClick={createNew}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Guardar
            </button>
            <button onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm hover:bg-gray-800 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Package list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Cargando paquetes…
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-16">
          <Package className="mx-auto h-10 w-10 text-gray-600 mb-3" />
          <p className="text-gray-400">No hay paquetes registrados</p>
          <button
            onClick={() => setShowNew(true)}
            className="mt-3 text-sm text-emerald-400 hover:text-emerald-300"
          >
            Crear el primer paquete
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={clsx(
                'rounded-xl border p-5 space-y-3',
                pkg.active ? 'border-gray-700 bg-gray-900' : 'border-gray-800 bg-gray-900/50 opacity-60',
              )}
            >
              {editingId === pkg.id ? (
                <>
                  <PackageForm form={form} onChange={setForm} />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-60 transition-colors"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Guardar
                    </button>
                    <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 text-xs hover:bg-gray-800 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white text-sm">{pkg.nombre}</h3>
                        {!pkg.active && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-gray-400">inactivo</span>
                        )}
                      </div>
                      {pkg.descripcion && (
                        <p className="text-xs text-gray-500 mt-0.5">{pkg.descripcion}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(pkg)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(pkg.id)}
                        disabled={deletingId === pkg.id}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        {deletingId === pkg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-800/50 px-3 py-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Precio</p>
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(pkg.precio)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-800/50 px-3 py-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Megas</p>
                      <p className="text-lg font-bold text-blue-400">{pkg.megas ?? '—'}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── sub-form ─────────────────────────────────────────────────

function PackageForm({ form, onChange }: { form: PackageForm; onChange: (f: PackageForm) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <label className="block text-xs text-gray-400 mb-1">Nombre *</label>
        <input
          value={form.nombre}
          onChange={(e) => onChange({ ...form, nombre: e.target.value })}
          placeholder="ej. Básico 100MB"
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Precio (MXN)</label>
        <input
          type="number"
          value={form.precio}
          onChange={(e) => onChange({ ...form, precio: e.target.value })}
          placeholder="399"
          min={0}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Megas</label>
        <input
          type="number"
          value={form.megas}
          onChange={(e) => onChange({ ...form, megas: e.target.value })}
          placeholder="100"
          min={0}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs text-gray-400 mb-1">Descripción</label>
        <input
          value={form.descripcion}
          onChange={(e) => onChange({ ...form, descripcion: e.target.value })}
          placeholder="Descripción opcional"
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => onChange({ ...form, active: e.target.checked })}
          className="w-4 h-4 rounded accent-emerald-500"
        />
        <span className="text-sm text-gray-300">Activo</span>
      </label>
    </div>
  );
}
