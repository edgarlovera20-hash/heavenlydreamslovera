import React, { useState } from 'react';
import { Bot, ChevronRight, FileSignature, Users, Zap } from 'lucide-react';
import NewSaleForm from './NewSaleForm';
import MyClientsView from './MyClientsView';
import DirectValidationView from './DirectValidationView';
import { CyberIcon, CyberColor } from '../ui/CyberIcon';

export default function CaptureValidation() {
  const [activeView, setActiveView] = useState<'menu' | 'new_sale' | 'my_clients' | 'direct_validation'>('menu');

  const options: { id: number, actionId: string, title: string, description: string, icon: any, color: CyberColor, disabled?: boolean }[] = [
    { 
      id: 1, 
      actionId: 'new_sale',
      title: 'Registrar nueva venta', 
      description: 'Acceso al formulario de captura para un nuevo cliente.', 
      icon: FileSignature,
      color: 'cyan'
    },
    { 
      id: 2, 
      actionId: 'my_clients',
      title: 'Mis clientes (CRM)', 
      description: 'Gestiona tus clientes, revisa el estatus de validación, agrega notas y exporta/importa registros (.CSV).', 
      icon: Users,
      color: 'green',
      disabled: false
    },
    { 
      id: 3, 
      actionId: 'direct_validation',
      title: 'Pedir validación directa', 
      description: 'Solicita la validación inmediata para uno de los clientes en estado pendiente.', 
      icon: Zap,
      color: 'purple',
      disabled: false
    }
  ];

  if (activeView === 'new_sale') {
    return <NewSaleForm onBack={() => setActiveView('menu')} />;
  }

  if (activeView === 'my_clients') {
    return <MyClientsView onBack={() => setActiveView('menu')} />;
  }

  if (activeView === 'direct_validation') {
    return <DirectValidationView onBack={() => setActiveView('menu')} />;
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* AI Greeting Banner */}
      <div className="glass-panel-neon border-cyber-electric/40 rounded-2xl p-6 md:p-8 flex gap-6 items-start shadow-[0_0_30px_rgba(0,229,255,0.15)] relative overflow-hidden group">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-cyber-neon/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="absolute top-0 left-0 w-1 h-full bg-cyber-neon" />
        
        <div className="w-14 h-14 rounded-xl bg-cyber-neon/10 flex items-center justify-center border border-cyber-neon/30 shrink-0 relative z-10 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
          <Bot className="w-7 h-7 text-cyber-neon drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]" />
        </div>
        
        <div className="space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-cyber-black/50 border border-cyber-neon/20 text-cyber-neon text-[10px] font-bold tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-cyber-neon shadow-[0_0_8px_rgba(0,229,255,1)] animate-pulse" />
            Neural AI Assistant Online
          </div>
          
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight uppercase">
            System Control Panel
          </h2>
          
          <p className="text-cyber-electric/80 font-mono text-sm leading-relaxed max-w-3xl">
            Awaiting input. I am your autonomous management AI. My objective is to optimize workflows, organize nodes, and execute validation scripts instantaneously.
          </p>
          
          <p className="text-cyber-electric/50 text-[10px] font-bold uppercase tracking-widest pt-2">
            SELECT PROTOCOL SEQUENCE:
          </p>
        </div>
      </div>

      {/* Channel Connections Banner */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-cyber-electric/20 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,rgba(3,154,220,0.05)_25%,transparent_25%,transparent_50%,rgba(3,154,220,0.05)_50%,rgba(3,154,220,0.05)_75%,transparent_75%,transparent)] bg-[size:20px_20px] pointer-events-none" />
        
        <div className="relative z-10">
          <h3 className="text-lg font-bold text-white mb-1 uppercase tracking-wide">Sync Relays <span className="text-cyber-neon text-xs">(QR Tracker)</span></h3>
          <p className="text-xs font-mono text-cyber-electric/70">Connect external endpoints for automated data pipelining.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto relative z-10">
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-cyber-matrix/10 hover:bg-cyber-matrix/20 text-cyber-matrix border border-cyber-matrix/30 rounded-lg transition-all text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(0,255,136,0.1)] hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]">
            <span>Link WhatsApp</span>
          </button>
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-cyber-black/50 hover:bg-cyber-neon/10 text-cyber-electric/80 hover:text-cyber-neon border border-cyber-electric/20 hover:border-cyber-neon/30 rounded-lg transition-all text-xs font-bold uppercase tracking-widest">
            <span>Link Telegram</span>
          </button>
        </div>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {options.map((opt) => (
          <button 
            key={opt.id}
            onClick={() => {
              if (opt.disabled) return;
              if (opt.actionId === 'new_sale') {
                setActiveView('new_sale');
              } else if (opt.actionId === 'my_clients') {
                setActiveView('my_clients');
              } else if (opt.actionId === 'direct_validation') {
                setActiveView('direct_validation');
              }
            }}
            disabled={opt.disabled}
            className={`flex flex-col text-left glass-panel border border-cyber-electric/20 rounded-2xl p-6 transition-all duration-500 overflow-hidden relative group ${opt.disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:-translate-y-2 hover:border-cyber-neon/50 hover:shadow-[0_15px_30px_rgba(0,229,255,0.2)]'}`}
          >
            {/* Cyber hover effect */}
            {!opt.disabled && (
               <div className="absolute inset-0 bg-gradient-to-br from-cyber-neon/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            )}
            
            <div className="flex justify-between items-start mb-6 relative z-10 w-full">
              <CyberIcon icon={opt.icon} color={opt.color} size="lg" glowOpacity={0.4} />
              <span className="text-cyber-electric/40 font-mono text-xl font-bold italic">0{opt.id}</span>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-3 uppercase tracking-wide group-hover:text-cyber-neon transition-colors relative z-10">
              {opt.title}
            </h3>
            
            <p className="text-xs font-mono text-cyber-electric/70 line-clamp-3 mb-8 flex-1 leading-relaxed relative z-10">
              {opt.description}
            </p>
            
            <div className={`mt-auto flex items-center text-[10px] font-bold uppercase tracking-widest transition-all translate-y-4 group-hover:translate-y-0 duration-500 relative z-10 ${opt.disabled ? 'text-cyber-electric/50 opacity-100' : 'text-cyber-neon opacity-0 group-hover:opacity-100'}`}>
              {opt.disabled ? 'Module Locked' : (
                <>Initialize Module <ChevronRight className="w-4 h-4 ml-1 text-cyber-neon drop-shadow-[0_0_5px_rgba(0,229,255,0.8)]" /></>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
