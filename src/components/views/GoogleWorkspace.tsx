import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, FileSpreadsheet, Users, HardDrive, RefreshCw,
  Plus, Trash2, ExternalLink, CheckCircle2, AlertCircle,
  ChevronRight, Clock, Mail,
} from 'lucide-react';
import { PremiumCard, SectionHeader } from '../ui/premium';

interface GoogleServiceCard {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  scope: string;
  color: string;
}

const SERVICES: GoogleServiceCard[] = [
  {
    id: 'calendar',
    name: 'Google Calendar',
    icon: Calendar,
    description: 'Sincroniza citas, seguimientos y eventos del CRM con tu agenda de Google.',
    scope: 'Calendars.ReadWrite',
    color: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    icon: FileSpreadsheet,
    description: 'Exporta ventas, leads y reportes directamente a hojas de cálculo de Google.',
    scope: 'Spreadsheets.ReadWrite',
    color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  },
  {
    id: 'contacts',
    name: 'Google Contacts',
    icon: Users,
    description: 'Sincroniza clientes y prospectos del CRM con tu libreta de contactos.',
    scope: 'Contacts.ReadWrite',
    color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  },
  {
    id: 'drive',
    name: 'Google Drive',
    icon: HardDrive,
    description: 'Almacena expedientes, contratos y documentos firmados en la nube de Google.',
    scope: 'Drive.ReadWrite',
    color: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
  },
];

type ServiceStatus = { connected: boolean; loading: boolean; error?: string };

