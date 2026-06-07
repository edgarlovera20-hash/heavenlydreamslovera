import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, FileSpreadsheet, MessageSquare, HardDrive,
  RefreshCw, Plus, ExternalLink, CheckCircle2, AlertCircle,
  Clock, Send, FolderOpen, Users,
} from 'lucide-react';
import { PremiumCard, SectionHeader } from '../ui/premium';

interface MsServiceCard {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  color: string;
}

const SERVICES: MsServiceCard[] = [
  {
    id: 'calendar',
    name: 'Outlook Calendar',
    icon: Calendar,
    description: 'Sincroniza citas y seguimientos del CRM con tu calendario de Outlook.',
    color: 'text-[#0078D4] border-[#0078D4]/30 bg-[#0078D4]/10',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    icon: MessageSquare,
    description: 'Envía notificaciones y alertas del CRM a canales y chats de Teams.',
    color: 'text-[#6264A7] border-[#6264A7]/30 bg-[#6264A7]/10',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    icon: HardDrive,
    description: 'Almacena expedientes y contratos en OneDrive de tu organización.',
    color: 'text-[#0078D4] border-[#0078D4]/30 bg-[#0078D4]/10',
  },
  {
    id: 'excel',
    name: 'Excel Online',
    icon: FileSpreadsheet,
    description: 'Lee y escribe reportes en archivos Excel almacenados en OneDrive.',
    color: 'text-[#217346] border-[#217346]/30 bg-[#217346]/10',
  },
];

type ServiceStatus = { connected: boolean; loading: boolean; error?: string };

