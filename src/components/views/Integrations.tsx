import React, { useState } from 'react';
import { 
  Zap, Slack, Github, Globe, Database, Cpu, 
  MessageSquare, FileCode, Share2, Plus, 
  ExternalLink, CheckCircle2, AlertCircle, 
  Settings, Trash2, Power, RefreshCw
} from 'lucide-react';
import { PremiumBadge, PremiumButton, PremiumCard, SectionHeader } from '../ui/premium';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: 'cyan' | 'blue' | 'purple' | 'green' | 'yellow' | 'pink' | 'red';
  status: 'connected' | 'disconnected' | 'configuring';
  category: 'Communication' | 'Development' | 'Cloud' | 'AI';
}

const AVAILABLE_INTEGRATIONS: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Recibe notificaciones críticas y gestiona tickets directamente desde Slack.',
    icon: MessageSquare,
    color: 'purple',
    status: 'connected',
    category: 'Communication'
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Sincroniza el despliegue de contratos y repositorios de agentes IA.',
    icon: Github,
    color: 'slate' as any,
    status: 'disconnected',
    category: 'Development'
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Almacenamiento en la nube para expedientes y contratos firmados.',
    icon: Database,
    color: 'blue',
    status: 'configuring',
    category: 'Cloud'
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Webhooks para anuncios y eventos de sistema en tiempo real.',
    icon: Share2,
    color: 'blue',
    status: 'disconnected',
    category: 'Communication'
  },
  {
    id: 'ollama',
    name: 'Ollama / Gemini',
    description: 'Motor de inteligencia artificial para validación de capturas y agentes.',
    icon: Cpu,
    color: 'green',
    status: 'connected',
    category: 'AI'
  }
];

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(AVAILABLE_INTEGRATIONS);
  const [filter, setFilter] = useState<'All' | 'Connected' | 'Communication' | 'AI'>('All');

  const toggleStatus = (id: string) => {
    setIntegrations(prev => prev.map(int => {
      if (int.id === id) {
        return {
          ...int,
          status: int.status === 'connected' ? 'disconnected' : 'connected'
        };
      }
      return int;
    }));
  };

  const filteredIntegrations = integrations.filter(int => {
    if (filter === 'All') return true;
    if (filter === 'Connected') return int.status === 'connected';
    return int.category === filter;
  });

  return (
    <div className="relative w-full space-y-8 overflow-hidden rounded-[22px] p-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-[22px] bg-[radial-gradient(circle_at_18%_8%,rgba(14,165,233,0.16),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(34,211,238,0.08),transparent_26%),linear-gradient(180deg,rgba(8,15,28,0.96),rgba(3,8,16,0.99))]" />
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-[22px] opacity-[0.16] [background-image:linear-gradient(rgba(125,211,252,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.18)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute inset-x-8 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      
      <div className="relative z-10 rounded-[20px] border border-cyan-300/10 bg-slate-950/35 p-5 backdrop-blur-sm">
        <SectionHeader
          eyebrow="Integraciones"
          title={<>Centro de <span className="text-cyan-300">protocolos</span></>}
          description="Conecta servicios externos, agentes y almacenamiento sin saturar la operación del CRM."
          action={<PremiumBadge tone="cyan" dot>{filteredIntegrations.length} visibles</PremiumBadge>}
        />
        
        <div className="mt-5 flex w-full flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1.5 sm:w-fit">
          {['All', 'Connected', 'Communication', 'AI'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                filter === f 
                ? 'bg-cyan-300 text-slate-950' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {f === 'All' ? 'Todos' : f === 'Connected' ? 'Conectados' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filteredIntegrations.map((integration) => (
          <IntegrationCard 
            key={integration.id} 
            integration={integration} 
            onToggle={() => toggleStatus(integration.id)}
          />
        ))}
        
        {/* Add New Integration Card */}
        <button className="hd-card hd-card-interactive hd-tone-amber group flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-cyan-300/18 p-8 transition-all hover:border-cyan-300/45">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-500 transition-all group-hover:border-cyan-300/45 group-hover:text-cyan-300">
            <Plus className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h3 className="mb-1 text-sm font-semibold text-white">Nueva integración</h3>
            <p className="text-xs font-medium tracking-[0.06em] text-slate-500">Protocolos custom / webhooks</p>
          </div>
        </button>
      </div>

      {/* System Logs / Integration Activity */}
      <PremiumCard className="relative z-10 overflow-hidden p-6" tone="purple">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(14,165,233,0.12),transparent_34%)]" />
        <div className="absolute top-0 left-0 w-1 h-full bg-cyber-electric/30"></div>
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
          <LogItem title="Google Drive" status="WAITING" time="Hace 15 min" desc="Sincronización de expediente 'Contrato_Gomez.pdf' en espera de red." />
          <LogItem title="Slack Webhook" status="SUCCESS" time="Hace 45 min" desc="Notificación de nueva venta enviada al canal #ventas-mexico." />
          <LogItem title="Discord" status="ERROR" time="Hace 1 hora" desc="Fallo en la autenticación del Bearer Token. Reintentando..." isError />
        </div>
      </PremiumCard>
    </div>
  );
}

const IntegrationCard: React.FC<{ integration: Integration; onToggle: () => void }> = ({ 
  integration, 
  onToggle 
}) => {
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

  return (
    <div className={`hd-card hd-card-interactive ${toneClass[integration.color] || 'hd-tone-cyan'} relative group overflow-hidden transition-all duration-300 p-6 rounded-2xl border backdrop-blur-sm ${
      isConnected 
      ? 'bg-slate-950/78 border-cyber-electric/28 hover:border-cyber-electric/48' 
      : 'bg-slate-950/48 border-white/10 hover:border-white/18'
    }`}>
      {/* Glow Effect */}
      {isConnected && (
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-cyber-electric/8 blur-3xl rounded-full group-hover:bg-cyber-electric/12 transition-colors"></div>
      )}

      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-xl bg-white/[0.035] border flex items-center justify-center ${
          isConnected ? 'border-cyber-electric/50 text-cyber-electric' : 'border-slate-800 text-slate-500'
        }`}>
          <integration.icon className="w-6 h-6" />
        </div>
        
        <div className="flex flex-col items-end">
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-md mb-2 ${
            isConnected ? 'bg-cyber-electric/10 text-cyber-electric border border-cyber-electric/20' : 
            isConfiguring ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
            'bg-slate-800/50 text-slate-500 border border-slate-700'
          }`}>
            {integration.status}
          </span>
          {isConnected && <CheckCircle2 className="w-4 h-4 text-cyber-electric drop-shadow-[0_0_5px_rgba(0,229,255,0.5)]" />}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-white font-semibold text-lg mb-1 group-hover:text-cyber-electric transition-colors">{integration.name}</h3>
        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{integration.description}</p>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        {isConnected ? (
          <>
            <PremiumButton
              onClick={onToggle}
              className="px-4 py-2 text-xs"
            >
              Gestionar
            </PremiumButton>
            <button className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all ml-auto">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        ) : isConfiguring ? (
          <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-yellow-400 font-semibold text-xs hover:bg-yellow-500/10 transition-all">
            <Settings className="w-3.5 h-3.5 animate-spin-slow" />
            Completar setup
          </button>
        ) : (
          <button 
            onClick={onToggle}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 bg-white/[0.025] text-slate-300 font-semibold text-xs hover:border-cyber-electric/50 hover:text-white transition-all group/btn"
          >
            <Power className="w-3.5 h-3.5 group-hover/btn:text-cyber-electric transition-colors" />
            Conectar protocolo
          </button>
        )}
      </div>
    </div>
  );
};

function LogItem({ title, status, time, desc, isError = false }: any) {
  return (
    <div className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-2 group transition-all ${
      isError ? 'bg-rose-500/5 border-rose-500/20' : 'bg-white/[0.035] border-white/8 hover:border-white/16'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${
          status === 'SUCCESS' ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]' :
          status === 'WAITING' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]' :
          'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
        }`}></div>
        <div className="flex flex-col md:flex-row md:items-center md:gap-4">
          <span className="text-[11px] font-semibold text-white tracking-[0.08em] min-w-[100px]">{title}</span>
          <span className="text-[10px] font-medium text-slate-500 line-clamp-1">{desc}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 justify-end italic">
         <span className={`text-[9px] font-bold ${isError ? 'text-rose-400' : 'text-slate-600'}`}>{status}</span>
         <span className="text-[9px] text-slate-700 font-bold">{time}</span>
      </div>
    </div>
  );
}
