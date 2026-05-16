import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  BarChart3, Users, DollarSign, Activity, Bell, Search,
  LogOut, TrendingUp, ArrowUpRight, ArrowDownRight,
  LayoutDashboard, Settings as SettingsIcon, FileText, PieChart, ChevronLeft, ChevronRight,
  User, ClipboardCheck, FileSearch, Wallet, Headphones, AlertTriangle, Megaphone, ImagePlus, Gamepad2, FolderOpen,
  Cpu, Database, Smartphone, Sun, Moon, X, Crown, Zap, Bot, Home, MessageSquare,
  MapPin, UserPlus, WifiOff, RefreshCw, CheckCircle2, Shield, Package, FileSpreadsheet, PhoneCall
} from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useFollowUpReminders } from '../../hooks/useFollowUpReminders';
import { OfflineBanner } from '../ui/OfflineBanner';
import Logo from '../ui/Logo';
import { CyberIcon } from '../ui/CyberIcon';

const Settings = lazy(() => import('./Settings'));
const Payroll = lazy(() => import('./Payroll'));
const Announcements = lazy(() => import('./Announcements'));
const CaptureValidation = lazy(() => import('./CaptureValidation'));
const Profile = lazy(() => import('./Profile'));
const ConsultasSeguimiento = lazy(() => import('./ConsultasSeguimiento'));
const Game = lazy(() => import('./Game'));
const CustomerSupport = lazy(() => import('./CustomerSupport'));
const Morosidad = lazy(() => import('./Morosidad'));
const ContractsManager = lazy(() => import('./ContractsManager'));
const MyFilesView = lazy(() => import('./MyFilesView'));
const Integrations = lazy(() => import('./Integrations'));
const AgentDesigner = lazy(() => import('./AgentDesigner').then(m => ({ default: m.AgentDesigner })));
const QuickQuote = lazy(() => import('./QuickQuote'));
const SalesScriptView = lazy(() => import('./SalesScriptView'));
const ZoneHistoryView = lazy(() => import('./ZoneHistoryView'));
const ReferralsView = lazy(() => import('./ReferralsView'));
const AnalyticsView = lazy(() => import('./AnalyticsView'));
const TeamManagementView = lazy(() => import('./TeamManagementView'));
const CommissionsView = lazy(() => import('./CommissionsView'));
const ApprovalFlowView = lazy(() => import('./ApprovalFlowView'));
const TerritoriesView = lazy(() => import('./TerritoriesView'));
const PackageCatalogEditor = lazy(() => import('./PackageCatalogEditor'));
const AuditLogView = lazy(() => import('./AuditLogView'));
const DataManagerView = lazy(() => import('./DataManagerView'));
const SIACView = lazy(() => import('./SIACView'));
const ValidationConfigView = lazy(() => import('./ValidationConfigView'));
const ValidationRequestsView = lazy(() => import('./ValidationRequestsView'));
const AgentHubView = lazy(() => import('./AgentHubView'));

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
      <p className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

import { Role } from '../../App';
import NetworkPattern from '../ui/NetworkPattern';

interface ManagerViewProps {
  role: Role;
  onBack: () => void;
  currentUser?: { uid: string; email: string; displayName?: string; role?: string } | null;
  isLightMode?: boolean;
  onToggleTheme?: () => void;
}

