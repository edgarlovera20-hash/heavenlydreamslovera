import React, { useState } from 'react';
import { 
  Zap, Slack, Github, Globe, Database, Cpu, 
  MessageSquare, FileCode, Share2, Plus, 
  ExternalLink, CheckCircle2, AlertCircle, 
  Settings, Trash2, Power, RefreshCw
} from 'lucide-react';
import { CyberIcon } from '../ui/CyberIcon';
import { MatrixText } from '../ui/matrix-text';
import NetworkPattern from '../ui/NetworkPattern';

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
    id: 'openai',
    name: 'OpenAI / Gemini',
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
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <NetworkPattern opacity={0.1} density={40} color="#FFFFFF" className="z-0" />
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Zap className="text-yellow-400 w-6 h-6 animate-pulse shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
            <h2 className="text-3xl font-bold tracking-tight text-white uppercase">
              Centros de <span className="text-cyber-electric">Integración</span>
            </h2>
          </div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-[0.2em]">
            Conecta protocolos externos para potenciar el ecosistema Heavenly Dreams
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-[#0A0D14]/80 p-1.5 rounded-xl border border-slate-800/50">
          {['All', 'Connected', 'Communication', 'AI'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === f 
                ? 'bg-cyber-electric text-cyber-black shadow-[0_0_15px_rgba(3,154,220,0.4)]' 
                : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {f === 'All' ? 'Todos' : f === 'Connected' ? 'Conectados' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredIntegrations.map((integration) => (
          <IntegrationCard 
            key={integration.id} 
            integration={integration} 
            onToggle={() => toggleStatus(integration.id)}
          />
        ))}
        
        {/* Add New Integration Card */}
        <button className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-800 bg-[#0A0D14]/40 hover:bg-[#0A0D14]/60 hover:border-cyber-electric/50 transition-all group gap-4 min-h-[220px]">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 group-hover:text-cyber-electric group-hover:border-cyber-electric/50 group-hover:shadow-[0_0_20px_rgba(3,154,220,0.2)] transition-all">
            <Plus className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-1">Nueva Integración</h3>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">Protocolos Custom / Webhooks</p>
          </div>
        </button>
      </div>

      {/* System Logs / Integration Activity */}
      <div className="bg-[#0A0D14]/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden">
        <NetworkPattern opacity={0.06} color="#FFFFFF" density={80} className="z-0" />
        <div className="absolute top-0 left-0 w-1 h-full bg-cyber-electric/30"></div>
        <div className="relative z-10 flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-cyber-electric/10 border border-cyber-electric/30 flex items-center justify-center text-cyber-electric shadow-[0_0_10px_rgba(3,154,220,0.2)]">
                <RefreshCw className="w-4 h-4 animate-spin-slow" />
             </div>
             <h3 className="text-sm font-bold text-white uppercase tracking-widest">Registros de Sincronización</h3>
          </div>
          <button className="text-slate-500 hover:text-white transition-colors">
            <span className="text-[10px] font-bold uppercase tracking-widest">Limpiar Logs</span>
          </button>
        </div>
        
        <div className="space-y-3 font-mono">
          <LogItem title="OpenAI API" status="SUCCESS" time="Hace 2 min" desc="Validación de captura ID-4589 completada exitosamente." />
          <LogItem title="Google Drive" status="WAITING" time="Hace 15 min" desc="Sincronización de expediente 'Contrato_Gomez.pdf' en espera de red." />
          <LogItem title="Slack Webhook" status="SUCCESS" time="Hace 45 min" desc="Notificación de nueva venta enviada al canal #ventas-mexico." />
          <LogItem title="Discord" status="ERROR" time="Hace 1 hora" desc="Fallo en la autenticación del Bearer Token. Reintentando..." isError />
        </div>
      </div>
    </div>
  );
}

const IntegrationCard: React.FC<{ integration: Integration; onToggle: () => void }> = ({ 
  integration, 
  onToggle 
}) => {
  const isConnected = integration.status === 'connected';
  const isConfiguring = integration.status === 'configuring';

  return (
    <div className={`relative group transition-all duration-300 p-6 rounded-2xl border ${
      isConnected 
      ? 'bg-[#0a0d14] border-cyber-electric/20 shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:border-cyber-electric/40' 
      : 'bg-[#0A0D14]/60 border-slate-800 hover:border-slate-700'
    }`}>
      {/* Glow Effect */}
      {isConnected && (
        <div className="absolute -top-1 -right-1 w-20 h-20 bg-cyber-electric/5 blur-2xl rounded-full group-hover:bg-cyber-electric/10 transition-colors"></div>
      )}

      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-xl bg-[#0A0D14] border flex items-center justify-center shadow-lg ${
          isConnected ? 'border-cyber-electric/50 text-cyber-electric' : 'border-slate-800 text-slate-500'
        }`}>
          <integration.icon className="w-6 h-6" />
        </div>
        
        <div className="flex flex-col items-end">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md mb-2 ${
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
        <h3 className="text-white font-bold text-lg mb-1 group-hover:text-cyber-electric transition-colors">{integration.name}</h3>
        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{integration.description}</p>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        {isConnected ? (
          <>
            <button 
              onClick={onToggle}
              className="px-4 py-2 rounded-lg bg-cyber-electric text-cyber-black font-black text-[10px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(3,154,220,0.3)]"
            >
              Gestionar
            </button>
            <button className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all ml-auto">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        ) : isConfiguring ? (
          <button className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-yellow-500 font-black text-[10px] uppercase tracking-widest hover:bg-yellow-500/10 transition-all">
            <Settings className="w-3.5 h-3.5 animate-spin-slow" />
            Completar Setup
          </button>
        ) : (
          <button 
            onClick={onToggle}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-800 bg-[#0A0D14] text-slate-300 font-black text-[10px] uppercase tracking-widest hover:border-cyber-electric/50 hover:text-white transition-all group/btn"
          >
            <Power className="w-3.5 h-3.5 group-hover/btn:text-cyber-electric transition-colors" />
            Conectar Protocolo
          </button>
        )}
      </div>
    </div>
  );
};

function LogItem({ title, status, time, desc, isError = false }: any) {
  return (
    <div className={`p-3 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-2 group transition-all ${
      isError ? 'bg-rose-500/5 border-rose-500/20' : 'bg-white/5 border-slate-800/50 hover:border-slate-700'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${
          status === 'SUCCESS' ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]' :
          status === 'WAITING' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]' :
          'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
        }`}></div>
        <div className="flex flex-col md:flex-row md:items-center md:gap-4">
          <span className="text-[10px] font-black uppercase text-white tracking-widest min-w-[100px]">{title}</span>
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