export default function Microsoft365() {
  const [status, setStatus] = useState<Record<string, ServiceStatus>>({
    calendar: { connected: false, loading: false },
    teams: { connected: false, loading: false },
    onedrive: { connected: false, loading: false },
    excel: { connected: false, loading: false },
  });
  const [globalConfigured, setGlobalConfigured] = useState<boolean | null>(null);
  const [teamsWebhook, setTeamsWebhook] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [newEvent, setNewEvent] = useState({ subject: '', start: '', end: '', body: '', isOnlineMeeting: false });
  const [creating, setCreating] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState({ title: '', text: '' });
  const [sendingWebhook, setSendingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState('');
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'services' | 'calendar' | 'teams' | 'onedrive'>('services');

  useEffect(() => {
    fetch('/api/integrations/microsoft/status', {
      headers: { Authorization: `Bearer ${localStorage.getItem('hd_access_token') || ''}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setGlobalConfigured(d.configured ?? false);
        setTeamsWebhook(d.teamsWebhook ?? false);
      })
      .catch(() => setGlobalConfigured(false));
  }, []);

  const connectService = useCallback(async (serviceId: string) => {
    setStatus((prev) => ({ ...prev, [serviceId]: { connected: false, loading: true } }));
    try {
      const res = await fetch(`/api/integrations/microsoft/${serviceId}/connect`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('hd_access_token') || ''}` },
      });
      const data = await res.json();
      if (!data.url) throw new Error('No se recibió URL de autorización');
      const popup = window.open(data.url, `ms_${serviceId}`, 'width=520,height=640,left=200,top=80');
      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'microsoft_connected' && e.data?.service === serviceId) {
          window.removeEventListener('message', handler);
          popup?.close();
          setStatus((prev) => ({ ...prev, [serviceId]: { connected: true, loading: false } }));
        }
      };
      window.addEventListener('message', handler);
      setTimeout(() => {
        window.removeEventListener('message', handler);
        setStatus((prev) => ({ ...prev, [serviceId]: { ...prev[serviceId], loading: false } }));
      }, 120_000);
    } catch (err: any) {
      setStatus((prev) => ({ ...prev, [serviceId]: { connected: false, loading: false, error: err.message } }));
    }
  }, []);

  const loadOutlookEvents = useCallback(async (token: string) => {
    setEventsLoading(true);
    try {
      const res = await fetch('/api/integrations/microsoft/calendar/events?maxResults=10', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('hd_access_token') || ''}`,
          'x-ms-token': token,
        },
      });
      const data = await res.json();
      setEvents(data.events || []);
    } catch { /* ignore */ }
    finally { setEventsLoading(false); }
  }, []);

  const createOutlookEvent = useCallback(async (token: string) => {
    if (!newEvent.subject || !newEvent.start || !newEvent.end) return;
    setCreating(true);
    try {
      await fetch('/api/integrations/microsoft/calendar/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('hd_access_token') || ''}`,
          'x-ms-token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEvent),
      });
      setNewEvent({ subject: '', start: '', end: '', body: '', isOnlineMeeting: false });
      await loadOutlookEvents(token);
    } finally {
      setCreating(false);
    }
  }, [newEvent, loadOutlookEvents]);

  const sendWebhook = useCallback(async () => {
    if (!webhookMsg.title || !webhookMsg.text) return;
    setSendingWebhook(true);
    setWebhookResult('');
    try {
      const res = await fetch('/api/integrations/microsoft/teams/webhook', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('hd_access_token') || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...webhookMsg, themeColor: '6264A7' }),
      });
      const data = await res.json();
      setWebhookResult(data.ok ? '✅ Mensaje enviado a Teams' : `❌ ${data.error}`);
      if (data.ok) setWebhookMsg({ title: '', text: '' });
    } catch (err: any) {
      setWebhookResult(`❌ ${err.message}`);
    } finally {
      setSendingWebhook(false);
    }
  }, [webhookMsg]);

  const loadDriveFiles = useCallback(async (token: string) => {
    setDriveLoading(true);
    try {
      const res = await fetch('/api/integrations/microsoft/onedrive/files', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('hd_access_token') || ''}`,
          'x-ms-token': token,
        },
      });
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch { /* ignore */ }
    finally { setDriveLoading(false); }
  }, []);

  const tabs = [
    { id: 'services', label: 'Servicios' },
    { id: 'calendar', label: 'Outlook' },
    { id: 'teams', label: 'Teams' },
    { id: 'onedrive', label: 'OneDrive' },
  ] as const;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="hd-module-panel rounded-[20px] p-5">
        <SectionHeader
          eyebrow="Microsoft 365"
          title={<>Apps de <span className="text-[#0078D4]">Microsoft</span></>}
          description="Conecta Outlook Calendar, Teams, OneDrive y Excel con el CRM de Heavenly Dreams."
        />

        {globalConfigured === false && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/8 p-3 text-sm text-yellow-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Define <code className="rounded bg-black/30 px-1">MICROSOFT_OAUTH_CLIENT_ID</code> y <code className="rounded bg-black/30 px-1">MICROSOFT_OAUTH_CLIENT_SECRET</code> en Azure AD para activar las integraciones.</span>
          </div>
        )}

        {teamsWebhook && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#6264A7]/30 bg-[#6264A7]/8 p-2.5 text-xs text-[#9EA2D0]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#6264A7]" />
            Teams Incoming Webhook configurado
          </div>
        )}

        <div className="mt-5 flex gap-1 rounded-xl border border-white/8 bg-[#061b3a] p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${activeTab === t.id ? 'bg-[#0078D4] text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'services' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SERVICES.map((svc) => {
            const s = status[svc.id];
            return (
              <div key={svc.id} className="hd-module-panel rounded-2xl border border-white/8 p-5 transition-all hover:border-white/15">
                <div className="flex items-start justify-between mb-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${svc.color}`}>
                    <svc.icon className="w-5 h-5" />
                  </div>
                  {s.connected ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> Conectado
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-500">Desconectado</span>
                  )}
                </div>
                <h3 className="mb-1 text-sm font-semibold text-white">{svc.name}</h3>
                <p className="mb-4 text-xs leading-relaxed text-slate-400">{svc.description}</p>
                {s.error && <p className="mb-2 text-[10px] text-rose-400">{s.error}</p>}
                <button
                  onClick={() => connectService(svc.id)}
                  disabled={s.loading || (!globalConfigured && svc.id !== 'teams')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#0078D4]/30 bg-[#0078D4]/10 py-2 text-xs font-semibold text-[#0078D4] transition-all hover:bg-[#0078D4]/20 disabled:opacity-40"
                >
                  {s.loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  {s.connected ? 'Reconectar' : 'Conectar con Microsoft'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'calendar' && (
        <PremiumCard className="hd-module-panel p-5" tone="cyan">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Calendar className="w-4 h-4 text-[#0078D4]" /> Eventos de Outlook
            </h3>
            <button
              onClick={() => loadOutlookEvents('DEMO')}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-3 h-3 ${eventsLoading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </div>

          {events.length === 0 && !eventsLoading && (
            <p className="text-center text-xs text-slate-500 py-6">Conecta Outlook Calendar para ver tus eventos aquí.</p>
          )}
          <div className="space-y-2 mb-5">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0078D4]/10 text-[#0078D4]">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{ev.subject}</p>
                  <p className="text-[10px] text-slate-400">{new Date(ev.start?.dateTime || '').toLocaleString('es-MX')}</p>
                </div>
                {ev.isOnlineMeeting && <span className="text-[9px] font-semibold text-[#6264A7] bg-[#6264A7]/10 border border-[#6264A7]/20 rounded px-1.5 py-0.5">Teams</span>}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#0078D4]/20 bg-[#0078D4]/5 p-4 space-y-3">
            <h4 className="text-xs font-semibold text-[#5EA8E0]">Nuevo evento</h4>
            <input
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#0078D4]/50 focus:outline-none"
              placeholder="Asunto del evento"
              value={newEvent.subject}
              onChange={(e) => setNewEvent((p) => ({ ...p, subject: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white focus:border-[#0078D4]/50 focus:outline-none"
                value={newEvent.start}
                onChange={(e) => setNewEvent((p) => ({ ...p, start: e.target.value }))}
              />
              <input
                type="datetime-local"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white focus:border-[#0078D4]/50 focus:outline-none"
                value={newEvent.end}
                onChange={(e) => setNewEvent((p) => ({ ...p, end: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newEvent.isOnlineMeeting}
                onChange={(e) => setNewEvent((p) => ({ ...p, isOnlineMeeting: e.target.checked }))}
                className="rounded"
              />
              Incluir reunión de Teams
            </label>
            <button
              onClick={() => createOutlookEvent('DEMO')}
              disabled={creating || !newEvent.subject}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#0078D4] py-2 text-xs font-semibold text-white hover:bg-[#106EBE] disabled:opacity-40 transition-colors"
            >
              {creating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Crear evento
            </button>
          </div>
        </PremiumCard>
      )}

      {activeTab === 'teams' && (
        <PremiumCard className="hd-module-panel p-5" tone="cyan">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <MessageSquare className="w-4 h-4 text-[#6264A7]" /> Microsoft Teams
          </h3>

          <div className="space-y-4">
            <div className="rounded-xl border border-[#6264A7]/20 bg-[#6264A7]/5 p-4 space-y-3">
              <p className="text-xs font-semibold text-[#9EA2D0]">Enviar mensaje por Webhook</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Configura <code className="rounded bg-black/30 px-1">MICROSOFT_TEAMS_WEBHOOK_URL</code> en tu servidor para enviar notificaciones sin OAuth.
              </p>
              <input
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#6264A7]/50 focus:outline-none"
                placeholder="Título del mensaje"
                value={webhookMsg.title}
                onChange={(e) => setWebhookMsg((p) => ({ ...p, title: e.target.value }))}
              />
              <textarea
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#6264A7]/50 focus:outline-none"
                placeholder="Contenido del mensaje…"
                value={webhookMsg.text}
                onChange={(e) => setWebhookMsg((p) => ({ ...p, text: e.target.value }))}
              />
              {webhookResult && (
                <p className="text-[10px] text-slate-300">{webhookResult}</p>
              )}
              <button
                onClick={sendWebhook}
                disabled={sendingWebhook || !webhookMsg.title || !teamsWebhook}
                className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#6264A7] py-2 text-xs font-semibold text-white hover:bg-[#4E5090] disabled:opacity-40 transition-colors"
              >
                {sendingWebhook ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {teamsWebhook ? 'Enviar a Teams' : 'Webhook no configurado'}
              </button>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-xs">
              <p className="font-semibold text-white mb-2">Endpoints Graph API</p>
              <ul className="space-y-1 font-mono text-[10px]">
                <li className="text-cyan-400">GET  /api/integrations/microsoft/teams/list</li>
                <li className="text-cyan-400">GET  /api/integrations/microsoft/teams/:id/channels</li>
                <li className="text-cyan-400">POST /api/integrations/microsoft/teams/message</li>
                <li className="text-cyan-400">POST /api/integrations/microsoft/teams/webhook</li>
              </ul>
            </div>
          </div>
        </PremiumCard>
      )}

      {activeTab === 'onedrive' && (
        <PremiumCard className="hd-module-panel p-5" tone="cyan">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <HardDrive className="w-4 h-4 text-[#0078D4]" /> OneDrive
            </h3>
            <button
              onClick={() => loadDriveFiles('DEMO')}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-3 h-3 ${driveLoading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </div>

          {driveFiles.length === 0 && !driveLoading && (
            <p className="text-center text-xs text-slate-500 py-6">Conecta OneDrive para ver tus archivos aquí.</p>
          )}
          <div className="space-y-2">
            {driveFiles.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0078D4]/10 text-[#0078D4]">
                  {f.folder ? <FolderOpen className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{f.name}</p>
                  <p className="text-[10px] text-slate-400">{f.size ? `${(f.size / 1024).toFixed(1)} KB` : 'Carpeta'}</p>
                </div>
                {f.webUrl && (
                  <a href={f.webUrl} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </PremiumCard>
      )}
    </div>
  );
}