export default function ManagerView({ role, onBack, currentUser, isLightMode, onToggleTheme }: ManagerViewProps) {
  const [activeSection, setActiveSection] = useState(['GERENTE', 'SUPERVISOR'].includes(role) ? 'Dashboard' : 'Perfil');
  const [time, setTime] = useState(new Date().toLocaleTimeString('es-ES', { hour12: false }));
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
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [waStatus, setWaStatus] = useState<'disconnected'|'qr'|'authenticating'|'connected'>('disconnected');
  const [tgStatus, setTgStatus] = useState<'disconnected'|'polling'|'error'>('disconnected');
  const [recentMessages, setRecentMessages] = useState<any[]>([]);

  const loadStats = async () => {
    try {
      const [usersRes, ventasRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/ventas'),
      ]);
      const users: any[] = usersRes.ok ? await usersRes.json() : [];
      const sales: any[] = ventasRes.ok ? await ventasRes.json() : [];

      setUserCount(users.length || 0);
      setSaleCount(sales.length || 0);
      setPendingSales(sales.filter((s: any) => (s.status || 'pendiente') === 'pendiente').length);
      setApprovedSales(sales.filter((s: any) => s.status === 'aprobada' || s.status === 'procedio').length);
      setRejectedSales(sales.filter((s: any) => s.status === 'rechazada').length);

      const today = new Date().toISOString().split('T')[0];
      setTodaySales(sales.filter((s: any) => (s.fecha_solicitud || s.created_at || '').startsWith(today)).length);

      const now = new Date();
      const monthSales = sales.filter((s: any) => {
        const d = new Date(s.fecha_solicitud || s.created_at || 0);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      setMonthRevenue(monthSales.reduce((sum: number, s: any) => sum + (Number(s.renta_mensual) || 0), 0));
    } catch { /* silencioso - puede estar offline */ }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-ES', { hour12: false }));
    }, 1000);
    loadStats();
    const loadChannels = async () => {
      try {
        const [ws, tgs, msgs] = await Promise.all([
          fetch('/api/whatsapp/status').then(r => r.ok ? r.json() : null),
          fetch('/api/telegram/status').then(r => r.ok ? r.json() : null),
          fetch('/api/channels/messages').then(r => r.ok ? r.json() : []),
        ]);
        if (ws) setWaStatus(ws.status);
        if (tgs) setTgStatus(tgs.status);
        setRecentMessages((msgs as any[]).slice(0, 5));
      } catch {}
    };
    loadChannels();
    const statsTimer = setInterval(loadStats, 8000);
    const channelTimer = setInterval(loadChannels, 12000);
    return () => { clearInterval(timer); clearInterval(statsTimer); clearInterval(channelTimer); };
  }, []);

  const userName = currentUser?.displayName || 'Usuario';
  const userRoleLabel = (currentUser?.role || role) === 'GERENTE'
    ? 'SUPERUSER'
    : (currentUser?.role || role);
  const notificationCount = pendingSales;

  return (
    <div className="flex h-[100dvh] w-full text-white relative z-10 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-cyber-black/60 backdrop-blur-sm border-r border-slate-800/80 hidden md:flex flex-col relative z-20">
        
        <div className="h-28 flex flex-col items-center justify-center px-6 relative overflow-hidden border-b border-yellow-400/10 gap-3 z-10">
          <Logo className="w-12 h-12 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] hover:scale-110 transition-transform duration-500" />
          <div className="text-center">
            <h1 className="text-sm font-black text-white tracking-[0.15em] leading-none uppercase">Heavenly Dreams</h1>
            <p className="text-[7px] text-yellow-400 tracking-[0.2em] font-bold mt-1 uppercase leading-tight drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">
              Heavenly Dreams Sas De Cv
            </p>
          </div>
        </div>

        <div className="p-3 border-b border-white/5 space-y-2 relative z-10">
          <div className="flex items-center justify-between bg-[#0a0d14] border border-slate-800 rounded-xl p-3">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0A0D14] border border-yellow-400/50 flex items-center justify-center text-xs font-bold text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.3)]">
                   <Crown className="w-4 h-4" />
                </div>
                <div>
                   <p className="text-xs font-bold text-white truncate max-w-[120px]" title={userName}>{userName}</p>
                   <p className="text-[9px] text-yellow-400 tracking-widest uppercase font-bold drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">{userRoleLabel}</p>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <button
                  onClick={onToggleTheme}
                  aria-label={isLightMode ? 'Activar modo oscuro' : 'Activar modo claro'}
                  className="text-slate-400 hover:text-white transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded p-1"
                  title="Cambiar tema"
                >
                  {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
                <div className="relative">
                  <button
                    className="text-slate-400 hover:text-white transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded p-1"
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
          {['GERENTE', 'SUPERVISOR'].includes(role) && (
            <div className="mb-3">
              <NavItem icon={LayoutDashboard} color="cyan" label="Dashboard" active={activeSection === 'Dashboard'} onClick={() => setActiveSection('Dashboard')} />
            </div>
          )}

          <NavGroup label="Operativo">
            <NavItem icon={ClipboardCheck} color="green" label="Captura y Validación" active={activeSection === 'Captura y Validación'} onClick={() => setActiveSection('Captura y Validación')} />
            <NavItem icon={FileSearch} color="cyan" label="Consulta y Seguimiento" active={activeSection === 'Consulta y Seguimiento'} onClick={() => setActiveSection('Consulta y Seguimiento')} />
            <NavItem icon={FolderOpen} color="purple" label="Documentación" active={activeSection === 'Documentación'} onClick={() => setActiveSection('Documentación')} />
          </NavGroup>

          <NavGroup label="Promotor de Campo">
            <NavItem icon={Zap} color="yellow" label="Cotizador Rápido" active={activeSection === 'Cotizador Rápido'} onClick={() => setActiveSection('Cotizador Rápido')} />
            <NavItem icon={Bot} color="purple" label="Scripts de Venta" active={activeSection === 'Scripts de Venta'} onClick={() => setActiveSection('Scripts de Venta')} />
            <NavItem icon={MapPin} color="cyan" label="Historial por Zona" active={activeSection === 'Historial por Zona'} onClick={() => setActiveSection('Historial por Zona')} />
            <NavItem icon={UserPlus} color="green" label="Referidos" active={activeSection === 'Referidos'} onClick={() => setActiveSection('Referidos')} />
          </NavGroup>

          <NavGroup label="Administración">
            <NavItem icon={Wallet} color="yellow" label="Nóminas" active={activeSection === 'Nóminas'} onClick={() => setActiveSection('Nóminas')} />
            <NavItem icon={FileText} color="blue" label="Contratos" active={activeSection === 'Contratos'} onClick={() => setActiveSection('Contratos')} />
            {role === 'GERENTE' && <NavItem icon={SettingsIcon} color="slate" label="Ajustes" active={activeSection === 'Ajustes'} onClick={() => setActiveSection('Ajustes')} />}
          </NavGroup>

          {['GERENTE', 'SUPERVISOR'].includes(role) && (
            <NavGroup label="Administración Avanzada">
              <NavItem icon={BarChart3} color="cyan" label="Analytics" active={activeSection === 'Analytics'} onClick={() => setActiveSection('Analytics')} />
              <NavItem icon={Users} color="blue" label="Equipo y Metas" active={activeSection === 'Equipo y Metas'} onClick={() => setActiveSection('Equipo y Metas')} />
              <NavItem icon={DollarSign} color="yellow" label="Comisiones" active={activeSection === 'Comisiones'} onClick={() => setActiveSection('Comisiones')} />
              <NavItem icon={CheckCircle2} color="green" label="Aprobaciones" active={activeSection === 'Aprobaciones'} onClick={() => setActiveSection('Aprobaciones')} />
            </NavGroup>
          )}

          {['GERENTE', 'SUPERVISOR'].includes(role) && (
            <NavGroup label="Agentes IA">
              <NavItem icon={Bot} color="purple" label="Hub de Agentes" active={activeSection === 'Hub de Agentes'} onClick={() => setActiveSection('Hub de Agentes')} />
            </NavGroup>
          )}

          {role === 'GERENTE' && (
            <NavGroup label="Gerencia">
              <NavItem icon={MapPin} color="cyan" label="Territorios" active={activeSection === 'Territorios'} onClick={() => setActiveSection('Territorios')} />
              <NavItem icon={Package} color="purple" label="Catálogo" active={activeSection === 'Catálogo'} onClick={() => setActiveSection('Catálogo')} />
              <NavItem icon={Shield} color="yellow" label="Auditoría" active={activeSection === 'Auditoría'} onClick={() => setActiveSection('Auditoría')} />
              <NavItem icon={Database} color="blue" label="Datos y Backup" active={activeSection === 'Datos y Backup'} onClick={() => setActiveSection('Datos y Backup')} />
              <NavItem icon={FileSpreadsheet} color="cyan" label="Base SIAC" active={activeSection === 'Base SIAC'} onClick={() => setActiveSection('Base SIAC')} />
              <NavItem icon={PhoneCall} color="green" label="Validaciones" active={activeSection === 'Validaciones'} onClick={() => setActiveSection('Validaciones')} />
              <NavItem icon={PhoneCall} color="purple" label="Config. Llamadas" active={activeSection === 'Config. Llamadas'} onClick={() => setActiveSection('Config. Llamadas')} />
            </NavGroup>
          )}

          <NavGroup label="Comunicación">
            <NavItem icon={Headphones} color="purple" label="Soporte a Clientes" active={activeSection === 'Soporte a Clientes'} onClick={() => setActiveSection('Soporte a Clientes')} />
            <NavItem icon={AlertTriangle} color="red" label="Morosidad" active={activeSection === 'Morosidad'} onClick={() => setActiveSection('Morosidad')} />
            <NavItem icon={Megaphone} color="cyan" label="Anuncios" active={activeSection === 'Anuncios'} onClick={() => setActiveSection('Anuncios')} />
          </NavGroup>

          <NavGroup label="Sistema">
            <NavItem icon={User} color="blue" label="Perfil" active={activeSection === 'Perfil'} onClick={() => setActiveSection('Perfil')} />
            {['GERENTE', 'SUPERVISOR'].includes(role) && <NavItem icon={Zap} color="yellow" label="Integraciones" active={activeSection === 'Integraciones'} onClick={() => setActiveSection('Integraciones')} />}
            {['GERENTE', 'SUPERVISOR'].includes(role) && <NavItem icon={Bot} color="purple" label="Diseñador IA" active={false} onClick={() => setShowAgentDesigner(true)} />}
            <NavItem icon={Gamepad2} color="green" label="Juego" active={activeSection === 'Juego'} onClick={() => setActiveSection('Juego')} />
          </NavGroup>
        </nav>

        <div className="p-4 border-t border-white/5 relative z-10">
          <button 
            onClick={onBack}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/60 transition-all group text-rose-500"
          >
            <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="text-xs font-black uppercase tracking-[0.2em] group-hover:drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">Cerrar Sesión</span>
          </button>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative z-10 w-full overflow-hidden">
          {/* Subtle Top Nav */}
          <div className="pt-6 px-8 flex items-center gap-2 mb-2 w-full">
             <button
               onClick={() => activeSection !== 'Dashboard' ? setActiveSection('Dashboard') : null}
               className="text-slate-500 hover:text-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded p-1"
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
               <div className="flex items-center justify-between mb-8">
                  <div>
                     <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Crown className="text-yellow-400 w-8 h-8 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                        <span className="text-white">{userName}</span> <span className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">CRM</span>
                     </h2>
                     <p className="text-slate-500 text-xs mt-1.5 uppercase tracking-widest font-semibold">Panel de control · {time}</p>
                  </div>
                  <div className="px-3 py-1.5 border border-[#10b981]/30 bg-[#10b981]/5 flex items-center gap-2 rounded-full">
                     <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                     <span className="text-[#10b981] text-xs font-bold uppercase tracking-widest">Sistema Activo</span>
                  </div>
               </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 hover-group">
                <KpiCard
                  title="VENTAS HOY"
                  value={todaySales.toString()}
                  trend="CAPTURAS DEL DÍA"
                  trendUp={true}
                  icon={TrendingUp}
                  color="cyan"
                />
                <KpiCard
                  title="VENTAS TOTALES"
                  value={saleCount.toString()}
                  trend={`${approvedSales} APROBADAS`}
                  trendUp={true}
                  icon={Activity}
                  color="purple"
                />
                <KpiCard
                  title="PENDIENTES"
                  value={pendingSales.toString()}
                  trend="POR VALIDAR"
                  trendUp={false}
                  icon={ClipboardCheck}
                  color="green"
                />
                <KpiCard
                  title="INGRESO MES"
                  value={`$${monthRevenue.toLocaleString('es-MX')}`}
                  trend="RENTA MENSUAL"
                  trendUp={true}
                  icon={DollarSign}
                  color="cyan"
                />
              </div>

              {/* Secondary Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0a0d14] border border-slate-800/80 rounded-[14px] p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Personal Registrado</h4>
                  </div>
                  <p className="text-3xl font-semibold text-white">{userCount}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Asesores + Supervisores</p>
                </div>
                <div className="bg-[#0a0d14] border border-slate-800/80 rounded-[14px] p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Tasa de Aprobación</h4>
                  </div>
                  <p className="text-3xl font-semibold text-white">
                    {saleCount > 0 ? `${Math.round((approvedSales / saleCount) * 100)}%` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">{approvedSales}/{saleCount} ventas</p>
                </div>
                <div className="bg-[#0a0d14] border border-slate-800/80 rounded-[14px] p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <ArrowDownRight className="w-5 h-5 text-rose-400" />
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Rechazos</h4>
                  </div>
                  <p className="text-3xl font-semibold text-white">{rejectedSales}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">No procedieron</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-[#0a0d14] border border-slate-800/80 rounded-[14px] p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9] shadow-[0_0_8px_rgba(14,165,233,0.8)]"></div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Accesos Rápidos</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <QuickAction icon={ClipboardCheck} label="Nueva Captura" color="green" onClick={() => setActiveSection('Captura y Validación')} />
                  <QuickAction icon={FileSearch} label="Consultas" color="cyan" onClick={() => setActiveSection('Consulta y Seguimiento')} />
                  <QuickAction icon={Zap} label="Cotizador" color="yellow" onClick={() => setActiveSection('Cotizador Rápido')} />
                  <QuickAction icon={Bot} label="Scripts IA" color="purple" onClick={() => setActiveSection('Scripts de Venta')} />
                  <QuickAction icon={MapPin} label="Por Zona" color="cyan" onClick={() => setActiveSection('Historial por Zona')} />
                  <QuickAction icon={Users} label="Referidos" color="green" onClick={() => setActiveSection('Referidos')} />
                  <QuickAction icon={AlertTriangle} label="Morosidad" color="red" onClick={() => setActiveSection('Morosidad')} />
                  <QuickAction icon={Headphones} label="Soporte" color="purple" onClick={() => setActiveSection('Soporte a Clientes')} />
                  {['GERENTE', 'SUPERVISOR'].includes(role) && <>
                    <QuickAction icon={BarChart3} label="Analytics" color="cyan" onClick={() => setActiveSection('Analytics')} />
                    <QuickAction icon={CheckCircle2} label="Aprobaciones" color="green" onClick={() => setActiveSection('Aprobaciones')} />
                    <QuickAction icon={DollarSign} label="Comisiones" color="yellow" onClick={() => setActiveSection('Comisiones')} />
                    <QuickAction icon={Users} label="Equipo" color="purple" onClick={() => setActiveSection('Equipo y Metas')} />
                  </>}
                </div>
              </div>

              {/* ── SYNC RELAYS: Canal Status + Mensajes Recientes ── */}
              {['GERENTE', 'SUPERVISOR'].includes(role) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* WhatsApp panel */}
                  <div className="bg-[#0a0d14] border border-slate-800/80 rounded-[14px] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${waStatus === 'connected' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : waStatus === 'qr' ? 'bg-yellow-400 animate-pulse' : 'bg-slate-600'}`} />
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">WhatsApp</h4>
                        <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full ${
                          waStatus === 'connected' ? 'bg-emerald-400/10 text-emerald-400' :
                          waStatus === 'qr' ? 'bg-yellow-400/10 text-yellow-400' :
                          'bg-slate-700 text-slate-500'
                        }`}>{waStatus}</span>
                      </div>
                      <button
                        onClick={() => setActiveSection('Integraciones')}
                        className="text-[9px] text-slate-500 hover:text-cyan-400 uppercase tracking-widest font-bold transition-colors flex items-center gap-1"
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
                    <button
                      onClick={() => setActiveSection('Hub de Agentes')}
                      className="w-full text-[9px] text-emerald-400 border border-emerald-400/20 rounded-lg py-1.5 hover:bg-emerald-400/5 transition-colors font-bold uppercase tracking-widest"
                    >
                      Ver en Hub de Agentes
                    </button>
                  </div>

                  {/* Telegram panel */}
                  <div className="bg-[#0a0d14] border border-slate-800/80 rounded-[14px] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${tgStatus === 'polling' ? 'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]' : tgStatus === 'error' ? 'bg-rose-400' : 'bg-slate-600'}`} />
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Telegram</h4>
                        <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full ${
                          tgStatus === 'polling' ? 'bg-blue-400/10 text-blue-400' :
                          tgStatus === 'error'   ? 'bg-rose-400/10 text-rose-400' :
                                                   'bg-slate-700 text-slate-500'
                        }`}>{tgStatus}</span>
                      </div>
                      <button
                        onClick={() => setActiveSection('Hub de Agentes')}
                        className="text-[9px] text-slate-500 hover:text-cyan-400 uppercase tracking-widest font-bold transition-colors flex items-center gap-1"
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
                  </div>
                </div>
              )}
            </div>
          )}

          <Suspense fallback={<SectionLoader />}>
            {activeSection === 'Ajustes' && <Settings />}
            {activeSection === 'Perfil' && <Profile />}
            {activeSection === 'Nóminas' && <Payroll />}
            {activeSection === 'Anuncios' && <Announcements />}
            {activeSection === 'Captura y Validación' && <CaptureValidation />}
            {activeSection === 'Consulta y Seguimiento' && <ConsultasSeguimiento />}
            {activeSection === 'Contratos' && <ContractsManager />}
            {activeSection === 'Soporte a Clientes' && <CustomerSupport />}
            {activeSection === 'Morosidad' && <Morosidad />}
            {activeSection === 'Juego' && <Game />}
            {activeSection === 'Integraciones' && <Integrations />}
            {activeSection === 'Documentación' && <MyFilesView onBack={() => setActiveSection('Dashboard')} />}
            {activeSection === 'Cotizador Rápido' && <QuickQuote />}
            {activeSection === 'Scripts de Venta' && <SalesScriptView />}
            {activeSection === 'Historial por Zona' && <ZoneHistoryView />}
            {activeSection === 'Referidos' && <ReferralsView />}
            {activeSection === 'Analytics' && <AnalyticsView />}
            {activeSection === 'Equipo y Metas' && <TeamManagementView />}
            {activeSection === 'Comisiones' && <CommissionsView />}
            {activeSection === 'Aprobaciones' && <ApprovalFlowView />}
            {activeSection === 'Territorios' && <TerritoriesView />}
            {activeSection === 'Catálogo' && <PackageCatalogEditor />}
            {activeSection === 'Auditoría' && <AuditLogView />}
            {activeSection === 'Datos y Backup' && <DataManagerView />}
            {activeSection === 'Base SIAC' && <SIACView />}
            {activeSection === 'Validaciones' && <ValidationRequestsView />}
            {activeSection === 'Config. Llamadas' && <ValidationConfigView />}
            {activeSection === 'Hub de Agentes' && <AgentHubView />}
          </Suspense>

          {/* Placeholder for other sections */}
          {!['Dashboard', 'Ajustes', 'Perfil', 'Nóminas', 'Anuncios', 'Captura y Validación', 'Consulta y Seguimiento', 'Contratos', 'Soporte a Clientes', 'Morosidad', 'Juego', 'Documentación', 'Integraciones', 'Cotizador Rápido', 'Scripts de Venta', 'Historial por Zona', 'Referidos', 'Analytics', 'Equipo y Metas', 'Comisiones', 'Aprobaciones', 'Territorios', 'Catálogo', 'Auditoría', 'Datos y Backup', 'Base SIAC', 'Validaciones', 'Config. Llamadas', 'Hub de Agentes'].includes(activeSection) && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-cyber-electric/50">
                <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">{activeSection}</h2>
                <p className="font-mono text-sm uppercase tracking-widest">Protocolo no inicializado.</p>
              </div>
            </div>
          )}
        </div>
        </div>
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
    cyan: 'text-cyan-400 border-cyan-400/30 hover:bg-cyan-400/10',
    green: 'text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10',
    red: 'text-rose-400 border-rose-400/30 hover:bg-rose-400/10',
    purple: 'text-purple-400 border-purple-400/30 hover:bg-purple-400/10',
    yellow: 'text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10',
    blue: 'text-blue-400 border-blue-400/30 hover:bg-blue-400/10',
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border bg-[#0A0D14]/60 transition-all hover:-translate-y-0.5 ${colors[color] || colors.cyan}`}
    >
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

