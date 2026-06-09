import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Users, Bell,
  LogOut, TrendingUp,
  LayoutDashboard, Settings as SettingsIcon,
  User, ClipboardCheck, FileSearch, Wallet, Headphones,
  Sun, Moon, Crown, Zap, Bot, Home, MessageSquare,
  CheckCircle2, PhoneCall, ReceiptText, Target, DollarSign
} from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useFollowUpReminders } from '../../hooks/useFollowUpReminders';
import { OfflineBanner } from '../ui/OfflineBanner';
import Logo from '../ui/Logo';
import { CyberIcon } from '../ui/CyberIcon';
import { PremiumBadge, PremiumCard, SectionHeader } from '../ui/premium';
import DashboardLayout from '../../layouts/dashboard-layout';

const Settings = lazy(() => import('./Settings'));
const Payroll = lazy(() => import('./Payroll'));
const CaptureValidation = lazy(() => import('./CaptureValidation'));
const Profile = lazy(() => import('./Profile'));
const ConsultasSeguimiento = lazy(() => import('./ConsultasSeguimiento'));
const CustomerSupport = lazy(() => import('./CustomerSupport'));
const Integrations = lazy(() => import('./Integrations'));
const TeamManagementView = lazy(() => import('./TeamManagementView'));
const ApprovalFlowView = lazy(() => import('./ApprovalFlowView'));
const ValidationRequestsView = lazy(() => import('./ValidationRequestsView'));
const AgentHubView = lazy(() => import('./AgentHubView'));
const UserManagementView = lazy(() => import('./UserManagementView'));
const ChatsView = lazy(() => import('./ChatsView'));
const CustomerFollowUpView = lazy(() => import('./CustomerFollowUpView'));
const CommissionsView = lazy(() => import('./CommissionsView'));
const OPS_ROLES = ['GERENTE', 'ADMINISTRACION', 'SUPERVISOR'];
const ADMIN_ROLES = ['GERENTE'];
const MANAGER_ONLY_SECTIONS = new Set([
  'Ajustes',
  'Equipo y Metas',
  'Aprobaciones',
  'Hub de Agentes',
  'Gestión de Usuarios',
  'Validaciones',
  'Integraciones',
]);

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

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value || 0);
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
  const [captureInitialView, setCaptureInitialView] = useState<'menu' | 'new_sale'>('menu');
  const { isOnline, pendingCount, syncing, syncNow } = useOfflineSync();
  useFollowUpReminders();

  // Real CRM stats
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
  const hasFullModuleAccess = ADMIN_ROLES.includes(role);

  const loadStats = async () => {
    if (!OPS_ROLES.includes(role)) return;
    try {
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) return;
      const data = await res.json();
      setPendingUsers(data.pendingUsers || 0);
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
  }, [activeSection, hasFullModuleAccess, role]);

  const userName = currentUser?.displayName || 'Usuario';
  const userRoleLabel = (currentUser?.role || role) === 'GERENTE'
    ? 'SUPERUSER'
    : (currentUser?.role || role) === 'ADMINISTRACION'
      ? 'ADMINISTRACION'
    : (currentUser?.role || role);
  const notificationCount = pendingSales + pendingUsers;
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
                <button
                  onClick={onBack}
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                  className="hd-no-liquid text-rose-300 hover:text-rose-100 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 rounded p-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
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
          </NavGroup>

          <NavGroup label="Administración">
            <NavItem icon={Wallet} color="yellow" label="Nóminas" active={activeSection === 'Nóminas'} onClick={() => setActiveSection('Nóminas')} />
            {OPS_ROLES.includes(role) && <NavItem icon={ReceiptText} color="green" label="Comisiones" active={activeSection === 'Comisiones'} onClick={() => setActiveSection('Comisiones')} />}
            <NavItem icon={CheckCircle2} color="green" label="Aprobaciones" active={activeSection === 'Aprobaciones'} onClick={() => setActiveSection('Aprobaciones')} />
          </NavGroup>

          {hasFullModuleAccess && (
            <NavGroup label="Gerencia" compact>
              <NavItem icon={Users} color="blue" label="Equipo" active={activeSection === 'Equipo y Metas'} onClick={() => setActiveSection('Equipo y Metas')} />
              <NavItem icon={Users} color="cyan" label="Usuarios" active={activeSection === 'Gestión de Usuarios'} onClick={() => setActiveSection('Gestión de Usuarios')} badge={pendingUsers > 0 ? pendingUsers : undefined} />
              <NavItem icon={PhoneCall} color="green" label="Validaciones" active={activeSection === 'Validaciones'} onClick={() => setActiveSection('Validaciones')} />
              <NavItem icon={Bot} color="purple" label="Agentes IA" active={activeSection === 'Hub de Agentes'} onClick={() => setActiveSection('Hub de Agentes')} />
            </NavGroup>
          )}

          <NavGroup label="Comunicación">
            <NavItem icon={Headphones} color="purple" label="Soporte a Clientes" active={activeSection === 'Soporte a Clientes'} onClick={() => setActiveSection('Soporte a Clientes')} />
          </NavGroup>

          <NavGroup label="Sistema">
            <NavItem icon={User} color="blue" label="Perfil" active={activeSection === 'Perfil'} onClick={() => setActiveSection('Perfil')} />
            {hasFullModuleAccess && <NavItem icon={Zap} color="yellow" label="Integraciones" active={activeSection === 'Integraciones'} onClick={() => setActiveSection('Integraciones')} />}
            {hasFullModuleAccess && <NavItem icon={SettingsIcon} color="slate" label="Ajustes" active={activeSection === 'Ajustes'} onClick={() => setActiveSection('Ajustes')} />}
          </NavGroup>
        </nav>

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

              <PremiumCard className="overflow-hidden p-5" tone="slate">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">CEO Dashboard</p>
                      <h2 className="mt-1 text-xl font-semibold text-white">Centro ejecutivo Heavenly Dreams</h2>
                      <p className="mt-2 text-sm text-slate-400">Resumen limpio: ventas, instalaciones, pendientes e ingreso mensual.</p>
                    </div>
                    <PremiumBadge tone={hasFullModuleAccess ? 'emerald' : 'amber'} dot>
                      {hasFullModuleAccess ? 'Vista gerente completa' : 'Vista operativa limitada'}
                    </PremiumBadge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <ExecutiveMetric icon={TrendingUp} label="Ventas del dia" value={todaySales} detail="Capturas nuevas" tone="cyan" />
                    <ExecutiveMetric icon={CheckCircle2} label="Instalaciones" value={approvedSales} detail="Aprobadas / procedieron" tone="emerald" />
                    <ExecutiveMetric icon={Target} label="Pendientes" value={pendingSales + pendingUsers + channelSummary.pendingApprovals} detail="Requieren accion" tone="amber" />
                    <ExecutiveMetric icon={DollarSign} label="Ingreso mensual" value={formatMoney(monthRevenue)} detail="Renta mensual capturada" tone="green" />
                  </div>
              </PremiumCard>

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

            </div>
          )}

          <Suspense fallback={<SectionLoader />}>
            {activeSection === 'Ajustes' && hasFullModuleAccess && <Settings />}
            {activeSection === 'Perfil' && <Profile />}
            {activeSection === 'Nóminas' && <Payroll />}
            {activeSection === 'Comisiones' && <CommissionsView />}
            {activeSection === 'Captura y Validación' && <CaptureValidation key={captureInitialView} initialView={captureInitialView} />}
            {activeSection === 'Consulta y Seguimiento' && <ConsultasSeguimiento />}
            {activeSection === 'Soporte a Clientes' && <CustomerSupport />}
            {activeSection === 'Integraciones' && hasFullModuleAccess && <Integrations />}
            {activeSection === 'Equipo y Metas' && hasFullModuleAccess && <TeamManagementView />}
            {activeSection === 'Aprobaciones' && hasFullModuleAccess && <ApprovalFlowView />}
            {activeSection === 'Validaciones' && hasFullModuleAccess && <ValidationRequestsView />}
            {activeSection === 'Hub de Agentes' && hasFullModuleAccess && <AgentHubView />}
            {activeSection === 'Gestión de Usuarios' && hasFullModuleAccess && <UserManagementView />}
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
          {!['Dashboard', 'Ajustes', 'Perfil', 'Nóminas', 'Comisiones', 'Captura y Validación', 'Consulta y Seguimiento', 'Chats', 'Seguimiento de Clientes', 'Soporte a Clientes', 'Integraciones', 'Equipo y Metas', 'Aprobaciones', 'Validaciones', 'Hub de Agentes', 'Gestión de Usuarios'].includes(activeSection) && (
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

      <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} syncing={syncing} onSync={syncNow} />
    </div>
  );
}

const ExecutiveMetric = React.memo(function ExecutiveMetric({
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
});

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
