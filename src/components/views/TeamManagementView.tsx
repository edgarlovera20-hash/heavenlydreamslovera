import React, { useState, useEffect, useMemo } from 'react';
import { Users, Target, Edit2, UserX, UserCheck, Save, X, TrendingUp, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { logAudit } from '../../lib/auditLog';
function getCurrentUser() { try { const s = localStorage.getItem('hd_session'); return s ? JSON.parse(s) : null; } catch { return null; } }
import { toast } from 'sonner';

interface TeamMember {
  uid: string;
  email: string;
  nombre?: string;
  displayName?: string;
  role?: string;
  activo?: number;
  active?: boolean;
  zona?: string;
  fechaIngreso?: string;
}

let _allSalesCache: any[] = [];

function getMemberStats(uid: string, period: string) {
  const sales = _allSalesCache;
  const mine = sales.filter((s: any) => (s.asesor_id || s.asesorId) === uid && (s.fecha_solicitud || s.fechaSolicitud || '').startsWith(period));
  const approved = mine.filter((s: any) => ['aprobada','procedio'].includes((s.status||'').toLowerCase())).length;
  const revenue = mine.filter((s: any) => ['aprobada','procedio'].includes((s.status||'').toLowerCase()))
    .reduce((a: number, s: any) => a + (Number(s.renta_mensual || s.rentaMensual) || 0), 0);
  return { total: mine.length, approved, revenue };
}

const ROLES = ['ASESOR', 'SUPERVISOR', 'GERENTE'];

function normalizeMember(user: any): TeamMember {
  return {
    ...user,
    displayName: user.displayName || user.nombre || user.username || user.email,
    active: user.active ?? user.activo !== 0,
  };
}

function normalizeQuotas(rows: any): Record<string, number> {
  if (!Array.isArray(rows)) return rows || {};
  return Object.fromEntries(rows.map(row => [row.user_id, Number(row.meta || 0)]));
}

export default function TeamManagementView() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [quotas, setQuotasState] = useState<Record<string, number>>({});
  const [editingQuota, setEditingQuota] = useState<string | null>(null);
  const [tempQuota, setTempQuota] = useState('');
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    try {
      const [usersRes, salesRes, quotasRes] = await Promise.all([
        fetch('/api/users').then(r => r.ok ? r.json() : []),
        fetch('/api/ventas').then(r => r.ok ? r.json() : []),
        fetch('/api/quotas').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      ]);
      setMembers(usersRes.map(normalizeMember));
      _allSalesCache = salesRes;
      setQuotasState(normalizeQuotas(quotasRes));
    } catch { setMembers([]); }
  };

  useEffect(() => { load(); }, []);

  const saveQuota = async (uid: string) => {
    const val = parseInt(tempQuota);
    if (isNaN(val) || val < 0) { toast.error('Meta inválida.'); return; }
    try {
      await fetch(`/api/quotas/${uid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meta: val }) });
      setQuotasState(prev => ({ ...prev, [uid]: val }));
      setEditingQuota(null);
      toast.success('Meta guardada.');
    } catch { toast.error('Error al guardar meta.'); }
  };

  const toggleActive = async (uid: string) => {
    const m = members.find(m => m.uid === uid);
    const isNowActive = m?.active === false;
    try {
      await fetch(`/api/users/${uid}/${isNowActive ? 'approve' : 'reject'}`, { method: 'POST' });
      load();
      toast.success(isNowActive ? 'Usuario reactivado.' : 'Usuario desactivado.');
    } catch { toast.error('Error al actualizar usuario.'); }
  };

  const saveMember = async () => {
    if (!editingMember) return;
    try {
      const payload = {
        nombre: editingMember.displayName || editingMember.nombre,
        role: editingMember.role,
        zona: editingMember.zona || null,
      };
      await fetch(`/api/users/${editingMember.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setEditingMember(null);
      load();
      toast.success('Datos del usuario actualizados.');
    } catch { toast.error('Error al actualizar usuario.'); }
  };

  const active = members.filter(m => m.active !== false);
  const inactive = members.filter(m => m.active === false);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            Gestión del Equipo
          </h1>
          <p className="text-slate-400 text-sm">Administra asesores, roles, metas y rendimiento.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Período:</label>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total miembros', value: members.length, color: 'text-white' },
          { label: 'Activos', value: active.length, color: 'text-emerald-400' },
          { label: 'Inactivos', value: inactive.length, color: 'text-red-400' },
          { label: 'Roles', value: [...new Set(members.map(m => m.role).filter(Boolean))].length, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/90 border border-white/10 rounded-xl p-4">
            <p className={cn('text-xl font-black', s.color)}>{s.value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Member cards */}
      <div className="space-y-3">
        {members.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No hay usuarios registrados.</p>
          </div>
        ) : members.map(m => {
          const stats = getMemberStats(m.uid, period);
          const quota = quotas[m.uid] || 10;
          const progress = Math.min(100, Math.round((stats.approved / quota) * 100));
          const isActive = m.active !== false;
          const isExpanded = expanded === m.uid;

          return (
            <div key={m.uid} className={cn('border rounded-2xl overflow-hidden transition-all', isActive ? 'border-white/10 bg-slate-900/90' : 'border-white/5 bg-slate-900/20 opacity-60')}>
              <div className="p-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">
                  {(m.displayName || m.email || '?')[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{m.displayName || m.email}</p>
                  <p className="text-[10px] text-slate-400">{m.email} · <span className="text-blue-400 font-bold">{m.role || 'ASESOR'}</span>{m.zona ? ` · ${m.zona}` : ''}</p>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-6 text-center">
                  <div>
                    <p className="text-sm font-bold text-emerald-400">{stats.approved}</p>
                    <p className="text-[9px] text-slate-500 uppercase">Aprobadas</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{stats.total}</p>
                    <p className="text-[9px] text-slate-500 uppercase">Total</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-yellow-400">{formatCurrency(stats.revenue)}</p>
                    <p className="text-[9px] text-slate-500 uppercase">Renta</p>
                  </div>
                </div>

                {/* Goal progress */}
                <div className="hidden lg:flex flex-col items-end gap-1 w-32 shrink-0">
                  <div className="flex items-center justify-between w-full">
                    {editingQuota === m.uid ? (
                      <div className="flex items-center gap-1">
                        <input type="number" value={tempQuota} onChange={e => setTempQuota(e.target.value)} className="w-14 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none" />
                        <button onClick={() => saveQuota(m.uid)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded"><Save className="w-3 h-3" /></button>
                        <button onClick={() => setEditingQuota(null)} className="p-1 text-slate-400 hover:bg-white/5 rounded"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingQuota(m.uid); setTempQuota(String(quota)); }} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors">
                        <Target className="w-3 h-3" /> Meta: {quota}
                      </button>
                    )}
                    <span className={cn('text-[10px] font-bold', progress >= 100 ? 'text-emerald-400' : progress >= 60 ? 'text-amber-400' : 'text-slate-400')}>{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', progress >= 100 ? 'bg-emerald-400' : progress >= 60 ? 'bg-amber-400' : 'bg-blue-400')} style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditingMember({ ...m })} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Editar">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggleActive(m.uid)} className={cn('p-2 rounded-lg transition-colors', isActive ? 'text-red-400 hover:bg-red-500/10' : 'text-emerald-400 hover:bg-emerald-500/10')} title={isActive ? 'Desactivar' : 'Reactivar'}>
                    {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setExpanded(isExpanded ? null : m.uid)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-white/10 px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/85">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Total período</p>
                    <p className="text-sm font-bold text-white">{stats.total} capturas</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Aprobadas</p>
                    <p className="text-sm font-bold text-emerald-400">{stats.approved}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Tasa conversión</p>
                    <p className="text-sm font-bold text-cyan-400">{stats.total ? Math.round((stats.approved/stats.total)*100) : 0}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Renta acumulada</p>
                    <p className="text-sm font-bold text-yellow-400">{formatCurrency(stats.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Meta mensual</p>
                    <p className="text-sm font-bold text-white">{quota} ventas</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Progreso meta</p>
                    <p className={cn('text-sm font-bold', progress >= 100 ? 'text-emerald-400' : 'text-amber-400')}>{progress >= 100 ? '✅ Cumplida' : `${progress}% (${stats.approved}/${quota})`}</p>
                  </div>
                  {m.zona && <div><p className="text-[9px] text-slate-500 uppercase tracking-widest">Zona asignada</p><p className="text-sm font-bold text-white">{m.zona}</p></div>}
                  {m.fechaIngreso && <div><p className="text-[9px] text-slate-500 uppercase tracking-widest">Fecha ingreso</p><p className="text-sm font-bold text-white">{m.fechaIngreso}</p></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {editingMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-blue-500/30 rounded-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Editar usuario</h3>
              <button onClick={() => setEditingMember(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre visible</label>
                <input type="text" value={editingMember.displayName || ''} onChange={e => setEditingMember(p => p ? { ...p, displayName: e.target.value } : p)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rol</label>
                <select value={editingMember.role || 'ASESOR'} onChange={e => setEditingMember(p => p ? { ...p, role: e.target.value } : p)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none appearance-none">
                  {ROLES.map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zona asignada</label>
                <input type="text" value={editingMember.zona || ''} onChange={e => setEditingMember(p => p ? { ...p, zona: e.target.value } : p)}
                  placeholder="Ej. Iztapalapa Norte"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha de ingreso</label>
                <input type="date" value={editingMember.fechaIngreso || ''} onChange={e => setEditingMember(p => p ? { ...p, fechaIngreso: e.target.value } : p)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none [color-scheme:dark]" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingMember(null)} className="flex-1 px-4 py-2.5 border border-white/10 text-slate-300 rounded-xl text-sm font-bold hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={saveMember} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-colors">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
