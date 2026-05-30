import React, { useEffect, useState, useMemo } from 'react';
import { MapPin, Plus, Trash2, Save, Search, User, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { logAudit } from '../../lib/auditLog';
import { auth } from '../../lib/firebase';
import { toast } from 'sonner';
import { TerritoriesAPI, UsersAPI } from '../../services/db';

interface Territory {
  id: string;
  colonia: string;
  delegacion: string;
  asesorId: string;
  asesorName: string;
  createdAt: string;
}

export default function TerritoriesView() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<{ uid: string; displayName?: string; email?: string; role?: string }[]>([]);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [colonia, setColonia] = useState('');
  const [delegacion, setDelegacion] = useState('');
  const [asesorId, setAsesorId] = useState('');
  const promotors = useMemo(() => users.filter(u => ['ASESOR', 'VENDEDOR', 'SUPERVISOR'].includes(String(u.role || '').toUpperCase())), [users]);

  const loadData = async () => {
    try {
      const [territoryRows, userRows] = await Promise.all([TerritoriesAPI.getAll(), UsersAPI.getAll()]);
      const normalizedUsers = (Array.isArray(userRows) ? userRows : []).map((u: any) => ({
        ...u,
        displayName: u.displayName || u.nombre || u.username || u.email,
        role: String(u.role || '').toUpperCase(),
      }));
      setUsers(normalizedUsers);
      setTerritories((Array.isArray(territoryRows) ? territoryRows : []).map((row: any) => {
        const [colonia, delegacion = ''] = String(row.nombre || '').split(',').map((part) => part.trim());
        const assigned = normalizedUsers.find((u: any) => u.uid === row.asesor_id);
        return {
          id: row.id,
          colonia: colonia || row.nombre || 'Sin nombre',
          delegacion,
          asesorId: row.asesor_id || '',
          asesorName: assigned?.displayName || row.asesor_id || 'Sin asignar',
          createdAt: row.created_at || new Date().toISOString(),
        };
      }));
      setLoadError('');
    } catch (err) {
      setTerritories([]);
      setUsers([]);
      setLoadError(err instanceof Error ? err.message : 'Backend no disponible');
    }
  };

  useEffect(() => { void loadData(); }, []);

  const filtered = useMemo(() =>
    territories.filter(t => {
      const q = search.toLowerCase();
      return !q || t.colonia.toLowerCase().includes(q) || t.delegacion.toLowerCase().includes(q) || t.asesorName.toLowerCase().includes(q);
    }), [territories, search]);

  const byAsesor = useMemo(() => {
    const map: Record<string, Territory[]> = {};
    filtered.forEach(t => {
      if (!map[t.asesorId]) map[t.asesorId] = [];
      map[t.asesorId].push(t);
    });
    return map;
  }, [filtered]);

  const addTerritory = async () => {
    if (!colonia.trim() || !asesorId) { toast.error('Completa todos los campos.'); return; }
    const conflict = territories.find(t => t.colonia.toLowerCase() === colonia.trim().toLowerCase() && t.delegacion.toLowerCase() === delegacion.trim().toLowerCase());
    if (conflict) { toast.error(`La colonia ya está asignada a ${conflict.asesorName}.`); return; }
    const user = promotors.find(u => u.uid === asesorId);
    await TerritoriesAPI.create({
      nombre: [colonia.trim(), delegacion.trim()].filter(Boolean).join(', '),
      descripcion: `Asignado a ${user?.displayName || user?.email || asesorId}`,
      asesor_id: asesorId,
      color: '#0ea5e9',
      poligono: null,
    });
    await loadData();
    logAudit('VENTA_EDITADA', auth.currentUser?.uid || '', auth.currentUser?.displayName || '', { details: `Territorio asignado: ${colonia.trim()} -> ${user?.displayName || user?.email || asesorId}` });
    toast.success('Territorio asignado.');
    setColonia(''); setDelegacion(''); setAsesorId(''); setShowModal(false);
  };

  const remove = async (id: string) => {
    await TerritoriesAPI.delete(id);
    await loadData();
    toast.success('Territorio eliminado.');
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <MapPin className="w-6 h-6 text-cyan-400" />
            Territorios
          </h1>
          <p className="text-slate-400 text-sm">Asigna colonias y delegaciones a promotores para evitar traslapes.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl text-xs font-bold hover:bg-cyan-500/20 transition-colors">
          <Plus className="w-4 h-4" /> Asignar territorio
        </button>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          No se pudieron cargar territorios reales del servidor: {loadError}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar colonia o asesor…"
          className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none" />
      </div>

      {/* Grouped by asesor */}
      {Object.keys(byAsesor).length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No hay territorios asignados.</p>
        </div>
      ) : (Object.entries(byAsesor) as [string, Territory[]][]).map(([uid, items]) => (
        <div key={uid} className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-950/90 border-b border-white/5 flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-white">{items[0].asesorName}</span>
            <span className="ml-auto text-[10px] text-slate-500 font-bold">{items.length} zona{items.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-white/5">
            {items.map(t => (
              <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="text-sm text-slate-200 flex-1">{t.colonia}{t.delegacion ? `, ${t.delegacion}` : ''}</span>
                <span className="text-[10px] text-slate-500">{new Date(t.createdAt).toLocaleDateString('es-MX')}</span>
                <button onClick={() => remove(t.id)} className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Asignar territorio</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Colonia *</label>
                <input value={colonia} onChange={e => setColonia(e.target.value)} placeholder="Ej: Polanco"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Delegación / Municipio</label>
                <input value={delegacion} onChange={e => setDelegacion(e.target.value)} placeholder="Ej: Miguel Hidalgo"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Promotor *</label>
                <select value={asesorId} onChange={e => setAsesorId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]">
                  <option value="">Seleccionar…</option>
                  {promotors.map(u => <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-white/10 text-slate-300 rounded-xl text-sm font-bold hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={addTerritory} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl text-sm font-bold hover:bg-cyan-500/30 transition-colors">
                <Save className="w-4 h-4" /> Asignar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
