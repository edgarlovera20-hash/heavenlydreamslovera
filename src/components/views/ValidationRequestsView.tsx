import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronUp, Clock, PhoneCall, RefreshCw, RotateCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

type ValidationRow = Record<string, any>;

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: <Clock className="w-3 h-3" /> },
  PENDIENTE_DATOS: { label: 'Faltan datos', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: <AlertTriangle className="w-3 h-3" /> },
  EN_LLAMADA: { label: 'En llamada', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: <PhoneCall className="w-3 h-3" /> },
  ESPERANDO_REVISION: { label: 'Esperando revision', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: <Bot className="w-3 h-3" /> },
  VALIDADO: { label: 'Validado', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  RECHAZADO: { label: 'Rechazado', color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: <XCircle className="w-3 h-3" /> },
  ERROR: { label: 'Error', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30', icon: <AlertTriangle className="w-3 h-3" /> },
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function parseJson(value: any, fallback: any) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

export default function ValidationRequestsView() {
  const [requests, setRequests] = useState<ValidationRow[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [providerOverride, setProviderOverride] = useState<Record<string, string>>({});

  const load = async () => {
    const [rows, providerStatus] = await Promise.all([
      api('/api/validations'),
      api('/api/voice-providers/status'),
    ]);
    setRequests(rows);
    setProviders(providerStatus.providers || []);
  };

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
    const timer = window.setInterval(() => load().catch(() => {}), 8000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => requests.filter((row) => !filterStatus || row.status === filterStatus), [requests, filterStatus]);
  const stats = useMemo(() => ({
    pending: requests.filter((row) => ['PENDIENTE', 'PENDIENTE_DATOS'].includes(row.status)).length,
    calling: requests.filter((row) => row.status === 'EN_LLAMADA').length,
    review: requests.filter((row) => row.status === 'ESPERANDO_REVISION').length,
    done: requests.filter((row) => ['VALIDADO', 'RECHAZADO'].includes(row.status)).length,
  }), [requests]);

  const runAction = async (id: string, action: string, body: any = {}) => {
    setBusy(`${id}:${action}`);
    try {
      await api(`/api/validations/${id}/${action}`, { method: 'POST', body: JSON.stringify(body) });
      await load();
      toast.success('Accion completada.');
    } catch (err: any) {
      toast.error(err.message || 'No se pudo completar la accion.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-emerald-400" />
            Solicitudes de Validacion
          </h1>
          <p className="text-slate-400 text-sm">Llamadas IA multi-proveedor, transcript y revision humana antes de mover la venta.</p>
        </div>
        <button onClick={() => load().catch((err) => toast.error(err.message))}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl border border-white/10 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes', value: stats.pending, color: 'text-amber-300' },
          { label: 'En llamada', value: stats.calling, color: 'text-blue-300' },
          { label: 'Revision', value: stats.review, color: 'text-purple-300' },
          { label: 'Cerradas', value: stats.done, color: 'text-emerald-300' },
        ].map((item) => (
          <div key={item.label} className="bg-slate-900/90 border border-white/10 rounded-2xl p-4">
            <p className={cn('text-2xl font-black', item.color)}>{item.value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}
        className="bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]">
        <option value="">Todos los estatus</option>
        {Object.entries(STATUS_CFG).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
      </select>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <PhoneCall className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No hay solicitudes con ese filtro.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => {
            const cfg = STATUS_CFG[row.status] || STATUS_CFG.PENDIENTE;
            const isExpanded = expanded === row.id;
            const transcript = parseJson(row.transcript_json, []);
            const providerValue = providerOverride[row.id] || row.provider || '';
            return (
              <div key={row.id} className="border border-white/10 bg-slate-900/90 rounded-2xl overflow-hidden">
                <div className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-white">{row.client_name || 'Cliente'}</span>
                      <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border', cfg.color)}>
                        {cfg.icon}{cfg.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
                        {row.provider || 'sin proveedor'}
                      </span>
                      {row.proposed_result && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border bg-purple-500/10 text-purple-300 border-purple-500/20">
                          propuesta: {row.proposed_result}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Venta {row.sale_id || 'sin venta'} · {row.client_phone || 'sin telefono'} · intentos {row.attempts || 0}
                    </p>
                    {row.summary && <p className="text-xs text-slate-300 mt-2 line-clamp-2">{row.summary}</p>}
                    {row.last_error && <p className="text-xs text-rose-300 mt-2">{row.last_error}</p>}
                  </div>

                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 shrink-0">
                    <select value={providerValue} onChange={(event) => setProviderOverride((current) => ({ ...current, [row.id]: event.target.value }))}
                      className="bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-xs text-white [color-scheme:dark]">
                      <option value="">Proveedor default</option>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>{provider.label}{provider.configured ? '' : ' (no config)'}</option>
                      ))}
                    </select>
                    <button disabled={Boolean(busy)} onClick={() => runAction(row.id, row.attempts ? 'retry' : 'call', providerValue ? { provider: providerValue } : {})}
                      className="p-2 text-blue-300 hover:bg-blue-500/10 rounded-lg border border-blue-500/20 disabled:opacity-50">
                      <PhoneCall className="w-4 h-4" />
                    </button>
                    <button disabled={Boolean(busy)} onClick={() => runAction(row.id, 'sync')}
                      className="p-2 text-purple-300 hover:bg-purple-500/10 rounded-lg border border-purple-500/20 disabled:opacity-50">
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <button disabled={Boolean(busy)} onClick={() => runAction(row.id, 'approve')}
                      className="p-2 text-emerald-300 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/20 disabled:opacity-50">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button disabled={Boolean(busy)} onClick={() => runAction(row.id, 'reject')}
                      className="p-2 text-red-300 hover:bg-red-500/10 rounded-lg border border-red-500/20 disabled:opacity-50">
                      <XCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => setExpanded(isExpanded ? null : row.id)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/10 p-4 bg-slate-950/75 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {[
                        ['Call SID', row.call_sid || ''],
                        ['Conversation ID', row.conversation_id || ''],
                        ['Call status', row.call_status || ''],
                        ['Review', row.review_status || 'pending'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <span className="text-slate-500 uppercase text-[9px] tracking-wider">{label}</span>
                          <p className="text-slate-200 font-mono truncate">{value || '-'}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Transcript</p>
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3 max-h-64 overflow-auto text-xs text-slate-300 space-y-2">
                        {Array.isArray(transcript) && transcript.length
                          ? transcript.map((item: any, index: number) => <p key={index}><strong>{item.role || 'voz'}:</strong> {item.message || JSON.stringify(item)}</p>)
                          : <p className="text-slate-500">Sin transcript sincronizado todavia.</p>}
                      </div>
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
