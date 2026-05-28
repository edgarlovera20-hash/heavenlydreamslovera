import React, { useState, lazy, Suspense } from 'react';
import {
  User, Wallet, Headphones,
  Bell, LogOut,
  ChevronLeft, Menu, Users, Gamepad2, ClipboardCheck, FileSearch, Megaphone, X, AlertTriangle, SettingsIcon, FolderOpen, Zap, MessageSquare
} from 'lucide-react';
import Logo from '../ui/Logo';
import { CyberIcon } from '../ui/CyberIcon';
import { Role } from '../../App';
import NeuralLayout from '../../layouts/neural-layout';

const Profile = lazy(() => import('./Profile'));
const Game = lazy(() => import('./Game'));
const NewSaleForm = lazy(() => import('./NewSaleForm'));
const ConsultasSeguimiento = lazy(() => import('./ConsultasSeguimiento'));
const Payroll = lazy(() => import('./Payroll'));
const Announcements = lazy(() => import('./Announcements'));
const CustomerSupport = lazy(() => import('./CustomerSupport'));
const ClientChatCrmView = lazy(() => import('./ClientChatCrmView'));
const Morosidad = lazy(() => import('./Morosidad'));
const Settings = lazy(() => import('./Settings'));
const MyFilesView = lazy(() => import('./MyFilesView'));
const Integrations = lazy(() => import('./Integrations'));
const ChatsView = lazy(() => import('./ChatsView'));
const CustomerFollowUpView = lazy(() => import('./CustomerFollowUpView'));
const CommissionsView = lazy(() => import('./CommissionsView'));

const SectionLoader = () => (
  <div className="flex items-center justify-center h-48">
    <div className="flex space-x-1.5">
      <div className="w-2.5 h-2.5 bg-[#0ea5e9] rounded-full animate-bounce [animation-delay:-0.3s] shadow-[0_0_10px_#0ea5e9]"></div>
      <div className="w-2.5 h-2.5 bg-[#0ea5e9] rounded-full animate-bounce [animation-delay:-0.15s] shadow-[0_0_10px_#0ea5e9]"></div>
      <div className="w-2.5 h-2.5 bg-[#0ea5e9] rounded-full animate-bounce shadow-[0_0_10px_#0ea5e9]"></div>
    </div>
  </div>
);

interface MobileUserViewProps {
  role: Role;
  onBack: () => void;
  currentUser?: { uid: string; email: string; displayName?: string; role?: string } | null;
  isLightMode?: boolean;
  onToggleTheme?: () => void;
}

