import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  BarChart3, Users, Activity, Bell,
  LogOut, TrendingUp, ArrowUpRight, ArrowDownRight,
  LayoutDashboard, Settings as SettingsIcon, ChevronRight,
  User, ClipboardCheck, FileSearch, Wallet, Headphones, AlertTriangle, Megaphone, Gamepad2, FolderOpen,
  Database, Sun, Moon, Crown, Zap, Bot, Home, MessageSquare, MessageCircle,
  MapPin, CheckCircle2, Shield, Package, FileSpreadsheet, PhoneCall, ReceiptText
} from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useFollowUpReminders } from '../../hooks/useFollowUpReminders';
import { OfflineBanner } from '../ui/OfflineBanner';
import Logo from '../ui/Logo';
import { CyberIcon } from '../ui/CyberIcon';
import DataGridHero from '../ui/data-grid-hero';
import { PremiumBadge, PremiumCard, PremiumKpiCard, SectionHeader } from '../ui/premium';

const Settings = lazy(() => import('./Settings'));
const Payroll = lazy(() => import('./Payroll'));
const Announcements = lazy(() => import('./Announcements'));
const CaptureValidation = lazy(() => import('./CaptureValidation'));
const Profile = lazy(() => import('./Profile'));
const ConsultasSeguimiento = lazy(() => import('./ConsultasSeguimiento'));
const Game = lazy(() => import('./Game'));
const CustomerSupport = lazy(() => import('./CustomerSupport'));
const ClientChatCrmView = lazy(() => import('./ClientChatCrmView'));
const Morosidad = lazy(() => import('./Morosidad'));
const MyFilesView = lazy(() => import('./MyFilesView'));
const Integrations = lazy(() => import('./Integrations'));
const AgentDesigner = lazy(() => import('./AgentDesigner').then(m => ({ default: m.AgentDesigner })));
const ZoneHistoryView = lazy(() => import('./ZoneHistoryView'));
const AnalyticsView = lazy(() => import('./AnalyticsView'));
const TeamManagementView = lazy(() => import('./TeamManagementView'));
const ApprovalFlowView = lazy(() => import('./ApprovalFlowView'));
const TerritoriesView = lazy(() => import('./TerritoriesView'));
const PackageCatalogEditor = lazy(() => import('./PackageCatalogEditor'));
const AuditLogView = lazy(() => import('./AuditLogView'));
const DataManagerView = lazy(() => import('./DataManagerView'));
const SIACView = lazy(() => import('./SIACView'));
const ValidationConfigView = lazy(() => import('./ValidationConfigView'));
const ValidationRequestsView = lazy(() => import('./ValidationRequestsView'));
const AgentHubView = lazy(() => import('./AgentHubView'));
const UserManagementView = lazy(() => import('./UserManagementView'));
const EnterpriseOpsView = lazy(() => import('./EnterpriseOpsView'));
const ChatsView = lazy(() => import('./ChatsView'));
const CustomerFollowUpView = lazy(() => import('./CustomerFollowUpView'));
const FinancesEnterpriseView = lazy(() => import('./FinancesEnterpriseView'));
const CommissionsView = lazy(() => import('./CommissionsView'));
const OPS_ROLES = ['GERENTE', 'ADMINISTRACION', 'SUPERVISOR'];
const ADMIN_ROLES = ['GERENTE', 'ADMINISTRACION'];

const SectionLoader = () => (
  <div className="flex flex-col items-center justify-center h-48 gap-4" role="status" aria-live="polite">
    <div className="flex space-x-1.5">
      <div className="w-2.5 h-2.5 bg-[#0ea5e9] rounded-full animate-bounce [animation-delay:-0.3s] shadow-[0_0_10px_#0ea5e9]"></div>
      <div className="w-2.5 h-2.5 bg-[#0ea5e9] rounded-full animate-bounce [animation-delay:-0.15s] shadow-[0_0_10px_#0ea5e9]"></div>
      <div className="w-2.5 h-2.5 bg-[#0ea5e9] rounded-full animate-bounce shadow-[0_0_10px_#0ea5e9]"></div>
    </div>
    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Cargando módulo…</p>
  </div>
);

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-slate-500">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ClockText() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('es-ES', { hour12: false }));
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-ES', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return <>{time}</>;
}

