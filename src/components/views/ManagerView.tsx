import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  BarChart3, Users, Activity, Bell,
  LogOut, TrendingUp, ArrowUpRight, ArrowDownRight,
  LayoutDashboard, Settings as SettingsIcon, ChevronRight,
  User, ClipboardCheck, FileSearch, Wallet, Headphones, AlertTriangle, Megaphone, FolderOpen,
  Database, Sun, Moon, Crown, Zap, Bot, Home, MessageSquare,
  MapPin, CheckCircle2, Shield, Package, FileSpreadsheet, PhoneCall, ReceiptText, Target, DollarSign
} from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useFollowUpReminders } from '../../hooks/useFollowUpReminders';
import { OfflineBanner } from '../ui/OfflineBanner';
import Logo from '../ui/Logo';
import { CyberIcon } from '../ui/CyberIcon';
import { PremiumBadge, PremiumCard, PremiumKpiCard, SectionHeader } from '../ui/premium';
import DashboardLayout from '../../layouts/dashboard-layout';

const Settings = lazy(() => import('./Settings'));
const DashboardGradientCharts = lazy(() =>
  import('../dashboard/dashboard-gradient-charts').then((module) => ({ default: module.DashboardGradientCharts }))
);
const Payroll = lazy(() => import('./Payroll'));
const Announcements = lazy(() => import('./Announcements'));
const CaptureValidation = lazy(() => import('./CaptureValidation'));
const Profile = lazy(() => import('./Profile'));
const ConsultasSeguimiento = lazy(() => import('./ConsultasSeguimiento'));
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
const ProductionSimulationView = lazy(() => import('./ProductionSimulationView'));
const OPS_ROLES = ['GERENTE', 'ADMINISTRACION', 'SUPERVISOR'];
const ADMIN_ROLES = ['GERENTE'];
const MANAGER_ONLY_SECTIONS = new Set([
  'Ajustes',
  'Analytics',
  'Equipo y Metas',
  'Aprobaciones',
  'Hub de Agentes',
  'Finanzas Enterprise',
  'Gestión de Usuarios',
  'Territorios',
  'Catálogo',
  'Auditoría',
  'Arquitectura Empresarial',
  'Simulación Producción',
  'Datos y Backup',
  'Base SIAC',
  'Validaciones',
  'Config. Llamadas',
  'Integraciones',
]);
const MOTIVATIONAL_PHRASES = [
  'Hoy cada seguimiento puede convertirse en una venta cerrada.',
  'La constancia gana: una captura clara hoy evita retrabajo manana.',
  'Tu energia mueve al equipo; enfocate en el siguiente cliente.',
  'Las metas grandes se cumplen con acciones pequenas, bien hechas.',
  'Vende con orden, valida con calma y avanza con confianza.',
  'Cada folio atendido a tiempo mejora la experiencia del cliente.',
  'El mejor resultado empieza con una buena captura.',
];

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