// Subcomponents
function NavItem({ icon: Icon, label, color, active = false, onClick }: { icon: any, label: string, color: string, active?: boolean, onClick?: () => void }) {
  const getColorClasses = () => {
    if (color === 'cyan') return active ? 'text-[#0ea5e9] bg-[#0ea5e9]/10 border-[#0ea5e9]/30 shadow-[inset_0_0_12px_rgba(14,165,233,0.1)]' : 'text-slate-400 hover:text-[#0ea5e9] hover:bg-[#0ea5e9]/5';
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
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all relative overflow-hidden group border border-transparent ${colorClasses}`}
    >
      <Icon className={`w-4 h-4 transition-transform group-hover:scale-110`} />
      <span className="text-[12px] font-bold uppercase tracking-widest">{label}</span>
      {active && (
        <div className={`absolute right-3 w-1 h-4 rounded-full ${
          color === 'cyan' ? 'bg-[#0ea5e9]' :
          color === 'blue' ? 'bg-blue-400' :
          color === 'purple' ? 'bg-purple-400' :
          color === 'green' ? 'bg-emerald-400' :
          color === 'yellow' ? 'bg-yellow-400' :
          color === 'red' ? 'bg-rose-400' : 'bg-white'
        } shadow-[0_0_8px_currentColor]`}></div>
      )}
    </button>
  );
}

function KpiCard({ title, value, trend, trendUp, icon: Icon, color }: any) {
  return (
    <div className="bg-[#0a0d14] border border-slate-800/80 overflow-hidden rounded-[14px] p-5 transition-all hover:border-slate-700 hover:shadow-[0_4px_24px_rgba(0,0,0,0.2)] duration-300 relative group">
      <div className="flex justify-between items-center mb-4 relative z-10 w-full">
         <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">{title}</h4>
         <Icon className={`w-5 h-5 ${color === 'cyan' ? 'text-cyan-500' : color === 'purple' ? 'text-purple-400' : color === 'green' ? 'text-emerald-500' : color === 'red' ? 'text-rose-500' : 'text-blue-400'}`} />
      </div>
      <div className="relative z-10 mb-6">
         <p className="text-4xl font-semibold text-white tracking-tight">{value}</p>
      </div>
      <div className="flex items-center gap-2 relative z-10">
         <span className={`w-1.5 h-1.5 rounded-full ${trendUp ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : color === 'red' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : color === 'purple' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`}></span>
         <span className={`text-[10px] font-bold uppercase tracking-widest ${trendUp ? 'text-cyan-500' : color === 'red' ? 'text-rose-500' : color === 'purple' ? 'text-purple-400' : 'text-emerald-500'}`}>
            {trend}
         </span>
      </div>
    </div>
  );
}

function ActivityItem({ user, action, amount, time, isSystem = false }: any) {
  return (
    <div className={`flex items-center justify-between p-3 rounded hover:bg-cyber-electric/5 transition-colors border border-transparent hover:border-cyber-electric/20 group ${isSystem ? 'bg-cyber-electric/5 border-cyber-neon/30' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold border ${isSystem ? 'bg-cyber-neon/20 text-cyber-neon border-cyber-neon/50' : 'bg-cyber-dark text-cyber-electric border-cyber-electric/30'}`}>
          {isSystem ? <Cpu className="w-4 h-4" /> : user.charAt(0)}
        </div>
        <div>
          <p className={`text-sm font-bold ${isSystem ? 'text-cyber-neon' : 'text-slate-200'}`}>{user}</p>
          <p className="text-[10px] text-cyber-electric/70 font-medium uppercase tracking-wider">{action}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-white flex items-center justify-end gap-1">
           {isSystem && <span className="text-cyber-matrix text-xs">✓</span>}
           {amount}
        </p>
        <p className="text-[10px] text-cyber-electric/50 font-mono">{time}</p>
      </div>
    </div>
  );
}
