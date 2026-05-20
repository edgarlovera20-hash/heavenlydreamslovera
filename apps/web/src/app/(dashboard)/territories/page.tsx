'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { get, post } from '@/lib/api';

interface Territory {
  id: string;
  nombre: string;
  zona: string;
  municipio: string;
  estado: string;
  createdAt: string;
}

export default function TerritoriesPage() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', zona: '', municipio: '', estado: '' });

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await get<Territory[]>('/territories');
      setTerritories(data);
    } catch {
      setTerritories([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      await post('/territories', form);
      toast.success('Territorio creado');
      setForm({ nombre: '', zona: '', municipio: '', estado: '' });
      setShowForm(false);
      load();
    } catch {
      toast.error('Error al crear territorio');
    }
  };

  const inputCls = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Territorios</h2>
          <p className="text-sm text-gray-400 mt-1">Gestión de zonas y territorios de venta</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} disabled={isLoading} className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-gray-300 hover:bg-gray-700 transition-colors">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">
            <Plus className="h-4 w-4" />
            Nuevo Territorio
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Agregar Territorio</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nombre</label>
              <input className={inputCls} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Zona Norte" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Zona</label>
              <input className={inputCls} value={form.zona} onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))} placeholder="Norte" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Municipio</label>
              <input className={inputCls} value={form.municipio} onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))} placeholder="Guadalajara" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Estado</label>
              <input className={inputCls} value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))} placeholder="Jalisco" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors">Cancelar</button>
            <button type="button" onClick={handleCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">Guardar</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        {territories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <MapPin className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No hay territorios registrados</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                {['Nombre', 'Zona', 'Municipio', 'Estado', 'Fecha', 'Acciones'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {territories.map((t) => (
                <tr key={t.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-200">{t.nombre}</td>
                  <td className="px-4 py-3 text-gray-400">{t.zona}</td>
                  <td className="px-4 py-3 text-gray-400">{t.municipio}</td>
                  <td className="px-4 py-3 text-gray-400">{t.estado}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(t.createdAt).toLocaleDateString('es-MX')}</td>
                  <td className="px-4 py-3">
                    <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-gray-700 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
