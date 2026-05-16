import React, { useState, useEffect, useMemo } from 'react';
import { Users, Target, Edit2, UserX, UserCheck, Save, X, TrendingUp, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { logAudit } from '../../lib/auditLog';
import { auth } from '../../lib/firebase';
import { toast } from 'sonner';

interface TeamMember {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
  active?: boolean;
  zona?: string;
  fechaIngreso?: string;
}

function getQuotas(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem('adhdreams_quotas') || '{}'); } catch { return {}; }
}
function saveQuotas(q: Record<string, number>) { localStorage.setItem('adhdreams_quotas', JSON.stringify(q)); }

function getMemberStats(uid: string, period: string) {
  try {
    const sales: any[] = JSON.parse(localStorage.getItem('adhdreams_sales') || '[]');
    const mine = sales.filter(s => s.asesorId === uid && (s.fechaSolicitud || '').startsWith(period));
    const approved = mine.filter(s => ['APROBADA','PROCEDIO'].includes((s.status||'').toUpperCase())).length;
    const revenue = mine.filter(s => ['APROBADA','PROCEDIO'].includes((s.status||'').toUpperCase()))
      .reduce((a, s) => a + (Number(s.rentaMensual) || 0), 0);
    return { total: mine.length, approved, revenue };
  } catch { return { total: 0, approved: 0, revenue: 0 }; }
}

const ROLES = ['ASESOR', 'SUPERVISOR', 'GERENTE'];

export default function TeamManagementView() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [quotas, setQuotasState] = useState<Record<string, number>>(getQuotas());
  const [editingQuota, setEditingQuota] = useState<string | null>(null);
  const [tempQuota, setTempQuota] = useState('');
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    try { setMembers(JSON.parse(localStorage.getItem('adhdreams_users') || '[]')); } catch { setMembers([]); }
    setQuotasState(getQuotas());
  };

  useEffect(load, []);

  const saveQuota = (uid: string) => {
    const val = parseInt(tempQuota);
    if (isNaN(val) || val < 0) { toast.error('Meta inválida.'); return; }
    const updated = { ...quotas, [uid]: val };
    saveQuotas(updated);
    setQuotasState(updated);
    setEditingQuota(null);
    logAudit('META_ESTABLECIDA', auth.currentUser?.uid||'', auth.currentUser?.displayName||'', { targetId: uid, details: `Meta: ${val} ventas/mes` });
    toast.success('Meta guardada.');
  };

  const toggleActive = (uid: string) => {
    const updated = members.map(m => m.uid === uid ? { ...m, active: !(m.active !== false) } : m);
    localStorage.setItem('adhdreams_users', JSON.stringify(updated));
    setMembers(updated);
    const m = members.find(m => m.uid === uid);
    const isNowActive = m?.active === false;
    logAudit(isNowActive ? 'USUARIO_EDITADO' : 'USUARIO_DESACTIVADO', auth.currentUser?.uid||'', auth.currentUser?.displayName||'', { targetId: uid, targetLabel: m?.displayName || m?.email });
    toast.success(isNowActive ? 'Usuario reactivado.' : 'Usuario desactivado.');
  };

  const saveMember = () => {
    if (!editingMember) return;
    const updated = members.map(m => m.uid === editingMember.uid ? editingMember : m);
    localStorage.setItem('adhdreams_users', JSON.stringify(updated));
    setMembers(updated);
    setEditingMember(null);
    logAudit('USUARIO_EDITADO', auth.currentUser?.uid||'', auth.currentUser?.displayName||'', { targetId: editingMember.uid, targetLabel: editingMember.displayName });
    toast.success('Datos del usuario actualizados.');
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
