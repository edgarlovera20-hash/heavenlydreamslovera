import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import {
  Zap, Globe, Database, Cpu,
  MessageSquare, Share2, Plus,
  CheckCircle2, Settings, Power, RefreshCw,
  Calendar, FileSpreadsheet, HardDrive, Users,
} from 'lucide-react';
import { PremiumBadge, PremiumButton, PremiumCard, SectionHeader } from '../ui/premium';

const GoogleWorkspace = lazy(() => import('./GoogleWorkspace'));
const Microsoft365 = lazy(() => import('./Microsoft365'));

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: 'cyan' | 'blue' | 'purple' | 'green' | 'yellow' | 'pink' | 'red';
  status: 'connected' | 'disconnected' | 'configuring';
  category: 'Communication' | 'Development' | 'Cloud' | 'AI' | 'Google' | 'Microsoft';
}

const AVAILABLE_INTEGRATIONS: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Recibe notificaciones críticas y gestiona tickets directamente desde Slack.',
    icon: MessageSquare,
    color: 'purple',
    status: 'connected',
    category: 'Communication',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Almacenamiento en la nube para expedientes y contratos firmados.',
    icon: Database,
    color: 'blue',
    status: 'configuring',
    category: 'Google',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sincroniza citas y seguimientos del CRM con tu agenda de Google.',
    icon: Calendar,
    color: 'blue',
    status: 'disconnected',
    category: 'Google',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Exporta ventas y reportes directamente a hojas de cálculo.',
    icon: FileSpreadsheet,
    color: 'green',
    status: 'disconnected',
    category: 'Google',
  },
  {
    id: 'ms-outlook',
    name: 'Outlook Calendar',
    description: 'Sincroniza citas y reuniones con tu calendario de Microsoft Outlook.',
    icon: Calendar,
    color: 'blue',
    status: 'disconnected',
    category: 'Microsoft',
  },
  {
    id: 'ms-teams',
    name: 'Microsoft Teams',
    description: 'Envía notificaciones y alertas del CRM a canales de Teams.',
    icon: MessageSquare,
    color: 'purple',
    status: 'disconnected',
    category: 'Microsoft',
  },
  {
    id: 'ms-onedrive',
    name: 'OneDrive',
    description: 'Almacena expedientes y documentos en OneDrive de tu organización.',
    icon: HardDrive,
    color: 'blue',
    status: 'disconnected',
    category: 'Microsoft',
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Webhooks para anuncios y eventos de sistema en tiempo real.',
    icon: Share2,
    color: 'blue',
    status: 'disconnected',
    category: 'Communication',
  },
  {
    id: 'ollama',
    name: 'Ollama local',
    description: 'Motor privado para OCR documental, validación de capturas y agentes.',
    icon: Cpu,
    color: 'green',
    status: 'connected',
    category: 'AI',
  },
];

