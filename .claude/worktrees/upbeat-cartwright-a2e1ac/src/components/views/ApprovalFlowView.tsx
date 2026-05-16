import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, MessageSquare, Filter, Search, ChevronDown, ChevronUp, Download, User, PhoneCall, Bot, Users } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { logAudit } from '../../lib/auditLog';
import { auth } from '../../lib/firebase';
import { exportToCSV } from '../../lib/exportUtils';
import { requestValidation, getValidationConfig, getValidationRequests } from '../../lib/validationService';
import { toast } from 'sonner';

interface Sale {
  id: string;
  folio?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  telefonoTitular?: string;
  paqueteNombre?: string;
  rentaMensual?: number;
  status?: string;
  fechaSolicitud?: string;
  asesorId?: string;
  colonia?: string;
  approvalHistory?: ApprovalEvent[];
}

interface ApprovalEvent {
  timestamp: string;
  action: 'APROBADA' | 'RECHAZADA' | 'PENDIENTE' | 'EN_REVISION';
  by: string;
  byName: string;
  comment?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDIENTE:    { label: 'Pendiente',    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',   icon: <Clock className="w-3 h-3" /> },
  EN_REVISION:  { label: 'En revisión',  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',      icon: <MessageSquare className="w-3 h-3" /> },
  APROBADA:     { label: 'Aprobada',     color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  PROCEDIO:     { label: 'Procedió',     color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  RECHAZADA:    { label: 'Rechazada',    color: 'bg-red-500/20 text-red-400 border-red-500/30',          icon: <XCircle className="w-3 h-3" /> },
};

function loadSales(): Sale[] {
  try { return JSON.parse(localStorage.getItem('adhdreams_sales') || '[]'); } catch { return []; }
}
function saveSales(sales: Sale[]) { localStorage.setItem('adhdreams_sales', JSON.stringify(sales)); }

export default function ApprovalFlowView() {
  const [sales, setSales] = useState<Sale[]>(loadSales());
  const [filterStatus, setFilterStatus] = useState('PENDIENTE');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [commenting, setCommenting] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [validating, setValidating] = useState<string | null>(null);

  const validationMode = getValidationConfig().mode;

  const handleRequestValidation = async (s: Sale) => {
    setValidating(s.id);
    try {
      const uid = auth.currentUser?.uid || 'sistema';
      const uName = auth.currentUser?.displayName || auth.currentUser?.email || 'Sistema';
      const req = await requestValidation(s, uid, uName);
      if (req.status === 'ERROR') {
        toast.error(`Error al iniciar llamada: ${req.callStatusDetail}`);
      } else if (req.mode === 'AI') {
        toast.success('Llamada de validación iniciada por IA.');
      } else {
        toast.success('Solicitud enviada a administración. Revisa el panel de validaciones.');
      }
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setValidating(null);
    }
  };

  const refresh = () => setSales(loadSales());
  useEffect(() => { const t = setInterval(refresh, 5000); return () => clearInterval(t); }, []);

  const filtered = useMemo(() => {
    return sales.filter(s => {
      const st = (s.status || 'PENDIENTE').toUpperCase();
      const matchStatus = !filterStatus || st === filterStatus;
      const q = search.toLowerCase();
      const matchSearch = !q || (s.folio||'').toLowerCase().includes(q) ||
        [s.nombres, s.apellidoPaterno, s.apellidoMaterno].join(' ').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [sales, filterStatus, search]);

  const changeStatus = (id: string, action: ApprovalEvent['action'], comment?: string) => {
    const uid = auth.currentUser?.uid || 'sistema';
    const uName = auth.currentUser?.displayName || auth.currentUser?.email || 'Sistema';
    const event: ApprovalEvent = { timestamp: new Date().toISOString(), action, by: uid, byName: uName, comment };
    const updated = sales.map(s => {
      if (s.id !== id) return s;
      const history = [...(s.approvalHistory || []), event];
      return { ...s, status: action, approvalHistory: history };
    });
    saveSales(updated);
    setSales(updated);
    const auditMap: Record<string, any> = { APROBADA: 'VENTA_APROBADA', RECHAZADA: 'VENTA_RECHAZADA', PENDIENTE: 'VENTA_EDITADA', EN_REVISION: 'VENTA_EDITADA' };
    logAudit(auditMap[action], uid, uName, { targetId: id, details: comment });
    toast.success(`Venta marcada como ${action.toLowerCase()}.`);
    setCommenting(null);
    setComment('');
  };

  const pendingCount = sales.filter(s => (s.status||'PENDIENTE').toUpperCase() === 'PENDIENTE').length;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            Flujo de Aprobación
          </h1>
          <p className="text-slate-400 text-sm">Aprueba, rechaza o devuelve ventas con comentario de auditoría.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <span className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-full text-xs font-bold">
              {pendingCount} pendientes
            </span>
          )}
          <button onClick={() => exportToCSV(filtered.map(s => ({
            folio: s.folio, cliente: [s.nombres,s.apellidoPaterno].filter(Boolean).join(' '),
            paquete: s.paqueteNombre, renta: s.rentaMensual, status: s.status, fecha: (s.fechaSolicitud||'').slice(0,10)
          })), 'aprobacion_ventas')} className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-white/10 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors">
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar folio o cliente…"
            className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40" />
        </div>
        {['', 'PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={cn('px-3 py-2 rounded-xl border text-xs font-bold transition-colors', filterStatus === s ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'border-white/10 text-slate-400 hover:bg-white/5')}>
            {s || 'Todos'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No hay ventas con ese filtro.</p>
          </div>
        ) : filtered.map(s => {
          const st = (s.status || 'PENDIENTE').toUpperCase();
          const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.PENDIENTE;
          const isExpanded = expanded === s.id;
          const isCommenting = commenting === s.id;
          const lastEvent = s.approvalHistory?.at(-1);

          return (
            <div key={s.id} className="border border-white/10 bg-slate-900/90 rounded-2xl overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-white">{s.folio || s.id}</span>
                    <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border', cfg.color)}>
                      {cfg.icon}{cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{[s.nombres,s.apellidoPaterno,s.apellidoMaterno].filter(Boolean).join(' ') || '—'}</p>
                  <p className="text-[10px] text-slate-500">{s.paqueteNombre || '—'} · {formatCurrency(s.rentaMensual||0)}/mes · {(s.fechaSolicitud||'').slice(0,10)}</p>
                  {lastEvent?.comment && (
                    <p className="text-[10px] text-slate-400 mt-1 italic">💬 "{lastEvent.comment}" — {lastEvent.byName}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Validation request button */}
                  {['PENDIENTE','EN_REVISION'].includes(st) && (
                    <button
                      onClick={() => handleRequestValidation(s)}
                      disabled={validating === s.id}
                      title={validationMode === 'AI' ? 'Llamada de validación por IA' : 'Solicitar validación a administración'}
                      className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg border border-purple-500/20 transition-colors disabled:opacity-50">
                      {validating === s.id
                        ? <PhoneCall className="w-4 h-4 animate-pulse" />
                        : validationMode === 'AI' ? <Bot className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    </button>
                  )}
                  {st === 'PENDIENTE' && (
                    <button onClick={() => changeStatus(s.id, 'EN_REVISION')} title="Poner en revisión"
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg border border-blue-500/20 transition-colors text-xs font-bold">
                      Revisar
                    </button>
                  )}
                  {['PENDIENTE','EN_REVISION'].includes(st) && (
                    <>
                      <button onClick={() => setCommenting(s.id)} title="Aprobar con comentario"
                        className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/20 transition-colors">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setCommenting(`reject-${s.id}`)} title="Rechazar con comentario"
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button onClick={() => setExpanded(isExpanded ? null : s.id)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Comment input */}
              {(isCommenting || commenting === `reject-${s.id}`) && (
                <div className="border-t border-white/10 p-4 bg-slate-950/85 space-y-3">
                  <p className="text-xs font-bold text-slate-300">
                    {commenting === `reject-${s.id}` ? '❌ Rechazar venta' : '✅ Aprobar venta'} — agrega un comentario (opcional):
                  </p>
                  <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Motivo, observación o instrucción…"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => { setCommenting(null); setComment(''); }} className="px-4 py-2 border border-white/10 text-slate-300 rounded-xl text-xs font-bold hover:bg-white/5 transition-colors">Cancelar</button>
                    <button
                      onClick={() => changeStatus(s.id, commenting === `reject-${s.id}` ? 'RECHAZADA' : 'APROBADA', comment)}
                      className={cn('px-4 py-2 rounded-xl text-xs font-bold transition-colors', commenting === `reject-${s.id}` ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-emerald-600/80 hover:bg-emerald-600 text-white')}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded history */}
              {isExpanded && s.approvalHistory && s.approvalHistory.length > 0 && (
                <div className="border-t border-white/10 p-4 bg-slate-950/85 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Historial de cambios</p>
                  {s.approvalHistory.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <span className="text-slate-500 whitespace-nowrap">{new Date(ev.timestamp).toLocaleString('es-MX')}</span>
                      <span className={cn('font-bold', ev.action === 'APROBADA' ? 'text-emerald-400' : ev.action === 'RECHAZADA' ? 'text-red-400' : 'text-amber-400')}>{ev.action}</span>
                      <span className="text-slate-400">por <strong>{ev.byName}</strong></span>
                      {ev.comment && <span className="text-slate-300 italic">"{ev.comment}"</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
