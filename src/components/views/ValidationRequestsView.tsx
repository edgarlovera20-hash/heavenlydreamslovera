import React, { useState, useMemo, useEffect } from 'react';
import {
  Phone, Bot, Users, CheckCircle2, XCircle, Clock, PhoneCall,
  PhoneOff, AlertTriangle, MessageSquare, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import {
  getValidationRequests, updateValidationRequest, ValidationRequest
} from '../../lib/validationService';
import { logAudit } from '../../lib/auditLog';
import { auth } from '../../lib/firebase';
import { toast } from 'sonner';

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDIENTE:    { label: 'Pendiente',    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',    icon: <Clock className="w-3 h-3" /> },
  EN_LLAMADA:   { label: 'En llamada',   color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',       icon: <PhoneCall className="w-3 h-3" /> },
  VALIDADO:     { label: 'Validado',     color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  RECHAZADO:    { label: 'Rechazado',    color: 'bg-red-500/20 text-red-400 border-red-500/30',           icon: <XCircle className="w-3 h-3" /> },
  ERROR:        { label: 'Error',        color: 'bg-rose-500/20 text-rose-400 border-rose-500/30',        icon: <AlertTriangle className="w-3 h-3" /> },
};

export default function ValidationRequestsView() {
  const [requests, setRequests] = useState<ValidationRequest[]>(() => getValidationRequests());
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  // Auto-refresh every 5 s
  useEffect(() => {
    const t = setInterval(() => setRequests(getValidationRequests()), 5000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => requests.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterMode && r.mode !== filterMode) return false;
    return true;
  }), [requests, filterStatus, filterMode]);

  const stats = useMemo(() => ({
    pendiente: requests.filter(r => r.status === 'PENDIENTE').length,
    enLlamada: requests.filter(r => r.status === 'EN_LLAMADA').length,
    validado:  requests.filter(r => r.status === 'VALIDADO').length,
    rechazado: requests.filter(r => r.status === 'RECHAZADO').length,
  }), [requests]);

  const resolve = (id: string, status: 'VALIDADO' | 'RECHAZADO', adminNote?: string) => {
    const uid = auth.currentUser?.uid || 'admin';
    const name = auth.currentUser?.displayName || auth.currentUser?.email || 'Admin';
    const updated = updateValidationRequest(id, {
      status,
      adminNotes: adminNote,
      resolvedBy: uid,
      resolvedByName: name,
      resolvedAt: new Date().toISOString(),
    });
    setRequests(updated);
    logAudit(status === 'VALIDADO' ? 'VENTA_APROBADA' : 'VENTA_RECHAZADA', uid, name, {
      details: `Validación ${status.toLowerCase()}: ${adminNote || ''}`,
    });
    toast.success(`Solicitud marcada como ${status.toLowerCase()}.`);
    setNoteFor(null);
    setNote('');
  };

  const markInCall = (id: string) => {
    const updated = updateValidationRequest(id, { status: 'EN_LLAMADA', callStatusDetail: 'Llamada en progreso (manual)' });
    setRequests(updated);
    toast('Solicitud marcada como "En llamada".');
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-emerald-400" />
            Solicitudes de Validación
          </h1>
          <p className="text-slate-400 text-sm">Gestiona las llamadas de validación pendientes y su resultado.</p>
        </div>
        <button onClick={() => setRequests(getValidationRequests())}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl border border-white/10 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes', value: stats.pendiente, color: 'text-amber-400' },
          { label: 'En llamada', value: stats.enLlamada, color: 'text-blue-400' },
          { label: 'Validadas',  value: stats.validado,  color: 'text-emerald-400' },
          { label: 'Rechazadas', value: stats.rechazado, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/90 border border-white/10 rounded-2xl p-4">
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]">
          <option value="">Todos los estatus</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
          className="bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]">
          <option value="">Todos los modos</option>
          <option value="AI">IA Automatizada</option>
          <option value="ADMIN">Administración</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <PhoneCall className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>{requests.length === 0 ? 'No hay solicitudes de validación todavía.' : 'No hay solicitudes con ese filtro.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const cfg = STATUS_CFG[r.status] || STATUS_CFG.PENDIENTE;
            const isExp = expanded === r.id;
            const isNoting = noteFor === r.id;
            const isPending = ['PENDIENTE', 'EN_LLAMADA'].includes(r.status);

            return (
              <div key={r.id} className="border border-white/10 bg-slate-900/90 rounded-2xl overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-white">{r.folio}</span>
                      <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border', cfg.color)}>
                        {cfg.icon}{cfg.label}
                      </span>
                      <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border',
                        r.mode === 'AI' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30')}>
                        {r.mode === 'AI' ? <Bot className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {r.mode === 'AI' ? 'IA' : 'Admin'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-bold">{r.clientName}</p>
                    <p className="text-[10px] text-slate-500">
                      {r.paquete} · {formatCurrency(r.precio)}/mes · {r.clientPhone || 'Sin teléfono'}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      Solicitado por <span className="text-slate-400">{r.requestedByName}</span> · {new Date(r.requestedAt).toLocaleString('es-MX')}
                    </p>
                    {r.callStatusDetail && (
                      <p className="text-[10px] text-blue-400 mt-1">📞 {r.callStatusDetail}</p>
                    )}
                    {r.adminNotes && (
                      <p className="text-[10px] text-slate-400 mt-1 italic">💬 "{r.adminNotes}" — {r.resolvedByName}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isPending && r.mode === 'ADMIN' && r.status === 'PENDIENTE' && (
                      <button onClick={() => markInCall(r.id)} title="Marcar en llamada"
                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg border border-blue-500/20 transition-colors">
                        <PhoneCall className="w-4 h-4" />
                      </button>
                    )}
                    {isPending && (
                      <>
                        <button onClick={() => setNoteFor(r.id)} title="Validar con nota"
                          className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/20 transition-colors">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setNoteFor(`reject-${r.id}`)} title="Rechazar"
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button onClick={() => setExpanded(isExp ? null : r.id)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                      {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Note input */}
                {(noteFor === r.id || noteFor === `reject-${r.id}`) && (
                  <div className="border-t border-white/10 p-4 bg-slate-950/75 space-y-3">
                    <p className="text-xs font-bold text-slate-300">
                      {noteFor === `reject-${r.id}` ? '❌ Rechazar solicitud' : '✅ Validar solicitud'} — agrega una nota (opcional):
                    </p>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                      placeholder="Observación, motivo o instrucción…"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => { setNoteFor(null); setNote(''); }}
                        className="px-4 py-2 border border-white/10 text-slate-300 rounded-xl text-xs font-bold hover:bg-white/5 transition-colors">Cancelar</button>
                      <button
                        onClick={() => resolve(r.id, noteFor === `reject-${r.id}` ? 'RECHAZADO' : 'VALIDADO', note || undefined)}
                        className={cn('px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors',
                          noteFor === `reject-${r.id}` ? 'bg-red-600/80 hover:bg-red-600' : 'bg-emerald-600/80 hover:bg-emerald-600')}>
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded detail */}
                {isExp && (
                  <div className="border-t border-white/10 p-4 bg-slate-950/75">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-xs">
                      {[
                        ['ID solicitud', r.id],
                        ['ID venta', r.saleId],
                        ['Modo', r.mode === 'AI' ? 'IA Automatizada' : 'Administración'],
                        ['Teléfono', r.clientPhone || '—'],
                        ['Paquete', r.paquete],
                        ['Precio', formatCurrency(r.precio)],
                        ['Solicitado por', r.requestedByName],
                        ['Fecha solicitud', new Date(r.requestedAt).toLocaleString('es-MX')],
                        r.callId ? ['Call ID', r.callId] : null,
                        r.resolvedAt ? ['Resuelto', new Date(r.resolvedAt).toLocaleString('es-MX')] : null,
                        r.resolvedByName ? ['Resuelto por', r.resolvedByName] : null,
                        r.adminNotes ? ['Notas', r.adminNotes] : null,
                      ].filter(Boolean).map(([label, val]) => (
                        <div key={label as string}>
                          <span className="text-slate-500 uppercase text-[9px] tracking-wider">{label}</span>
                          <p className="text-slate-200 font-mono mt-0.5 truncate">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