import { Role } from '../../App';

interface ManagerViewProps {
  role: Role;
  onBack: () => void;
  currentUser?: { uid: string; email: string; displayName?: string; role?: string } | null;
  isLightMode?: boolean;
  onToggleTheme?: () => void;
}

function normalizeWhatsAppStatus(data: any) {
  return data?.status ? data : data?.promotores || data?.clientes || {};
}

export default function ManagerView({ role, onBack, currentUser, isLightMode, onToggleTheme }: ManagerViewProps) {
  const [activeSection, setActiveSection] = useState(OPS_ROLES.includes(role) ? 'Dashboard' : 'Perfil');
  const [showAgentDesigner, setShowAgentDesigner] = useState(false);
  const { isOnline, pendingCount, syncing, syncNow } = useOfflineSync();
  useFollowUpReminders();

  // Real CRM stats
  const [userCount, setUserCount] = useState(0);
  const [saleCount, setSaleCount] = useState(0);
  const [pendingSales, setPendingSales] = useState(0);
  const [approvedSales, setApprovedSales] = useState(0);
  const [rejectedSales, setRejectedSales] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [waStatus, setWaStatus] = useState<'disconnected'|'qr'|'authenticating'|'connected'>('disconnected');
  const [tgStatus, setTgStatus] = useState<'disconnected'|'polling'|'error'>('disconnected');
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [channelSummary, setChannelSummary] = useState({ conversations: 0, pendingApprovals: 0 });
  const [pendingUsers, setPendingUsers] = useState(0);

  const loadStats = async () => {
    if (!OPS_ROLES.includes(role)) return;
    try {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) return;
      const data = await res.json();
      setUserCount(data.userCount || 0);
      setPendingUsers(data.pendingUsers || 0);
      setSaleCount(data.saleCount || 0);
      setPendingSales(data.pendingSales || 0);
      setApprovedSales(data.approvedSales || 0);
      setRejectedSales(data.rejectedSales || 0);
      setTodaySales(data.todaySales || 0);
    } catch { /* silencioso - puede estar offline */ }
  };

  useEffect(() => {
    loadStats();
    const loadChannels = async () => {
      if (!OPS_ROLES.includes(role)) return;
      try {
        const [ws, tgs, msgs, conversations, outbox] = await Promise.all([
          fetch('/api/whatsapp/status?account=promotores', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
          fetch('/api/telegram/status', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
          fetch('/api/channels/messages', { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch('/api/channels/conversations', { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch('/api/agents/outbox', { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
        ]);
        if (ws) setWaStatus(normalizeWhatsAppStatus(ws).status || 'disconnected');
        if (tgs) setTgStatus(tgs.status);
        setRecentMessages((msgs as any[]).slice(0, 5));
        setChannelSummary({
          conversations: (conversations as any[]).filter(c => c.channel === 'whatsapp').length,
          pendingApprovals: (outbox as any[]).filter(item => item.status === 'pending_approval').length,
        });
      } catch {}
    };
    loadChannels();
    const statsTimer = OPS_ROLES.includes(role) ? setInterval(loadStats, 30000) : undefined;
    const channelTimer = OPS_ROLES.includes(role) ? setInterval(loadChannels, 30000) : undefined;
    return () => { clearInterval(statsTimer); clearInterval(channelTimer); };
  }, [role]);

  const userName = currentUser?.displayName || 'Usuario';
  const userRoleLabel = (currentUser?.role || role) === 'GERENTE'
    ? 'SUPERUSER'
    : (currentUser?.role || role) === 'ADMINISTRACION'
      ? 'ADMINISTRACION'
    : (currentUser?.role || role);
  const notificationCount = pendingSales + pendingUsers;

  return (
    <div className="hd-screen flex h-[100dvh] w-full text-white relative z-10 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 bg-[var(--hd-surface-strong)]/90 backdrop-blur-xl border-r border-[var(--hd-border)] hidden md:flex flex-col relative z-20">
        
        <div className="h-36 flex flex-col items-center justify-center px-6 relative overflow-hidden border-b border-white/5 gap-3 z-10">
          <Logo className="w-20 h-20 drop-shadow-[0_0_22px_rgba(34,255,136,0.32)] hover:scale-110 transition-transform duration-500" />
          <div className="text-center">
            <h1 className="text-sm font-semibold text-white tracking-[0.08em] leading-none">Heavenly Dreams</h1>
            <p className="text-[10px] text-cyan-300/70 tracking-[0.08em] font-semibold mt-1 leading-tight">
              TU DREAM TEAM COMIENZA AQUI
            </p>
          </div>
        </div>

        <div className="p-3 border-b border-white/5 space-y-2 relative z-10">
          <div className="flex items-center justify-between hd-card hd-tone-amber p-3">
             <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-300/25 flex items-center justify-center text-xs font-bold text-amber-300">
                   <Crown className="w-4 h-4" />
                </div>
                <div>
                   <p className="text-xs font-bold text-white truncate max-w-[120px]" title={userName}>{userName}</p>
                   <p className="text-[11px] text-amber-300/80 tracking-[0.08em] font-semibold">{userRoleLabel}</p>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <button
                  onClick={onToggleTheme}
                  aria-label={isLightMode ? 'Activar modo oscuro' : 'Activar modo claro'}
                  className="hd-no-liquid text-slate-400 hover:text-white transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded p-1"
                  title="Cambiar tema"
                >
                  {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
                <div className="relative">
                  <button
                    className="hd-no-liquid text-slate-400 hover:text-white transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded p-1"
                    aria-label={`${notificationCount} ventas pendientes por validar`}
                    title={`${notificationCount} ventas pendientes`}
                  >
                    <Bell className="w-4 h-4" />
                  </button>
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[12px] h-3 px-0.5 bg-[#0ea5e9] rounded-full flex items-center justify-center text-[7px] font-bold text-white">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                </div>
             </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto custom-scrollbar relative z-10" aria-label="Navegación principal">
          {OPS_ROLES.includes(role) && (
            <div className="mb-3">
              <NavItem icon={LayoutDashboard} color="cyan" label="Dashboard" active={activeSection === 'Dashboard'} onClick={() => setActiveSection('Dashboard')} />
            </div>
          )}

          <NavGroup label="Operativo">
            <NavItem icon={ClipboardCheck} color="green" label="Captura y Validación" active={activeSection === 'Captura y Validación'} onClick={() => setActiveSection('Captura y Validación')} />
            <NavItem icon={FileSearch} color="cyan" label="Consulta y Seguimiento" active={activeSection === 'Consulta y Seguimiento'} onClick={() => setActiveSection('Consulta y Seguimiento')} />
            <NavItem icon={MessageSquare} color="green" label="Chats" active={activeSection === 'Chats'} onClick={() => setActiveSection('Chats')} />
            <NavItem icon={FolderOpen} color="purple" label="Documentación" active={activeSection === 'Documentación'} onClick={() => setActiveSection('Documentación')} />
          </NavGroup>

          <NavGroup label="Promotor de Campo">
            <NavItem icon={MapPin} color="cyan" label="Historial por Zona" active={activeSection === 'Historial por Zona'} onClick={() => setActiveSection('Historial por Zona')} />
            <NavItem icon={Users} color="blue" label="Seguimiento de Clientes" active={activeSection === 'Seguimiento de Clientes'} onClick={() => setActiveSection('Seguimiento de Clientes')} />
          </NavGroup>

          <NavGroup label="Administración">
            <NavItem icon={Wallet} color="yellow" label="Nóminas" active={activeSection === 'Nóminas'} onClick={() => setActiveSection('Nóminas')} />
            {OPS_ROLES.includes(role) && <NavItem icon={ReceiptText} color="green" label="Comisiones" active={activeSection === 'Comisiones'} onClick={() => setActiveSection('Comisiones')} />}
            {ADMIN_ROLES.includes(role) && <NavItem icon={SettingsIcon} color="slate" label="Ajustes" active={activeSection === 'Ajustes'} onClick={() => setActiveSection('Ajustes')} />}
          </NavGroup>

          {OPS_ROLES.includes(role) && (
            <NavGroup label="Administración Avanzada">
              <NavItem icon={BarChart3} color="cyan" label="Efectividad" active={activeSection === 'Analytics'} onClick={() => setActiveSection('Analytics')} />
              <NavItem icon={Users} color="blue" label="Equipo y Metas" active={activeSection === 'Equipo y Metas'} onClick={() => setActiveSection('Equipo y Metas')} />
              <NavItem icon={CheckCircle2} color="green" label="Aprobaciones" active={activeSection === 'Aprobaciones'} onClick={() => setActiveSection('Aprobaciones')} />
            </NavGroup>
          )}

          {OPS_ROLES.includes(role) && (
            <NavGroup label="Agentes IA">
              <NavItem icon={Bot} color="purple" label="Hub de Agentes" active={activeSection === 'Hub de Agentes'} onClick={() => setActiveSection('Hub de Agentes')} />
            </NavGroup>
          )}

          {ADMIN_ROLES.includes(role) && (
            <NavGroup label="Gerencia">
              {ADMIN_ROLES.includes(role) && <NavItem icon={ReceiptText} color="yellow" label="Finanzas Enterprise" active={activeSection === 'Finanzas Enterprise'} onClick={() => setActiveSection('Finanzas Enterprise')} />}
              <NavItem icon={Users} color="cyan" label="Gestión de Usuarios" active={activeSection === 'Gestión de Usuarios'} onClick={() => setActiveSection('Gestión de Usuarios')} badge={pendingUsers > 0 ? pendingUsers : undefined} />
              <NavItem icon={MapPin} color="cyan" label="Territorios" active={activeSection === 'Territorios'} onClick={() => setActiveSection('Territorios')} />
              <NavItem icon={Package} color="purple" label="Catálogo" active={activeSection === 'Catálogo'} onClick={() => setActiveSection('Catálogo')} />
              <NavItem icon={Shield} color="yellow" label="Auditoría" active={activeSection === 'Auditoría'} onClick={() => setActiveSection('Auditoría')} />
              <NavItem icon={Activity} color="green" label="Arquitectura Empresarial" active={activeSection === 'Arquitectura Empresarial'} onClick={() => setActiveSection('Arquitectura Empresarial')} />
              <NavItem icon={Database} color="blue" label="Datos y Backup" active={activeSection === 'Datos y Backup'} onClick={() => setActiveSection('Datos y Backup')} />
              <NavItem icon={FileSpreadsheet} color="cyan" label="Base SIAC" active={activeSection === 'Base SIAC'} onClick={() => setActiveSection('Base SIAC')} />
              <NavItem icon={PhoneCall} color="green" label="Validaciones" active={activeSection === 'Validaciones'} onClick={() => setActiveSection('Validaciones')} />
              <NavItem icon={PhoneCall} color="purple" label="Config. Llamadas" active={activeSection === 'Config. Llamadas'} onClick={() => setActiveSection('Config. Llamadas')} />
            </NavGroup>
          )}

          <NavGroup label="Comunicación">
            <NavItem icon={Headphones} color="purple" label="Soporte a Clientes" active={activeSection === 'Soporte a Clientes'} onClick={() => setActiveSection('Soporte a Clientes')} />
            <NavItem icon={MessageCircle} color="green" label="Chat para Clientes" active={activeSection === 'Chat para Clientes'} onClick={() => setActiveSection('Chat para Clientes')} />
            <NavItem icon={AlertTriangle} color="red" label="Morosidad" active={activeSection === 'Morosidad'} onClick={() => setActiveSection('Morosidad')} />
            <NavItem icon={Megaphone} color="cyan" label="Anuncios" active={activeSection === 'Anuncios'} onClick={() => setActiveSection('Anuncios')} />
          </NavGroup>

          <NavGroup label="Sistema">
            <NavItem icon={User} color="blue" label="Perfil" active={activeSection === 'Perfil'} onClick={() => setActiveSection('Perfil')} />
            {OPS_ROLES.includes(role) && <NavItem icon={Zap} color="yellow" label="Integraciones" active={activeSection === 'Integraciones'} onClick={() => setActiveSection('Integraciones')} />}
            {OPS_ROLES.includes(role) && <NavItem icon={Bot} color="purple" label="Diseñador IA" active={showAgentDesigner} onClick={() => setShowAgentDesigner(true)} />}
            <NavItem icon={Gamepad2} color="green" label="Juego" active={activeSection === 'Juego'} onClick={() => setActiveSection('Juego')} />
          </NavGroup>
        </nav>

        <div className="p-4 border-t border-white/5 relative z-10">
          <button 
            onClick={onBack}
            className="hd-no-liquid w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/60 transition-all group text-rose-500"
          >
            <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="text-xs font-black uppercase tracking-[0.2em] group-hover:drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">Cerrar Sesión</span>
          </button>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <DataGridHero
          rows={26}
          cols={38}
          spacing={5}
          duration={5.4}
          color="hsl(var(--blue))"
          animationType="wave"
          pulseEffect
          mouseGlow
          opacityMin={0.035}
          opacityMax={0.34}
          background="radial-gradient(circle at 22% 12%, rgba(0,194,255,0.28), transparent 30rem), radial-gradient(circle at 78% 24%, rgba(10,132,255,0.22), transparent 34rem), radial-gradient(circle at 52% 82%, rgba(88,80,255,0.14), transparent 32rem), linear-gradient(145deg, #020A16 0%, #031326 34%, #071D3B 68%, #020A16 100%)"
          className="hd-module-stage flex min-h-0 flex-1 flex-col"
          contentClassName="flex min-h-0 flex-1 flex-col"
        >
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative z-10 w-full overflow-hidden">
          {/* Subtle Top Nav */}
          <div className="pt-5 px-8 flex items-center gap-2 mb-2 w-full">
             <button
               onClick={() => activeSection !== 'Dashboard' ? setActiveSection('Dashboard') : null}
               className="hd-no-liquid text-slate-500 hover:text-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded p-1"
               aria-label="Ir al dashboard"
             >
               <Home className="w-4 h-4" />
             </button>
             {activeSection !== 'Dashboard' && (
                <>
                  <span className="text-slate-600 text-xs text-bold">/</span>
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">{activeSection}</span>
                </>
             )}
          </div>
          <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
          {activeSection === 'Dashboard' && (
            <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <SectionHeader
                 eyebrow={`Panel de control · ${new Date().toLocaleDateString('es-MX')}`}
                 title={<><span>{userName}</span> <span className="text-cyan-300">CRM</span></>}
                 description={<>Vista ejecutiva de capturas, validaciones, canales y tareas operativas. Hora del sistema: <ClockText />.</>}
                 action={<PremiumBadge tone="emerald" dot>Sistema activo</PremiumBadge>}
               />

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 hover-group">
                <PremiumKpiCard
                  title="VENTAS HOY"
                  value={todaySales.toString()}
                  detail="Capturas del dia"
                  icon={TrendingUp}
                  tone="cyan"
                />
                <PremiumKpiCard
                  title="VENTAS TOTALES"
                  value={saleCount.toString()}
                  detail={`${approvedSales} aprobadas`}
                  icon={Activity}
                  tone="purple"
                />
                <PremiumKpiCard
                  title="PENDIENTES"
                  value={pendingSales.toString()}
                  detail="Por validar"
                  icon={ClipboardCheck}
                  tone="emerald"
                />
              </div>

              {/* Secondary Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PremiumCard className="p-5" tone="blue">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    <h4 className="text-slate-400 text-xs font-semibold">Personal registrado</h4>
                  </div>
                  <p className="text-3xl font-semibold text-white">{userCount}</p>
                  <p className="text-xs text-slate-500 mt-2">Asesores + supervisores</p>
                </PremiumCard>
                <PremiumCard className="p-5" tone="emerald">
                  <div className="flex items-center gap-3 mb-2">
                    <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-slate-400 text-xs font-semibold">Tasa de aprobación</h4>
                  </div>
                  <p className="text-3xl font-semibold text-white">
                    {saleCount > 0 ? `${Math.round((approvedSales / saleCount) * 100)}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">{approvedSales}/{saleCount} ventas</p>
                </PremiumCard>
                <PremiumCard className="p-5" tone="rose">
                  <div className="flex items-center gap-3 mb-2">
                    <ArrowDownRight className="w-5 h-5 text-rose-400" />
                    <h4 className="text-slate-400 text-xs font-semibold">Rechazos</h4>
                  </div>
                  <p className="text-3xl font-semibold text-white">{rejectedSales}</p>
                  <p className="text-xs text-slate-500 mt-2">No procedieron</p>
                </PremiumCard>
              </div>

              {/* Quick Actions */}
              <PremiumCard className="p-6" tone="cyan">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-300"></div>
                  <h3 className="text-sm font-semibold text-slate-300">Accesos rápidos</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <QuickAction icon={ClipboardCheck} label="Nueva Captura" color="green" onClick={() => setActiveSection('Captura y Validación')} />
                  <QuickAction icon={FileSearch} label="Consultas" color="cyan" onClick={() => setActiveSection('Consulta y Seguimiento')} />
                  <QuickAction icon={MessageSquare} label="Chats" color="green" onClick={() => setActiveSection('Chats')} />
                  <QuickAction icon={MapPin} label="Por Zona" color="cyan" onClick={() => setActiveSection('Historial por Zona')} />
                  <QuickAction icon={Users} label="Seguimiento" color="blue" onClick={() => setActiveSection('Seguimiento de Clientes')} />
                  <QuickAction icon={AlertTriangle} label="Morosidad" color="red" onClick={() => setActiveSection('Morosidad')} />
                  <QuickAction icon={Headphones} label="Soporte" color="purple" onClick={() => setActiveSection('Soporte a Clientes')} />
                  {OPS_ROLES.includes(role) && <>
                    <QuickAction icon={ReceiptText} label="Comisiones" color="green" onClick={() => setActiveSection('Comisiones')} />
                    {ADMIN_ROLES.includes(role) && <QuickAction icon={ReceiptText} label="Finanzas" color="yellow" onClick={() => setActiveSection('Finanzas Enterprise')} />}
                    <QuickAction icon={BarChart3} label="Efectividad" color="cyan" onClick={() => setActiveSection('Analytics')} />
                    <QuickAction icon={CheckCircle2} label="Aprobaciones" color="green" onClick={() => setActiveSection('Aprobaciones')} />
                    <QuickAction icon={Users} label="Equipo" color="purple" onClick={() => setActiveSection('Equipo y Metas')} />
                  </>}
                </div>
              </PremiumCard>

              {/* ── SYNC RELAYS: Canal Status + Mensajes Recientes ── */}
              {OPS_ROLES.includes(role) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* WhatsApp panel */}
                  <PremiumCard className="p-5 space-y-4" tone="emerald">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${waStatus === 'connected' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : waStatus === 'qr' ? 'bg-yellow-400 animate-pulse' : 'bg-slate-600'}`} />
                        <h4 className="text-sm font-semibold text-slate-200">WhatsApp</h4>
                        <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full ${
                          waStatus === 'connected' ? 'bg-emerald-400/10 text-emerald-400' :
                          waStatus === 'qr' ? 'bg-yellow-400/10 text-yellow-400' :
                          'bg-slate-700 text-slate-500'
                        }`}>{waStatus}</span>
                      </div>
                      <button
                        onClick={() => setActiveSection('Integraciones')}
                        className="hd-no-liquid text-[9px] text-slate-500 hover:text-cyan-400 uppercase tracking-widest font-bold transition-colors flex items-center gap-1"
                      >
                        Gestionar <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    {recentMessages.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">Sin mensajes recientes</p>
                    ) : (
                      <div className="space-y-2">
                        {recentMessages.map((m: any) => (
                          <div key={m.id} className="flex gap-2 items-start">
                            <div className="w-6 h-6 rounded-full bg-emerald-400/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <MessageSquare className="w-3 h-3 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-white truncate">{m.fromName}</p>
                              <p className="text-[10px] text-slate-400 truncate">{m.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                        <p className="text-lg font-bold text-white">{channelSummary.conversations}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">Conversaciones</p>
                      </div>
                      <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-2">
                        <p className="text-lg font-bold text-yellow-200">{channelSummary.pendingApprovals}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest">Aprobaciones</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveSection('Hub de Agentes')}
                      className="w-full text-xs text-emerald-300 border border-emerald-400/20 rounded-lg py-2 hover:bg-emerald-400/5 transition-colors font-semibold"
                    >
                      Ver en Hub de Agentes
                    </button>
                  </PremiumCard>

                  {/* Telegram panel */}
                  <PremiumCard className="p-5 space-y-4" tone="blue">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${tgStatus === 'polling' ? 'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]' : tgStatus === 'error' ? 'bg-rose-400' : 'bg-slate-600'}`} />
                        <h4 className="text-sm font-semibold text-slate-200">Telegram</h4>
                        <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full ${
                          tgStatus === 'polling' ? 'bg-blue-400/10 text-blue-400' :
                          tgStatus === 'error'   ? 'bg-rose-400/10 text-rose-400' :
                                                   'bg-slate-700 text-slate-500'
                        }`}>{tgStatus}</span>
                      </div>
                      <button
                        onClick={() => setActiveSection('Hub de Agentes')}
                        className="hd-no-liquid text-[9px] text-slate-500 hover:text-cyan-400 uppercase tracking-widest font-bold transition-colors flex items-center gap-1"
                      >
                        {tgStatus === 'polling' ? 'Ver mensajes' : 'Configurar'} <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    {tgStatus === 'polling' ? (
                      <p className="text-xs text-blue-300">✅ Bot activo — los agentes están escuchando</p>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500">Activa el bot en Hub de Agentes → pestaña Telegram</p>
                        <div className="bg-blue-400/5 border border-blue-400/20 rounded-xl p-3">
                          <p className="text-[10px] text-blue-300 font-mono">@BotFather → /newbot → Token → Hub Agentes</p>
                        </div>
                      </>
                    )}
                  </PremiumCard>
                </div>
              )}
            </div>
          )}

          <Suspense fallback={<SectionLoader />}>
            {activeSection === 'Ajustes' && <Settings />}
            {activeSection === 'Perfil' && <Profile />}
            {activeSection === 'Nóminas' && <Payroll />}
            {activeSection === 'Comisiones' && <CommissionsView />}
            {activeSection === 'Anuncios' && <Announcements />}
            {activeSection === 'Captura y Validación' && <CaptureValidation />}
            {activeSection === 'Consulta y Seguimiento' && <ConsultasSeguimiento />}
            {activeSection === 'Soporte a Clientes' && <CustomerSupport />}
            {activeSection === 'Chat para Clientes' && <ClientChatCrmView />}
            {activeSection === 'Morosidad' && <Morosidad />}
            {activeSection === 'Juego' && <Game />}
            {activeSection === 'Integraciones' && <Integrations />}
            {activeSection === 'Documentación' && <MyFilesView onBack={() => setActiveSection('Dashboard')} />}
            {activeSection === 'Historial por Zona' && <ZoneHistoryView />}
            {activeSection === 'Analytics' && <AnalyticsView />}
            {activeSection === 'Equipo y Metas' && <TeamManagementView />}
            {activeSection === 'Aprobaciones' && <ApprovalFlowView />}
            {activeSection === 'Territorios' && <TerritoriesView />}
            {activeSection === 'Catálogo' && <PackageCatalogEditor />}
            {activeSection === 'Auditoría' && <AuditLogView />}
            {activeSection === 'Arquitectura Empresarial' && <EnterpriseOpsView />}
            {activeSection === 'Datos y Backup' && <DataManagerView />}
            {activeSection === 'Base SIAC' && <SIACView />}
            {activeSection === 'Validaciones' && <ValidationRequestsView />}
            {activeSection === 'Config. Llamadas' && <ValidationConfigView />}
            {activeSection === 'Hub de Agentes' && <AgentHubView />}
            {activeSection === 'Gestión de Usuarios' && <UserManagementView />}
            {activeSection === 'Finanzas Enterprise' && ADMIN_ROLES.includes(role) && <FinancesEnterpriseView />}
            {activeSection === 'Chats' && (
              <ChatsView
                onOpenSettings={() => setActiveSection('Ajustes')}
                onOpenAgents={() => setActiveSection('Hub de Agentes')}
                onStartCapture={() => setActiveSection('Captura y Validación')}
                onOpenFolios={() => setActiveSection('Consulta y Seguimiento')}
              />
            )}
            {activeSection === 'Seguimiento de Clientes' && <CustomerFollowUpView />}
          </Suspense>

          {/* Placeholder for other sections */}
          {!['Dashboard', 'Ajustes', 'Perfil', 'Nóminas', 'Comisiones', 'Anuncios', 'Captura y Validación', 'Consulta y Seguimiento', 'Chats', 'Seguimiento de Clientes', 'Soporte a Clientes', 'Chat para Clientes', 'Morosidad', 'Juego', 'Documentación', 'Integraciones', 'Historial por Zona', 'Analytics', 'Equipo y Metas', 'Aprobaciones', 'Territorios', 'Catálogo', 'Auditoría', 'Arquitectura Empresarial', 'Datos y Backup', 'Base SIAC', 'Validaciones', 'Config. Llamadas', 'Hub de Agentes', 'Gestión de Usuarios', 'Finanzas Enterprise'].includes(activeSection) && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-cyber-electric/50">
                <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">{activeSection}</h2>
                <p className="font-mono text-sm uppercase tracking-widest">Protocolo no inicializado.</p>
              </div>
            </div>
          )}
        </div>
        </div>
        </DataGridHero>
      </main>

      {/* Agent Designer Modal */}
      {showAgentDesigner && (
        <Suspense fallback={null}>
          <AgentDesigner onClose={() => setShowAgentDesigner(false)} />
        </Suspense>
      )}

      <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} syncing={syncing} onSync={syncNow} />
    </div>
  );
}

function QuickAction({ icon: Icon, label, color, onClick }: { icon: any; label: string; color: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    cyan: 'hd-tone-cyan text-cyan-200',
    green: 'hd-tone-emerald text-emerald-200',
    red: 'hd-tone-pink text-rose-200',
    purple: 'hd-tone-violet text-violet-200',
    yellow: 'hd-tone-amber text-yellow-100',
    blue: 'hd-tone-blue text-blue-100',
  };
  return (
    <button
      onClick={onClick}
      className={`hd-liquid-button hd-card hd-card-interactive flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${colors[color] || colors.cyan}`}
    >
      <Icon className="w-8 h-8" />
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

// Subcomponents
function NavItem({ icon: Icon, label, color, active = false, onClick, badge }: { icon: any, label: string, color: string, active?: boolean, onClick?: () => void, badge?: number }) {
  const getColorClasses = () => {
    if (color === 'cyan') return active ? 'text-cyan-200 bg-cyan-400/10 border-cyan-300/25' : 'text-slate-400 hover:text-cyan-200 hover:bg-cyan-300/5';
    if (color === 'blue') return active ? 'text-blue-400 bg-blue-400/10 border-blue-400/30' : 'text-slate-400 hover:text-blue-400 hover:bg-blue-400/5';
    if (color === 'purple') return active ? 'text-purple-400 bg-purple-400/10 border-purple-400/30' : 'text-slate-400 hover:text-purple-400 hover:bg-purple-400/5';
    if (color === 'green') return active ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/5';
    if (color === 'yellow') return active ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' : 'text-slate-400 hover:text-yellow-400 hover:bg-yellow-400/5';
    if (color === 'red') return active ? 'text-rose-400 bg-rose-400/10 border-rose-400/30' : 'text-slate-400 hover:text-rose-400 hover:bg-rose-400/5';
    return active ? 'text-slate-200 bg-slate-800' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50';
  };

  const colorClasses = getColorClasses();

  return (
    <button 
      onClick={onClick} 
      className={`hd-liquid-button w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all relative overflow-hidden group border border-transparent ${active ? 'hd-liquid-selected' : ''} ${colorClasses}`}
    >
      <Icon className={`w-4 h-4 transition-transform group-hover:scale-110`} />
      <span className="text-[13px] font-semibold flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 bg-yellow-400 rounded-full flex items-center justify-center text-[8px] font-bold text-black">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {active && (
        <div className={`absolute right-3 w-1 h-4 rounded-full ${
          color === 'cyan' ? 'bg-[#0ea5e9]' :
          color === 'blue' ? 'bg-blue-400' :
          color === 'purple' ? 'bg-purple-400' :
          color === 'green' ? 'bg-emerald-400' :
          color === 'yellow' ? 'bg-yellow-400' :
          color === 'red' ? 'bg-rose-400' : 'bg-white'
        }`}></div>
      )}
    </button>
  );
}
