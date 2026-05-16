import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle, XCircle, Trash2, RefreshCw, Search, Shield, UserCheck, UserX, Clock, Phone, Mail, MapPin } from 'lucide-react';

interface AppUser {
  uid: string;
  username: string;
  email: string;
  displayName?: string;
  nombre?: string;
  apellidoPaterno?: string;
  role: string;
  activo: number; // 0=rechazado 1=activo 2=pendiente
  puesto?: string;
  telefono?: string;
  zonaOperativa?: string;
  created_at?: string;
}

const ROLE_LABELS: Record<string, string> = {
  GERENTE: 'Gerente',
  SUPERVISOR: 'Supervisor',
  ASESOR: 'Asesor',
};

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Rechazado', color: 'text-rose-400 bg-rose-400/10 border-rose-400/30' },
  1: { label: 'Activo', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  2: { label: 'Pendiente', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
};

export default function UserManagementView() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('all');
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) setUsers(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const notify = (text: string, ok: boolean) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const approveUser = async (uid: string) => {
    const res = await fetch(`/api/users/${uid}/approve`, { method: 'POST' });
    if (res.ok) { notify('Usuario aprobado correctamente.', true); loadUsers(); }
    else notify('Error al aprobar usuario.', false);
  };

  const rejectUser = async (uid: string) => {
    const res = await fetch(`/api/users/${uid}/reject`, { method: 'POST' });
    if (res.ok) { notify('Usuario rechazado.', true); loadUsers(); }
    else notify('Error al rechazar usuario.', false);
  };

  const deleteUser = async (uid: string, name: string) => {
    if (!confirm(`¿Eliminar permanentemente a "${name}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/users/${uid}`, { method: 'DELETE' });
    if (res.ok) { notify('Usuario eliminado.', true); loadUsers(); }
    else notify('Error al eliminar usuario.', false);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q);
    const matchFilter =
      filter === 'all' ? true :
      filter === 'pending' ? u.activo === 2 :
      filter === 'active' ? u.activo === 1 :
      u.activo === 0;
    return matchSearch && matchFilter;
  });

  const pending = users.filter(u => u.activo === 2).length;
  const active  = users.filter(u => u.activo === 1).length;
  const rejected = users.filter(u => u.activo === 0).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-cyan-400" /> Gestión de Usuarios
          </h2>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest">Administra cuentas · aprueba o rechaza solicitudes</p>
        </div>
        <button onClick={loadUsers} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors" title="Recargar">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <button onClick={() => setFilter('pending')} className={`bg-[#0a0d14] border rounded-[14px] p-4 text-left transition-all hover:border-yellow-400/50 ${filter === 'pending' ? 'border-yellow-400/60' : 'border-slate-800/80'}`}>
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-yellow-400" /><span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Pendientes</span></div>
          <p className="text-3xl font-bold text-yellow-400">{pending}</p>
        </button>
        <button onClick={() => setFilter('active')} className={`bg-[#0a0d14] border rounded-[14px] p-4 text-left transition-all hover:border-emerald-400/50 ${filter === 'active' ? 'border-emerald-400/60' : 'border-slate-800/80'}`}>
          <div className="flex items-center gap-2 mb-1"><UserCheck className="w-4 h-4 text-emerald-400" /><span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Activos</span></div>
          <p className="text-3xl font-bold text-emerald-400">{active}</p>
        </button>
        <button onClick={() => setFilter('rejected')} className={`bg-[#0a0d14] border rounded-[14px] p-4 text-left transition-all hover:border-rose-400/50 ${filter === 'rejected' ? 'border-rose-400/60' : 'border-slate-800/80'}`}>
          <div className="flex items-center gap-2 mb-1"><UserX className="w-4 h-4 text-rose-400" /><span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Rechazados</span></div>
          <p className="text-3xl font-bold text-rose-400">{rejected}</p>
        </button>
      </div>

      {actionMsg && (
        <div className={`px-4 py-3 rounded-xl border text-sm font-bold ${actionMsg.ok ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' : 'bg-rose-400/10 border-rose-400/30 text-rose-400'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, usuario o email..."
            className="w-full pl-9 pr-4 py-2.5 bg-[#0a0d14] border border-slate-800/80 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>
        {(['all', 'pending', 'active', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[10px] uppercase font-bold tracking-widest px-3 py-2 rounded-lg border transition-colors ${filter === f ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'}`}>
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'active' ? 'Activos' : 'Rechazados'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-500 text-sm">Cargando usuarios...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-slate-500">
          <Users className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No se encontraron usuarios</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const statusCfg = STATUS_LABELS[u.activo] ?? STATUS_LABELS[0];
            const name = u.displayName || `${u.nombre || ''} ${u.apellidoPaterno || ''}`.trim() || u.username;
            return (
              <div key={u.uid} className="bg-[#0a0d14] border border-slate-800/80 rounded-[14px] p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400 font-bold text-sm shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-bold text-white text-sm truncate">{name}</p>
                    <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border ${statusCfg.color}`}>{statusCfg.label}</span>
                    <span className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border border-slate-700 text-slate-400">{ROLE_LABELS[u.role] || u.role}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" />@{u.username}</span>
                    {u.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</span>}
                    {u.telefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.telefono}</span>}
                    {u.zonaOperativa && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Zona {u.zonaOperativa}</span>}
                    {u.puesto && <span className="capitalize">{u.puesto}</span>}
                    {u.created_at && <span>Registrado: {new Date(u.created_at).toLocaleDateString('es-MX')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {u.activo === 2 && (
                    <>
                      <button onClick={() => approveUser(u.uid)}
                        className="flex items-center gap-1 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg uppercase tracking-wider transition-colors"
                        title="Aprobar cuenta">
                        <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                      </button>
                      <button onClick={() => rejectUser(u.uid)}
                        className="flex items-center gap-1 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-lg uppercase tracking-wider transition-colors"
                        title="Rechazar cuenta">
                        <XCircle className="w-3.5 h-3.5" /> Rechazar
                      </button>
                    </>
                  )}
                  {u.activo === 0 && (
                    <button onClick={() => approveUser(u.uid)}
                      className="flex items-center gap-1 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg uppercase tracking-wider transition-colors"
                      title="Reactivar cuenta">
                      <CheckCircle className="w-3.5 h-3.5" /> Reactivar
                    </button>
                  )}
                  {u.activo === 1 && (
                    <button onClick={() => rejectUser(u.uid)}
                      className="flex items-center gap-1 px-3 py-2 bg-slate-700/50 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 text-xs font-bold rounded-lg uppercase tracking-wider transition-colors"
                      title="Desactivar cuenta">
                      <XCircle className="w-3.5 h-3.5" /> Desactivar
                    </button>
                  )}
                  <button onClick={() => deleteUser(u.uid, name)}
                    className="p-2 bg-slate-800/80 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                    title="Eliminar usuario">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