function NavGroup({ label, children, compact = false }: { label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={compact ? 'mb-2' : 'mb-3'}>
      <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
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

function getLoginGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos dias';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getMotivationalPhrase() {
  const dayIndex = Math.floor(Date.now() / 86400000) % MOTIVATIONAL_PHRASES.length;
  return MOTIVATIONAL_PHRASES[dayIndex];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
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
  const [captureInitialView, setCaptureInitialView] = useState<'menu' | 'new_sale'>('menu');
  const { isOnline, pendingCount, syncing, syncNow } = useOfflineSync();
  useFollowUpReminders();

  // Real CRM stats
  const [userCount, setUserCount] = useState(0);
  const [saleCount, setSaleCount] = useState(0);
  const [pendingSales, setPendingSales] = useState(0);
  const [approvedSales, setApprovedSales] = useState(0);
  const [rejectedSales, setRejectedSales] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [waStatus, setWaStatus] = useState<'disconnected'|'qr'|'authenticating'|'connected'>('disconnected');
  const [tgStatus, setTgStatus] = useState<'disconnected'|'polling'|'error'>('disconnected');
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [channelSummary, setChannelSummary] = useState({ conversations: 0, pendingApprovals: 0 });
  const [pendingUsers, setPendingUsers] = useState(0);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const hasFullModuleAccess = ADMIN_ROLES.includes(role);

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
      setMonthRevenue(data.monthRevenue || 0);
    } catch { /* silencioso - puede estar offline */ }
  };

  useEffect(() => {
    loadStats();
    const loadChannels = async () => {
      if (!OPS_ROLES.includes(role)) return;
      try {
        const [ws, tgs, msgs, conversations, outbox, inventory] = await Promise.all([
          fetch('/api/whatsapp/status?account=promotores', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
          fetch('/api/telegram/status', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
          fetch('/api/channels/messages', { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch('/api/channels/conversations', { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch('/api/agents/outbox', { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
          fetch('/api/inventory', { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
        ]);
        if (ws) setWaStatus(normalizeWhatsAppStatus(ws).status || 'disconnected');
        if (tgs) setTgStatus(tgs.status);
        setRecentMessages((msgs as any[]).slice(0, 5));
        setChannelSummary({
          conversations: (conversations as any[]).filter(c => c.channel === 'whatsapp').length,
          pendingApprovals: (outbox as any[]).filter(item => item.status === 'pending_approval').length,
        });
        setInventoryItems(Array.isArray(inventory) ? inventory : []);
      } catch {}
    };
    loadChannels();
    const statsTimer = OPS_ROLES.includes(role) ? setInterval(loadStats, 30000) : undefined;
    const channelTimer = OPS_ROLES.includes(role) ? setInterval(loadChannels, 30000) : undefined;
    return () => { clearInterval(statsTimer); clearInterval(channelTimer); };
  }, [role]);

  useEffect(() => {
    if (typeof window === 'undefined' || !OPS_ROLES.includes(role)) return;
    const activityType = rejectedSales > 0
      ? 'error'
      : todaySales > 0
        ? 'sale'
        : pendingSales + pendingUsers + recentMessages.length > 0
          ? 'message'
          : 'active';
    const intensity = Math.min(1.8, 0.45 + (pendingSales + pendingUsers + recentMessages.length + todaySales) * 0.08);
    window.dispatchEvent(new CustomEvent('hd-neural-activity', { detail: { type: activityType, intensity } }));
  }, [pendingSales, pendingUsers, recentMessages.length, rejectedSales, role, todaySales]);

  useEffect(() => {
    if (MANAGER_ONLY_SECTIONS.has(activeSection) && !hasFullModuleAccess) {
      setActiveSection(OPS_ROLES.includes(role) ? 'Dashboard' : 'Perfil');
    }
    if (showAgentDesigner && !hasFullModuleAccess) {
      setShowAgentDesigner(false);
    }
  }, [activeSection, hasFullModuleAccess, role, showAgentDesigner]);

  const userName = currentUser?.displayName || 'Usuario';
  const userRoleLabel = (currentUser?.role || role) === 'GERENTE'
    ? 'SUPERUSER'
    : (currentUser?.role || role) === 'ADMINISTRACION'
      ? 'ADMINISTRACION'
    : (currentUser?.role || role);
  const notificationCount = pendingSales + pendingUsers;
  const greeting = getLoginGreeting();
  const motivationalPhrase = getMotivationalPhrase();
  const conversionRate = saleCount > 0 ? clampPercent((approvedSales / saleCount) * 100) : 0;
  const monthlyGoal = Math.max(30, Math.ceil(Math.max(approvedSales, saleCount, todaySales, 1) / 10) * 10);
  const goalProgress = clampPercent((approvedSales / monthlyGoal) * 100);
  const pipelineProspects = Math.max(channelSummary.conversations + saleCount + pendingSales + rejectedSales, saleCount, 1);
  const pipelineStages = [
    { label: 'Prospectos', value: pipelineProspects, color: 'from-cyan-300 to-sky-500', detail: 'Canales + capturas' },
    { label: 'Contactados', value: channelSummary.conversations, color: 'from-emerald-300 to-emerald-600', detail: 'Conversaciones' },
    { label: 'Citas', value: pendingSales + channelSummary.pendingApprovals, color: 'from-violet-300 to-violet-600', detail: 'Por validar / IA' },
    { label: 'Ventas', value: saleCount, color: 'from-amber-300 to-orange-500', detail: 'Capturas totales' },
    { label: 'Instalados', value: approvedSales, color: 'from-lime-300 to-emerald-500', detail: 'Aprobadas' },
  ];
  const directorSignals = [
    pendingSales > 0
      ? `${pendingSales} ventas requieren validacion para liberar avance comercial.`
      : 'Validaciones al dia; el flujo operativo esta despejado.',
    rejectedSales > 0
      ? `${rejectedSales} rechazos activos: conviene revisar causa y recuperar oportunidad.`
      : 'Sin rechazo critico visible en el tablero actual.',
    channelSummary.pendingApprovals > 0
      ? `${channelSummary.pendingApprovals} aprobaciones IA esperan decision gerencial.`
      : 'Automatizaciones sin aprobaciones pendientes.',
  ];
  const openCaptureMenu = () => {
    setCaptureInitialView('menu');
    setActiveSection('Captura y Validación');
  };
  const startSaleCapture = () => {
    setCaptureInitialView('new_sale');
    setActiveSection('Captura y Validación');
  };

  return (
    <div className="hd-screen hd-app-shell flex h-[100dvh] w-full min-w-0 text-white relative z-10 overflow-hidden">
      {/* Sidebar */}
      <aside className="hd-holographic-sidebar hd-app-sidebar w-64 shrink-0 bg-[var(--hd-surface-strong)]/90 backdrop-blur-xl border-r border-[var(--hd-border)] hidden md:flex flex-col min-h-0 relative z-20">
        
        <div className="h-32 flex flex-col items-center justify-center px-5 relative overflow-hidden border-b border-white/5 gap-2 z-10">
          <Logo className="w-16 h-16 drop-shadow-[0_0_14px_rgba(0,168,255,0.22)] hover:scale-105 transition-transform duration-500" />
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

        <nav className="hd-sidebar-nav flex-1 min-h-0 px-3 py-3 overflow-y-auto custom-scrollbar relative z-10" aria-label="Navegación principal">
          {OPS_ROLES.includes(role) && (
            <div className="mb-2">
              <NavItem icon={LayoutDashboard} color="cyan" label="Dashboard" active={activeSection === 'Dashboard'} onClick={() => setActiveSection('Dashboard')} />
            </div>
          )}

          <NavGroup label="Operacion">
            <NavItem icon={ClipboardCheck} color="green" label="Captura y Validación" active={activeSection === 'Captura y Validación'} onClick={openCaptureMenu} />
            <NavItem icon={FileSearch} color="cyan" label="Consultas" active={activeSection === 'Consulta y Seguimiento'} onClick={() => setActiveSection('Consulta y Seguimiento')} />
            <NavItem icon={MessageSquare} color="green" label="Chats" active={activeSection === 'Chats'} onClick={() => setActiveSection('Chats')} />
            <NavItem icon={Users} color="blue" label="Clientes" active={activeSection === 'Seguimiento de Clientes'} onClick={() => setActiveSection('Seguimiento de Clientes')} />
            <NavItem icon={MapPin} color="cyan" label="Zonas" active={activeSection === 'Historial por Zona'} onClick={() => setActiveSection('Historial por Zona')} />
            <NavItem icon={FolderOpen} color="purple" label="Docs" active={activeSection === 'Documentación'} onClick={() => setActiveSection('Documentación')} />
          </NavGroup>

          <NavGroup label="Administración">
            <NavItem icon={Wallet} color="yellow" label="Nóminas" active={activeSection === 'Nóminas'} onClick={() => setActiveSection('Nóminas')} />
            {OPS_ROLES.includes(role) && <NavItem icon={ReceiptText} color="green" label="Comisiones" active={activeSection === 'Comisiones'} onClick={() => setActiveSection('Comisiones')} />}
            <NavItem icon={CheckCircle2} color="green" label="Aprobaciones" active={activeSection === 'Aprobaciones'} onClick={() => setActiveSection('Aprobaciones')} />
            <NavItem icon={BarChart3} color="cyan" label="Efectividad" active={activeSection === 'Analytics'} onClick={() => setActiveSection('Analytics')} />
          </NavGroup>

          {hasFullModuleAccess && (
            <NavGroup label="Gerencia" compact>
              <NavItem icon={Users} color="blue" label="Equipo" active={activeSection === 'Equipo y Metas'} onClick={() => setActiveSection('Equipo y Metas')} />
              <NavItem icon={Users} color="cyan" label="Usuarios" active={activeSection === 'Gestión de Usuarios'} onClick={() => setActiveSection('Gestión de Usuarios')} badge={pendingUsers > 0 ? pendingUsers : undefined} />
              <NavItem icon={ReceiptText} color="yellow" label="Finanzas" active={activeSection === 'Finanzas Enterprise'} onClick={() => setActiveSection('Finanzas Enterprise')} />
              <NavItem icon={MapPin} color="cyan" label="Territorios" active={activeSection === 'Territorios'} onClick={() => setActiveSection('Territorios')} />
              <NavItem icon={Package} color="purple" label="Catálogo" active={activeSection === 'Catálogo'} onClick={() => setActiveSection('Catálogo')} />
              <NavItem icon={FileSpreadsheet} color="cyan" label="Base SIAC" active={activeSection === 'Base SIAC'} onClick={() => setActiveSection('Base SIAC')} />
              <NavItem icon={PhoneCall} color="green" label="Validaciones" active={activeSection === 'Validaciones'} onClick={() => setActiveSection('Validaciones')} />
              <NavItem icon={Bot} color="purple" label="Agentes IA" active={activeSection === 'Hub de Agentes'} onClick={() => setActiveSection('Hub de Agentes')} />
            </NavGroup>
          )}

          <NavGroup label="Comunicación">
            <NavItem icon={Headphones} color="purple" label="Soporte a Clientes" active={activeSection === 'Soporte a Clientes'} onClick={() => setActiveSection('Soporte a Clientes')} />
            <NavItem icon={AlertTriangle} color="red" label="Morosidad" active={activeSection === 'Morosidad'} onClick={() => setActiveSection('Morosidad')} />
            <NavItem icon={Megaphone} color="cyan" label="Anuncios" active={activeSection === 'Anuncios'} onClick={() => setActiveSection('Anuncios')} />
          </NavGroup>

          <NavGroup label="Sistema">
            <NavItem icon={User} color="blue" label="Perfil" active={activeSection === 'Perfil'} onClick={() => setActiveSection('Perfil')} />
            {hasFullModuleAccess && <NavItem icon={Zap} color="yellow" label="Integraciones" active={activeSection === 'Integraciones'} onClick={() => setActiveSection('Integraciones')} />}
            {hasFullModuleAccess && <NavItem icon={Bot} color="purple" label="Diseñador IA" active={showAgentDesigner} onClick={() => setShowAgentDesigner(true)} />}
            {hasFullModuleAccess && <NavItem icon={Shield} color="yellow" label="Auditoría" active={activeSection === 'Auditoría'} onClick={() => setActiveSection('Auditoría')} />}
            {hasFullModuleAccess && <NavItem icon={Database} color="blue" label="Backup" active={activeSection === 'Datos y Backup'} onClick={() => setActiveSection('Datos y Backup')} />}
          </NavGroup>
        </nav>

        <div className="hd-sidebar-footer shrink-0 p-3 border-t border-white/5 relative z-20">
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
      <main className="hd-app-main flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
        <DashboardLayout
          activity={pendingSales > 0 || pendingUsers > 0 ? 'message' : waStatus === 'connected' || tgStatus === 'polling' ? 'active' : 'idle'}
          className="hd-module-stage flex min-h-0 flex-1 flex-col"
          contentClassName="flex min-h-0 flex-1 flex-col"
        >
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative z-10 w-full overflow-hidden">
          {/* Subtle Top Nav */}
          <div className="hd-dashboard-breadcrumb hd-topbar shrink-0 px-6 py-3 flex items-center gap-2 w-full">
             {activeSection !== 'Dashboard' && OPS_ROLES.includes(role) && (
               <button
                 onClick={() => setActiveSection('Dashboard')}
                 className="hd-no-liquid mr-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-white"
               >
                 Regresar
               </button>
             )}
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
          <div className="hd-dashboard-clean hd-scroll-zone flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
          {activeSection === 'Dashboard' && (
            <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <SectionHeader
                 eyebrow={`Panel de control · ${new Date().toLocaleDateString('es-MX')}`}
                 title={<><span>{userName}</span> <span className="text-cyan-300">CRM</span></>}
                 description={<>Vista ejecutiva de capturas, validaciones, canales y tareas operativas. Hora del sistema: <ClockText />.</>}
                 action={<PremiumBadge tone="emerald" dot>Sistema activo</PremiumBadge>}
               />

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_.75fr]">
                <PremiumCard className="overflow-hidden p-6" tone="slate">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">CEO Dashboard</p>
                      <h2 className="mt-1 text-2xl font-semibold text-white">Centro ejecutivo Heavenly Dreams</h2>
                      <p className="mt-2 text-sm text-slate-400">Primer bloque del plan 95+: ventas, instalaciones, reclutamiento, conversion y meta mensual.</p>
                    </div>
                    <PremiumBadge tone={hasFullModuleAccess ? 'emerald' : 'amber'} dot>
                      {hasFullModuleAccess ? 'Vista gerente completa' : 'Vista operativa limitada'}
                    </PremiumBadge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <ExecutiveMetric icon={TrendingUp} label="Ventas del dia" value={todaySales} detail="Capturas nuevas" tone="cyan" />
                    <ExecutiveMetric icon={CheckCircle2} label="Instalaciones" value={approvedSales} detail="Aprobadas / procedieron" tone="emerald" />
                    <ExecutiveMetric icon={Users} label="Reclutas" value={pendingUsers} detail="Pendientes por aprobar" tone="purple" />
                    <ExecutiveMetric icon={Target} label="Conversion" value={`${conversionRate}%`} detail={`${approvedSales}/${saleCount} ventas`} tone="amber" />
                    <ExecutiveMetric icon={DollarSign} label="Ingreso mensual" value={formatMoney(monthRevenue)} detail="Renta mensual capturada" tone="green" />
                    <ExecutiveMetric icon={Activity} label="Meta mensual" value={`${goalProgress}%`} detail={`${approvedSales}/${monthlyGoal} objetivo`} tone="blue" />
                  </div>
                </PremiumCard>

                <PremiumCard className="p-6" tone="purple">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-violet-300/20 bg-violet-400/10 p-3 text-violet-200">
                      <Bot className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">Director operativo IA</p>
                      <h3 className="mt-1 text-xl font-semibold text-white">Lectura ejecutiva</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">Heavenly AI inicia como capa de supervision: detecta pendientes, riesgo y decisiones que bloquean avance.</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {directorSignals.map(signal => (
                      <div key={signal} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs font-semibold leading-5 text-slate-200">
                        {signal}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    <span className="rounded-xl border border-emerald-300/15 bg-emerald-400/5 px-3 py-2 text-emerald-200">Gerente: todo</span>
                    <span className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-cyan-200">Supervisor: operativo</span>
                    <span className="rounded-xl border border-violet-300/15 bg-violet-400/5 px-3 py-2 text-violet-200">Reclutador: equipo</span>
                    <span className="rounded-xl border border-amber-300/15 bg-amber-400/5 px-3 py-2 text-amber-200">Vendedor: campo</span>
                  </div>
                </PremiumCard>
              </div>

              <PremiumCard className="p-6" tone="amber">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Embudo comercial visual</p>
                    <h3 className="mt-1 text-xl font-semibold text-white">Prospectos a instalaciones</h3>
                  </div>
                  <p className="text-xs text-slate-400">Construido con canales, aprobaciones IA y ventas reales disponibles.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                  {pipelineStages.map(stage => (
                    <div key={stage.label}>
                      <PipelineStage stage={stage} maxValue={pipelineProspects} />
                    </div>
                  ))}
                </div>
              </PremiumCard>

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

              <PremiumCard className="p-6 overflow-hidden" tone="cyan">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100">
                      <Zap className="h-3.5 w-3.5" />
                      Inicio de sesion activo
                    </div>
                    <h2 className="text-2xl font-semibold text-white">
                      {greeting}, {userName}. Listo para avanzar.
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {motivationalPhrase}
                    </p>
                  </div>
                  <button
                    onClick={startSaleCapture}
                    className="hd-liquid-button hd-card-interactive flex min-h-[58px] items-center justify-center gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-5 text-sm font-semibold text-emerald-100 transition-all hover:border-emerald-300/50 hover:bg-emerald-400/15"
                  >
                    <ClipboardCheck className="h-5 w-5" />
                    Iniciar captura de venta
                  </button>
                </div>
              </PremiumCard>

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

              <Suspense fallback={<SectionLoader />}>
                <DashboardGradientCharts
                  userCount={userCount}
                  saleCount={saleCount}
                  approvedSales={approvedSales}
                  pendingSales={pendingSales}
                  rejectedSales={rejectedSales}
                  todaySales={todaySales}
                  conversations={channelSummary.conversations}
                  pendingApprovals={channelSummary.pendingApprovals}
                  inventoryItems={inventoryItems}
                  compact
                />
              </Suspense>

              {/* Quick Actions */}
              <PremiumCard className="p-5" tone="cyan">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-300"></div>
                  <h3 className="text-sm font-semibold text-slate-300">Accesos principales</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <QuickAction icon={ClipboardCheck} label="Capturar venta" color="green" onClick={startSaleCapture} />
                  <QuickAction icon={FileSearch} label="Consultas" color="cyan" onClick={() => setActiveSection('Consulta y Seguimiento')} />
                  <QuickAction icon={MessageSquare} label="Chats" color="green" onClick={() => setActiveSection('Chats')} />
                  <QuickAction icon={Users} label="Clientes" color="blue" onClick={() => setActiveSection('Seguimiento de Clientes')} />
                  {OPS_ROLES.includes(role) && (
                    <QuickAction icon={ReceiptText} label="Comisiones" color="green" onClick={() => setActiveSection('Comisiones')} />
                  )}
                  {hasFullModuleAccess && (
                    <QuickAction icon={CheckCircle2} label="Aprobaciones" color="yellow" onClick={() => setActiveSection('Aprobaciones')} />
                  )}
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
                      {hasFullModuleAccess && (
                        <button
                          onClick={() => setActiveSection('Integraciones')}
                          className="hd-no-liquid text-[9px] text-slate-500 hover:text-cyan-400 uppercase tracking-widest font-bold transition-colors flex items-center gap-1"
                        >
                          Gestionar <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
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
                    {hasFullModuleAccess && (
                      <button
                        onClick={() => setActiveSection('Hub de Agentes')}
                        className="w-full text-xs text-emerald-300 border border-emerald-400/20 rounded-lg py-2 hover:bg-emerald-400/5 transition-colors font-semibold"
                      >
                        Ver en Hub de Agentes
                      </button>
                    )}
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
                      {hasFullModuleAccess && (
                        <button
                          onClick={() => setActiveSection('Hub de Agentes')}
                          className="hd-no-liquid text-[9px] text-slate-500 hover:text-cyan-400 uppercase tracking-widest font-bold transition-colors flex items-center gap-1"
                        >
                          {tgStatus === 'polling' ? 'Ver mensajes' : 'Configurar'} <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
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
            {activeSection === 'Ajustes' && hasFullModuleAccess && <Settings />}
            {activeSection === 'Perfil' && <Profile />}
            {activeSection === 'Nóminas' && <Payroll />}
            {activeSection === 'Comisiones' && <CommissionsView />}
            {activeSection === 'Anuncios' && <Announcements />}
            {activeSection === 'Captura y Validación' && <CaptureValidation key={captureInitialView} initialView={captureInitialView} />}
            {activeSection === 'Consulta y Seguimiento' && <ConsultasSeguimiento />}
            {activeSection === 'Soporte a Clientes' && <CustomerSupport />}
            {activeSection === 'Chat para Clientes' && <ClientChatCrmView />}
            {activeSection === 'Morosidad' && <Morosidad />}
            {activeSection === 'Integraciones' && hasFullModuleAccess && <Integrations />}
            {activeSection === 'Documentación' && <MyFilesView onBack={() => setActiveSection('Dashboard')} />}
            {activeSection === 'Historial por Zona' && <ZoneHistoryView />}
            {activeSection === 'Analytics' && hasFullModuleAccess && <AnalyticsView />}
            {activeSection === 'Equipo y Metas' && hasFullModuleAccess && <TeamManagementView />}
            {activeSection === 'Aprobaciones' && hasFullModuleAccess && <ApprovalFlowView />}
            {activeSection === 'Territorios' && hasFullModuleAccess && <TerritoriesView />}
            {activeSection === 'Catálogo' && hasFullModuleAccess && <PackageCatalogEditor />}
            {activeSection === 'Auditoría' && hasFullModuleAccess && <AuditLogView />}
            {activeSection === 'Arquitectura Empresarial' && hasFullModuleAccess && <EnterpriseOpsView />}
            {activeSection === 'Simulación Producción' && hasFullModuleAccess && <ProductionSimulationView />}
            {activeSection === 'Datos y Backup' && hasFullModuleAccess && <DataManagerView />}
            {activeSection === 'Base SIAC' && hasFullModuleAccess && <SIACView />}
            {activeSection === 'Validaciones' && hasFullModuleAccess && <ValidationRequestsView />}
            {activeSection === 'Config. Llamadas' && hasFullModuleAccess && <ValidationConfigView />}
            {activeSection === 'Hub de Agentes' && hasFullModuleAccess && <AgentHubView />}
            {activeSection === 'Gestión de Usuarios' && hasFullModuleAccess && <UserManagementView />}
            {activeSection === 'Finanzas Enterprise' && hasFullModuleAccess && <FinancesEnterpriseView />}
            {activeSection === 'Chats' && (
              <ChatsView
                onOpenSettings={hasFullModuleAccess ? () => setActiveSection('Ajustes') : undefined}
                onOpenAgents={hasFullModuleAccess ? () => setActiveSection('Hub de Agentes') : undefined}
                onStartCapture={() => setActiveSection('Captura y Validación')}
                onOpenFolios={() => setActiveSection('Consulta y Seguimiento')}
              />
            )}
            {activeSection === 'Seguimiento de Clientes' && <CustomerFollowUpView />}
          </Suspense>

          {/* Placeholder for other sections */}
          {!['Dashboard', 'Ajustes', 'Perfil', 'Nóminas', 'Comisiones', 'Anuncios', 'Captura y Validación', 'Consulta y Seguimiento', 'Chats', 'Seguimiento de Clientes', 'Soporte a Clientes', 'Chat para Clientes', 'Morosidad', 'Documentación', 'Integraciones', 'Historial por Zona', 'Analytics', 'Equipo y Metas', 'Aprobaciones', 'Territorios', 'Catálogo', 'Auditoría', 'Arquitectura Empresarial', 'Simulación Producción', 'Datos y Backup', 'Base SIAC', 'Validaciones', 'Config. Llamadas', 'Hub de Agentes', 'Gestión de Usuarios', 'Finanzas Enterprise'].includes(activeSection) && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-cyber-electric/50">
                <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">{activeSection}</h2>
                <p className="font-mono text-sm uppercase tracking-widest">Protocolo no inicializado.</p>
              </div>
            </div>
          )}
        </div>
        </div>
        </DashboardLayout>
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

function ExecutiveMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  detail: string;
  tone: 'cyan' | 'emerald' | 'purple' | 'amber' | 'green' | 'blue';
}) {
  const tones: Record<string, string> = {
    cyan: 'border-cyan-300/15 bg-cyan-400/5 text-cyan-200',
    emerald: 'border-emerald-300/15 bg-emerald-400/5 text-emerald-200',
    purple: 'border-violet-300/15 bg-violet-400/5 text-violet-200',
    amber: 'border-amber-300/15 bg-amber-400/5 text-amber-200',
    green: 'border-lime-300/15 bg-lime-400/5 text-lime-200',
    blue: 'border-sky-300/15 bg-sky-400/5 text-sky-200',
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <div className={`rounded-xl border p-2 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 truncate text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function PipelineStage({
  stage,
  maxValue,
}: {
  stage: { label: string; value: number; color: string; detail: string };
  maxValue: number;
}) {
  const progress = clampPercent((stage.value / Math.max(maxValue, 1)) * 100);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{stage.label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{stage.value}</p>
        </div>
        <span className="text-xs font-black text-slate-500">{progress}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full bg-gradient-to-r ${stage.color}`} style={{ width: `${Math.max(progress, stage.value ? 8 : 0)}%` }} />
      </div>
      <p className="mt-3 text-[11px] font-semibold text-slate-500">{stage.detail}</p>
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
      className={`hd-liquid-button hd-card hd-card-interactive hd-quick-action flex items-center justify-center gap-3 rounded-xl border px-3 py-3 transition-all ${colors[color] || colors.cyan}`}
      data-tone={color}
    >
      <Icon className="hd-quick-action-icon h-5 w-5" />
      <span className="text-[11px] font-black uppercase tracking-[0.08em]">{label}</span>
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
      className={`hd-liquid-button hd-nav-item w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all relative overflow-hidden group border border-transparent ${active ? 'hd-liquid-selected is-active' : ''} ${colorClasses}`}
      data-tone={color}
    >
      <Icon className={`hd-nav-item-icon w-4 h-4 transition-transform group-hover:scale-110`} />
      <span className="text-[12px] font-bold flex-1">{label}</span>
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