export default function MobileUserView({ role, onBack, currentUser: _currentUser, isLightMode: _isLightMode, onToggleTheme: _onToggleTheme }: MobileUserViewProps) {
  const [activeSection, setActiveSection] = useState('Perfil');
  const [showMenu, setShowMenu] = useState(false);

  // Define available sections based on role
  let availableSections: { id: string, label: string, icon: any, color: import('../ui/CyberIcon').CyberColor }[] = [
    { id: 'Perfil', label: 'Perfil', icon: User, color: 'blue' },
    { id: 'Documentación', label: 'Documentos', icon: FolderOpen, color: 'cyan' },
    { id: 'Captura y Validación', label: 'Captura', icon: ClipboardCheck, color: 'green' },
    { id: 'Consulta y Seguimiento', label: 'Consultas', icon: FileSearch, color: 'yellow' },
    { id: 'Chats', label: 'Chats', icon: MessageSquare, color: 'green' },
    { id: 'Chat para Clientes', label: 'Clientes Chat', icon: MessageSquare, color: 'cyan' },
    { id: 'Seguimiento de Clientes', label: 'Seguimiento', icon: Users, color: 'cyan' },
    { id: 'Nóminas', label: 'Nóminas', icon: Wallet, color: 'purple' },
    { id: 'Anuncios', label: 'Anuncios', icon: Megaphone, color: 'orange' },
    { id: 'Juego', label: 'Juego', icon: Gamepad2, color: 'pink' },
  ];

  if (role === 'GERENTE' || role === 'ADMINISTRACION') {
    availableSections = [
      { id: 'Perfil', label: 'Perfil', icon: User, color: 'blue' },
      { id: 'Documentación', label: 'Documentos', icon: FolderOpen, color: 'cyan' },
      { id: 'Captura y Validación', label: 'Captura', icon: ClipboardCheck, color: 'green' },
      { id: 'Consulta y Seguimiento', label: 'Consultas', icon: FileSearch, color: 'yellow' },
      { id: 'Chats', label: 'Chats', icon: MessageSquare, color: 'green' },
      { id: 'Chat para Clientes', label: 'Clientes Chat', icon: MessageSquare, color: 'cyan' },
      { id: 'Seguimiento de Clientes', label: 'Seguimiento', icon: Users, color: 'cyan' },
      { id: 'Nóminas', label: 'Nóminas', icon: Wallet, color: 'purple' },
      { id: 'Comisiones', label: 'Comisiones', icon: Wallet, color: 'green' },
      { id: 'Soporte a Clientes', label: 'Soporte', icon: Headphones, color: 'cyan' },
      { id: 'Morosidad', label: 'Morosidad', icon: AlertTriangle, color: 'red' },
      { id: 'Anuncios', label: 'Anuncios', icon: Megaphone, color: 'orange' },
      { id: 'Juego', label: 'Juego', icon: Gamepad2, color: 'pink' },
      { id: 'Integraciones', label: 'Integraciones', icon: Zap, color: 'yellow' },
      { id: 'Ajustes', label: 'Ajustes', icon: SettingsIcon, color: 'blue' },
    ];
  }

  // Bottom nav items (max 4 + Menu if needed)
  const bottomNavItems = availableSections.slice(0, 4);
  const hasMore = availableSections.length > 4;

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    setShowMenu(false);
  };

  return (
    <NeuralLayout
      mode="mobile"
      activity="active"
      interactive={false}
      showParticles={false}
      showShootingStars={false}
      className="hd-mobile-clean h-[100dvh] w-full"
      contentClassName="flex h-full w-full justify-center"
    >
    <div className="hd-mobile-shell-clean flex flex-col h-[100dvh] w-full max-w-[430px] mx-auto border-x border-cyber-electric/20 relative z-10 shadow-[0_0_50px_rgba(3,154,220,0.1)] overflow-hidden">
      
      {/* Mobile Header */}
      <header className="hd-mobile-header-clean px-4 sm:px-6 pt-4 sm:pt-8 pb-3 sm:pb-4 flex justify-between items-center shrink-0 relative z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => {
              if (activeSection !== 'Perfil') {
                setActiveSection('Perfil');
              } else {
                onBack(); // Logout
              }
            }} 
            className="hd-liquid-button flex items-center text-orange-100/80 hover:text-white transition-colors bg-orange-300/5 hover:bg-orange-300/10 rounded border border-orange-300/20 hover:border-orange-200/60 mr-1 px-1.5 sm:px-2 py-1 sm:py-1.5 uppercase tracking-widest text-[9px] sm:text-[10px] font-bold"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline-block ml-1">Regresar</span>
          </button>
          <div className="relative">
            <div className="absolute inset-0 bg-cyber-neon/20 blur-md rounded-full"></div>
            <Logo className="w-12 h-12 sm:w-16 sm:h-16 relative z-10 drop-shadow-[0_0_18px_rgba(34,255,136,0.38)]" />
          </div>
          <div>
            <h1 className="text-sm sm:text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyber-neon to-cyber-electric tracking-tight leading-tight">Heavenly Dreams</h1>
            <p className="text-[8px] sm:text-[10px] text-cyber-electric/70 font-bold uppercase tracking-[0.2em]">{role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="hd-liquid-button relative p-1.5 sm:p-2 text-orange-100/80 hover:text-white transition-colors bg-orange-300/5 hover:bg-orange-300/10 rounded border border-orange-300/20 hover:border-orange-200/60 group">
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 group-hover:drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]" />
            <span className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 w-1.5 sm:w-2 h-1.5 sm:h-2 bg-red-500 rounded-full border border-cyber-black shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>
          </button>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="hd-mobile-content-clean flex-1 overflow-y-auto px-4 pb-28 custom-scrollbar relative z-10">
        {/* Render Active Section */}
        <Suspense fallback={<SectionLoader />}>
          {activeSection === 'Perfil' && <Profile />}
          {activeSection === 'Documentación' && <MyFilesView onBack={() => setActiveSection('Perfil')} />}
          {activeSection === 'Juego' && <Game />}
          {activeSection === 'Captura y Validación' && (
            <div className="hd-mobile-sale-flow -mx-4">
              <NewSaleForm onBack={() => setActiveSection('Perfil')} />
            </div>
          )}
          {activeSection === 'Consulta y Seguimiento' && <ConsultasSeguimiento />}
          {activeSection === 'Chats' && <ChatsView />}
          {activeSection === 'Chat para Clientes' && <ClientChatCrmView />}
          {activeSection === 'Seguimiento de Clientes' && <CustomerFollowUpView />}
          {activeSection === 'Nóminas' && <Payroll />}
          {activeSection === 'Comisiones' && <CommissionsView />}
          {activeSection === 'Anuncios' && <Announcements />}
          {activeSection === 'Soporte a Clientes' && <CustomerSupport />}
          {activeSection === 'Morosidad' && <Morosidad />}
          {activeSection === 'Ajustes' && <Settings />}
          {activeSection === 'Integraciones' && <Integrations />}
        </Suspense>
        {!['Perfil', 'Documentación', 'Juego', 'Captura y Validación', 'Consulta y Seguimiento', 'Chats', 'Chat para Clientes', 'Seguimiento de Clientes', 'Nóminas', 'Comisiones', 'Anuncios', 'Soporte a Clientes', 'Morosidad', 'Ajustes', 'Integraciones'].includes(activeSection) && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-cyber-electric/50">
              <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">{activeSection}</h2>
              <p className="font-mono text-sm uppercase tracking-widest">Módulo Offline.</p>
            </div>
          </div>
        )}
      </div>

      {/* Full Screen Menu Overlay */}
      {showMenu && (
        <div className="absolute inset-0 z-40 bg-cyber-black/70 backdrop-blur-xl flex flex-col pt-24 px-6 pb-24 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-8 relative z-10">
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyber-neon to-cyber-electric uppercase tracking-wide">Menú Principal</h2>
            <button onClick={() => setShowMenu(false)} className="p-2 bg-cyber-electric/10 hover:bg-cyber-neon/20 border border-cyber-electric/30 hover:border-cyber-neon/50 rounded text-cyber-neon transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto hide-scrollbar pb-6 content-start">
            {availableSections.map(section => (
              <button
                key={section.id}
                onClick={() => handleNavClick(section.id)}
                className={`hd-liquid-button flex flex-col items-center justify-center gap-3 p-6 rounded-xl border transition-all ${activeSection === section.id ? 'hd-liquid-selected bg-orange-300/10 border-orange-200/60 text-orange-100 shadow-[0_0_24px_rgba(255,138,31,0.32)]' : 'bg-cyber-dark/50 border-cyber-electric/20 text-cyber-electric/70 hover:bg-orange-300/10 hover:border-orange-200/50 hover:text-white group'}`}
              >
                <div className="relative mb-1">
                  <CyberIcon icon={section.icon} color={section.color} size="md" glowOpacity={activeSection === section.id ? 0.6 : 0.3} />
                </div>
                <span className="text-[11px] font-bold text-center uppercase tracking-wider">{section.label}</span>
              </button>
            ))}
          </div>
          <button onClick={onBack} className="hd-liquid-button mt-4 flex items-center justify-center gap-2 w-full py-4 bg-red-900/20 hover:bg-red-900/40 text-red-500 rounded-xl font-bold border border-red-500/30 transition-colors uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(239,68,68,0.1)] shrink-0">
            <LogOut className="w-5 h-5" /> Desconectar
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full h-20 glass-panel-neon border-t border-cyber-electric/20 flex justify-around items-center px-2 pb-4 pt-2 shrink-0 z-30">
        <div className="absolute inset-0 bg-gradient-to-t from-cyber-black to-transparent pointer-events-none"></div>
        {bottomNavItems.map(item => (
          <NavItem 
            key={item.id} 
            icon={item.icon} 
            label={item.label} 
            active={activeSection === item.id && !showMenu} 
            onClick={() => handleNavClick(item.id)} 
          />
        ))}
        {hasMore && (
          <NavItem 
            icon={Menu} 
            label="Menú" 
            active={showMenu} 
            onClick={() => setShowMenu(true)} 
          />
        )}
      </nav>

    </div>
    </NeuralLayout>
  );
}

// Subcomponents
function NavItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`hd-liquid-button flex flex-col items-center justify-center gap-1 w-16 h-full transition-all relative z-10 rounded-xl ${active ? 'hd-liquid-selected text-orange-100' : 'text-cyber-electric/50 hover:text-cyber-electric/80'}`}>
      <div className="relative">
        {active && <div className="absolute inset-0 bg-cyber-neon/40 blur-md rounded-full"></div>}
        <Icon className={`w-6 h-6 relative z-10 transition-transform ${active ? 'scale-110 drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]' : ''}`} />
      </div>
      <span className={`text-[9px] uppercase tracking-widest truncate w-full text-center mt-1 ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}