type TabId = 'All' | 'Google' | 'Microsoft' | 'Communication' | 'AI';

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(AVAILABLE_INTEGRATIONS);
  const [filter, setFilter] = useState<TabId>('All');
  const [activeSection, setActiveSection] = useState<'hub' | 'google' | 'microsoft'>('hub');
  const [oauthStatus, setOauthStatus] = useState<{ google: boolean; microsoft: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/auth/oauth/status')
      .then((r) => r.json())
      .then((d) => setOauthStatus({ google: d.google, microsoft: d.microsoft }))
      .catch(() => {});
  }, []);

  const toggleStatus = (id: string) => {
    setIntegrations((prev) =>
      prev.map((int) =>
        int.id === id
          ? { ...int, status: int.status === 'connected' ? 'disconnected' : 'connected' }
          : int,
      ),
    );
  };

  const filteredIntegrations = integrations.filter((int) => {
    if (filter === 'All') return true;
    return int.category === filter;
  });

  const TABS: { id: TabId; label: string }[] = [
    { id: 'All', label: 'Todos' },
    { id: 'Google', label: 'Google' },
    { id: 'Microsoft', label: 'Microsoft' },
    { id: 'Communication', label: 'Comunicación' },
    { id: 'AI', label: 'IA' },
  ];

  return (
    <div className="hd-clean-module relative w-full space-y-8 overflow-visible rounded-[22px] p-1 animate-in fade-in slide-in-from-bottom-4 duration-500">

      <div className="hd-module-panel relative z-10 rounded-[20px] p-5">
        <SectionHeader
          eyebrow="Integraciones"
          title={<>Centro de <span className="text-cyan-300">protocolos</span></>}
          description="Conecta Google Workspace, Microsoft 365 y servicios externos sin saturar la operación del CRM."
          action={<PremiumBadge tone="cyan" dot>{filteredIntegrations.length} visibles</PremiumBadge>}
        />

        {/* Section selector */}
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { id: 'hub', label: 'Hub de integraciones' },
            { id: 'google', label: '🔵 Google Workspace' },
            { id: 'microsoft', label: '🪟 Microsoft 365' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id as any)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeSection === s.id
                  ? 'bg-cyan-400 text-slate-950'
                  : 'border border-cyan-300/16 bg-[#061b3a] text-slate-400 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* OAuth status chips */}
        {oauthStatus && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${oauthStatus.google ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-slate-600/30 bg-slate-800/20 text-slate-500'}`}>
              {oauthStatus.google ? <CheckCircle2 className="w-3 h-3" /> : <Power className="w-3 h-3" />}
              Google OAuth {oauthStatus.google ? 'configurado' : 'no configurado'}
            </span>
            <span className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${oauthStatus.microsoft ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-slate-600/30 bg-slate-800/20 text-slate-500'}`}>
              {oauthStatus.microsoft ? <CheckCircle2 className="w-3 h-3" /> : <Power className="w-3 h-3" />}
              Microsoft OAuth {oauthStatus.microsoft ? 'configurado' : 'no configurado'}
            </span>
          </div>
        )}
      </div>

      {activeSection === 'hub' && (
        <>
          {/* Category filter */}
          <div className="relative z-10 flex w-full flex-wrap items-center gap-2 rounded-2xl border border-cyan-300/16 bg-[#061b3a] p-1.5 sm:w-fit">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  filter === t.id
                    ? 'bg-cyan-300 text-slate-950'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative z-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onToggle={() => toggleStatus(integration.id)}
                onManage={integration.category === 'Google' ? () => setActiveSection('google') : integration.category === 'Microsoft' ? () => setActiveSection('microsoft') : undefined}
              />
            ))}

            <button className="hd-module-panel group flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-cyan-300/22 p-8 transition-all hover:border-cyan-300/45">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-500 transition-all group-hover:border-cyan-300/45 group-hover:text-cyan-300">
                <Plus className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h3 className="mb-1 text-sm font-semibold text-white">Nueva integración</h3>
                <p className="text-xs font-medium tracking-[0.06em] text-slate-500">Protocolos custom / webhooks</p>
              </div>
            </button>
          </div>

          <PremiumCard className="hd-module-panel relative z-10 overflow-hidden p-6" tone="purple">
            <div className="relative z-10 flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyber-electric/25 bg-cyber-electric/10 text-cyber-electric">
                  <RefreshCw className="w-4 h-4 animate-spin-slow" />
                </div>
                <h3 className="text-base font-semibold text-white">Registros de sincronización</h3>
              </div>
              <button className="text-slate-500 hover:text-white transition-colors">
                <span className="text-xs font-semibold">Limpiar logs</span>
              </button>
            </div>
            <div className="space-y-3 font-mono">
              <LogItem title="Ollama OCR" status="SUCCESS" time="Hace 2 min" desc="Validación de captura ID-4589 completada exitosamente." />
              <LogItem title="Google Drive" status="WAITING" time="Hace 15 min" desc="Sincronización de expediente en espera de red." />
              <LogItem title="Slack Webhook" status="SUCCESS" time="Hace 45 min" desc="Notificación de nueva venta enviada al canal #ventas." />
              <LogItem title="Teams Webhook" status="ERROR" time="Hace 1 hora" desc="MICROSOFT_TEAMS_WEBHOOK_URL no configurada." isError />
            </div>
          </PremiumCard>
        </>
      )}

      {activeSection === 'google' && (
        <ErrorBoundary label="Google Workspace">
          <Suspense fallback={<div className="py-12 text-center text-xs text-slate-500">Cargando Google Workspace…</div>}>
            <GoogleWorkspace />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeSection === 'microsoft' && (
        <ErrorBoundary label="Microsoft 365">
          <Suspense fallback={<div className="py-12 text-center text-xs text-slate-500">Cargando Microsoft 365…</div>}>
            <Microsoft365 />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}

const IntegrationCard: React.FC<{
  integration: Integration;
  onToggle: () => void;
  onManage?: () => void;
}> = ({ integration, onToggle, onManage }) => {
  const isConnected = integration.status === 'connected';
  const isConfiguring = integration.status === 'configuring';
  const toneClass: Record<string, string> = {
    cyan: 'hd-tone-cyan',
    blue: 'hd-tone-blue',
    purple: 'hd-tone-violet',
    green: 'hd-tone-emerald',
    yellow: 'hd-tone-amber',
    pink: 'hd-tone-pink',
    red: 'hd-tone-pink',
    slate: 'hd-tone-slate',
  };

  const categoryBadge: Record<string, string> = {
    Google: 'text-[#4285F4] border-[#4285F4]/20 bg-[#4285F4]/8',
    Microsoft: 'text-[#0078D4] border-[#0078D4]/20 bg-[#0078D4]/8',
    Communication: 'text-violet-400 border-violet-400/20 bg-violet-400/8',
    AI: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/8',
    Cloud: 'text-cyan-400 border-cyan-400/20 bg-cyan-400/8',
    Development: 'text-slate-400 border-slate-400/20 bg-slate-400/8',
  };

  return (
    <div
      className={`hd-module-panel hd-integration-card ${toneClass[integration.color] || 'hd-tone-cyan'} relative group overflow-hidden transition-all duration-300 p-6 rounded-2xl border ${
        isConnected
          ? 'border-cyber-electric/28 hover:border-cyber-electric/48'
          : 'border-cyan-300/14 hover:border-cyan-300/26'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-[#082a5e] border flex items-center justify-center ${
          isConnected ? 'border-cyber-electric/42 text-cyber-electric' : 'border-cyan-300/12 text-slate-400'
        }`}>
          <integration.icon className="w-6 h-6" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border ${categoryBadge[integration.category] || 'text-slate-400 border-slate-400/20 bg-slate-400/8'}`}>
            {integration.category}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-md ${
            isConnected ? 'bg-cyber-electric/10 text-cyber-electric border border-cyber-electric/20' :
            isConfiguring ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
            'bg-[#061b3a] text-slate-400 border border-cyan-300/12'
          }`}>
            {isConnected ? 'conectado' : isConfiguring ? 'configurando' : 'inactivo'}
          </span>
        </div>
      </div>

      <div className="mb-5">
        <h3 className="text-white font-semibold text-base mb-1 group-hover:text-cyber-electric transition-colors">{integration.name}</h3>
        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{integration.description}</p>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        {isConnected ? (
          <>
            <PremiumButton onClick={onManage || onToggle} className="px-4 py-2 text-xs">
              Gestionar
            </PremiumButton>
            <button className="p-2 rounded-lg bg-[#082a5e] text-slate-300 hover:text-white hover:bg-[#0a3677] transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
          </>
        ) : isConfiguring ? (
          <button
            onClick={onManage || onToggle}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-yellow-400 font-semibold text-xs hover:bg-yellow-500/10 transition-all"
          >
            <Settings className="w-3.5 h-3.5 animate-spin-slow" />
            Completar setup
          </button>
        ) : (
          <button
            onClick={onManage || onToggle}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-cyan-300/14 bg-[#082a5e] text-slate-200 font-semibold text-xs hover:border-cyber-electric/45 hover:text-white hover:bg-[#0a3677] transition-all group/btn"
          >
            <Power className="w-3.5 h-3.5 group-hover/btn:text-cyber-electric transition-colors" />
            Conectar
          </button>
        )}
      </div>
    </div>
  );
};

function LogItem({ title, status, time, desc, isError = false }: any) {
  return (
    <div className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-2 transition-all ${
      isError ? 'bg-rose-500/7 border-rose-500/22' : 'bg-[#061b3a] border-cyan-300/12 hover:border-cyan-300/22'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${
          status === 'SUCCESS' ? 'bg-cyan-400' :
          status === 'WAITING' ? 'bg-yellow-400' :
          'bg-rose-400'
        }`} />
        <div className="flex flex-col md:flex-row md:items-center md:gap-4">
          <span className="text-[11px] font-semibold text-white tracking-[0.08em] min-w-[120px]">{title}</span>
          <span className="text-[10px] font-medium text-slate-400 line-clamp-1">{desc}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 justify-end italic">
        <span className={`text-[9px] font-bold ${isError ? 'text-rose-300' : 'text-slate-400'}`}>{status}</span>
        <span className="text-[9px] text-slate-500 font-bold">{time}</span>
      </div>
    </div>
  );
}