export default function GoogleWorkspace() {
  const [status, setStatus] = useState<Record<string, ServiceStatus>>({
    calendar: { connected: false, loading: false },
    sheets: { connected: false, loading: false },
    contacts: { connected: false, loading: false },
    drive: { connected: false, loading: false },
  });
  const [globalConfigured, setGlobalConfigured] = useState<boolean | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [newEvent, setNewEvent] = useState({ summary: '', start: '', end: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [activeTab, setActiveTab] = useState<'services' | 'calendar' | 'sheets' | 'contacts'>('services');

  useEffect(() => {
    fetch('/api/integrations/google/status', {
      headers: { Authorization: `Bearer ${localStorage.getItem('hd_access_token') || ''}` },
    })
      .then((r) => r.json())
      .then((d) => setGlobalConfigured(d.configured ?? false))
      .catch(() => setGlobalConfigured(false));
  }, []);

  const connectService = useCallback(async (serviceId: string) => {
    setStatus((prev) => ({ ...prev, [serviceId]: { connected: false, loading: true } }));
    try {
      const res = await fetch(`/api/integrations/google/${serviceId}/connect`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('hd_access_token') || ''}` },
      });
      const data = await res.json();
      if (!data.url) throw new Error('No se recibió URL de autorización');
      const popup = window.open(data.url, `google_${serviceId}`, 'width=520,height=620,left=200,top=80');
      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'google_connected' && e.data?.service === serviceId) {
          window.removeEventListener('message', handler);
          popup?.close();
          setStatus((prev) => ({ ...prev, [serviceId]: { connected: true, loading: false } }));
        }
      };
      window.addEventListener('message', handler);
      // timeout cleanup
      setTimeout(() => {
        window.removeEventListener('message', handler);
        setStatus((prev) => ({ ...prev, [serviceId]: { ...prev[serviceId], loading: false } }));
      }, 120_000);
    } catch (err: any) {
      setStatus((prev) => ({ ...prev, [serviceId]: { connected: false, loading: false, error: err.message } }));
    }
  }, []);

  const loadCalendarEvents = useCallback(async (token: string) => {
    setEventsLoading(true);
    try {
      const res = await fetch('/api/integrations/google/calendar/events?maxResults=10', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('hd_access_token') || ''}`,
          'x-google-token': token,
        },
      });
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      /* ignore */
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const createEvent = useCallback(async (token: string) => {
    setFormError('');
    if (!newEvent.summary.trim()) { setFormError('El título del evento es obligatorio.'); return; }
    if (!newEvent.start) { setFormError('La fecha de inicio es obligatoria.'); return; }
    if (!newEvent.end) { setFormError('La fecha de fin es obligatoria.'); return; }
    if (newEvent.end <= newEvent.start) { setFormError('La fecha de fin debe ser posterior al inicio.'); return; }
    setCreating(true);
    try {
      await fetch('/api/integrations/google/calendar/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('hd_access_token') || ''}`,
          'x-google-token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEvent),
      });
      setNewEvent({ summary: '', start: '', end: '', description: '' });
      setFormError('');
      await loadCalendarEvents(token);
    } finally {
      setCreating(false);
    }
  }, [newEvent, loadCalendarEvents]);

  const tabs = [
    { id: 'services', label: 'Servicios' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'sheets', label: 'Sheets' },
    { id: 'contacts', label: 'Contacts' },
  ] as const;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="hd-module-panel rounded-[20px] p-5">
        <SectionHeader
          eyebrow="Google Workspace"
          title={<>Apps de <span className="text-[#4285F4]">Google</span></>}
          description="Conecta Calendar, Sheets, Contacts y Drive del CRM con tu cuenta de Google Workspace."
        />

        {globalConfigured === false && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/8 p-3 text-sm text-yellow-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Define <code className="rounded bg-black/30 px-1">GOOGLE_OAUTH_CLIENT_ID</code> y <code className="rounded bg-black/30 px-1">GOOGLE_OAUTH_CLIENT_SECRET</code> para activar las integraciones.</span>
          </div>
        )}

        <div className="mt-5 flex gap-1 rounded-xl border border-white/8 bg-[#061b3a] p-1" role="tablist" aria-label="Google Workspace">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              aria-controls={`gws-panel-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${activeTab === t.id ? 'bg-[#4285F4] text-white' : 'text-slate-400 hover:text-white'}`}
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
                  disabled={s.loading || !globalConfigured}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#4285F4]/30 bg-[#4285F4]/10 py-2 text-xs font-semibold text-[#4285F4] transition-all hover:bg-[#4285F4]/20 disabled:opacity-40"
                >
                  {s.loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  {s.connected ? 'Reconectar' : 'Conectar con Google'}
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
              <Calendar className="w-4 h-4 text-blue-400" /> Eventos de Calendar
            </h3>
            <button
              onClick={() => loadCalendarEvents('DEMO')}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-3 h-3 ${eventsLoading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </div>

          {events.length === 0 && !eventsLoading && (
            <p className="text-center text-xs text-slate-500 py-6">Conecta Google Calendar para ver tus eventos aquí.</p>
          )}
          <div className="space-y-2 mb-5">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-400/10 text-blue-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{ev.summary}</p>
                  <p className="text-[10px] text-slate-400">{new Date(ev.start?.dateTime || ev.start?.date || '').toLocaleString('es-MX')}</p>
                </div>
                {ev.htmlLink && (
                  <a href={ev.htmlLink} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-4 space-y-3">
            <h4 className="text-xs font-semibold text-blue-300">Nuevo evento</h4>
            <input
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-blue-400/50 focus:outline-none"
              placeholder="Título del evento"
              value={newEvent.summary}
              onChange={(e) => setNewEvent((p) => ({ ...p, summary: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white focus:border-blue-400/50 focus:outline-none"
                value={newEvent.start}
                onChange={(e) => setNewEvent((p) => ({ ...p, start: e.target.value }))}
              />
              <input
                type="datetime-local"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white focus:border-blue-400/50 focus:outline-none"
                value={newEvent.end}
                onChange={(e) => setNewEvent((p) => ({ ...p, end: e.target.value }))}
              />
            </div>
            {formError && (
              <p className="flex items-center gap-1.5 text-[10px] text-rose-400" role="alert">
                <AlertCircle className="w-3 h-3 shrink-0" /> {formError}
              </p>
            )}
            <button
              onClick={() => createEvent('DEMO')}
              disabled={creating}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-blue-500 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-40 transition-colors"
            >
              {creating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Crear evento
            </button>
          </div>
        </PremiumCard>
      )}

      {activeTab === 'sheets' && (
        <PremiumCard className="hd-module-panel p-5" tone="cyan">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Google Sheets
          </h3>
          <div className="space-y-3 text-xs text-slate-400">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
              <p className="font-semibold text-emerald-300 mb-2">Exportar ventas a Sheets</p>
              <p className="mb-3 leading-relaxed">Conecta Google Sheets para exportar reportes de ventas, leads y comisiones automáticamente.</p>
              <button
                onClick={() => connectService('sheets')}
                className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-400/20 transition-colors"
              >
                <Plus className="w-3 h-3" /> Conectar Sheets
              </button>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="font-semibold text-white mb-1">Endpoints disponibles</p>
              <ul className="space-y-1 font-mono text-[10px]">
                <li className="text-cyan-400">GET  /api/integrations/google/sheets/read</li>
                <li className="text-cyan-400">POST /api/integrations/google/sheets/append</li>
                <li className="text-cyan-400">POST /api/integrations/google/sheets/create</li>
              </ul>
            </div>
          </div>
        </PremiumCard>
      )}

      {activeTab === 'contacts' && (
        <PremiumCard className="hd-module-panel p-5" tone="cyan">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Users className="w-4 h-4 text-yellow-400" /> Google Contacts
          </h3>
          <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-xs">
            <p className="font-semibold text-yellow-300 mb-2">Sincronización de contactos</p>
            <p className="text-slate-400 mb-3 leading-relaxed">Importa y exporta clientes y prospectos del CRM directamente desde tu cuenta de Google Contacts.</p>
            <button
              onClick={() => connectService('contacts')}
              className="flex items-center gap-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-400/20 transition-colors"
            >
              <Plus className="w-3 h-3" /> Conectar Contacts
            </button>
          </div>
        </PremiumCard>
      )}
    </div>
  );
}
