'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  MessageCircle,
  Send,
  CreditCard,
  Bot,
  Brain,
  CheckSquare,
  BarChart3,
  Settings,
  UserCog,
  Building2,
  ChevronRight,
  MapPin,
  DollarSign,
  FileText,
  Puzzle,
  Megaphone,
  GitBranch,
  Calculator,
  Trophy,
  Map,
  UserSquare,
  Wallet,
  UsersRound,
  ShieldCheck,
  Database,
  Package,
} from 'lucide-react';
import { Role } from '@heavenly/types';
import { useAuth } from '@/hooks/useAuth';

// ============================================================
// Navigation item definition
// ============================================================
interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Ventas',
    href: '/sales',
    icon: ShoppingCart,
  },
  {
    label: 'Clientes',
    href: '/customers',
    icon: Users,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.ADMINISTRACION, Role.SUPERVISOR],
  },
  {
    label: 'WhatsApp',
    href: '/whatsapp',
    icon: MessageCircle,
    roles: [Role.SUPER_ADMIN, Role.GERENTE],
  },
  {
    label: 'Telegram',
    href: '/telegram',
    icon: Send,
    roles: [Role.SUPER_ADMIN, Role.GERENTE],
  },
  {
    label: 'Cobranza',
    href: '/cobranza',
    icon: CreditCard,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.COBRANZA],
  },
  {
    label: 'Automatizaciones',
    href: '/automations',
    icon: Bot,
    roles: [Role.SUPER_ADMIN, Role.GERENTE],
  },
  {
    label: 'IA Assistant',
    href: '/ia',
    icon: Brain,
  },
  {
    label: 'Validaciones',
    href: '/validations',
    icon: CheckSquare,
    roles: [Role.SUPER_ADMIN, Role.GERENTE],
  },
  {
    label: 'Solicitudes val.',
    href: '/validations/requests',
    icon: CheckSquare,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.ADMINISTRACION],
  },
  {
    label: 'Reportes',
    href: '/reports',
    icon: BarChart3,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.ADMINISTRACION, Role.SUPERVISOR],
  },
  {
    label: 'Configuración',
    href: '/settings',
    icon: Settings,
    roles: [Role.SUPER_ADMIN, Role.GERENTE],
  },
  {
    label: 'Usuarios',
    href: '/users',
    icon: UserCog,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.ADMINISTRACION],
  },
  {
    label: 'Empresas',
    href: '/companies',
    icon: Building2,
    roles: [Role.SUPER_ADMIN],
  },
  {
    label: 'Territorios',
    href: '/territories',
    icon: MapPin,
    roles: [Role.SUPER_ADMIN, Role.GERENTE],
  },
  {
    label: 'Comisiones',
    href: '/commissions',
    icon: DollarSign,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.ADMINISTRACION],
  },
  {
    label: 'Nómina',
    href: '/payroll',
    icon: Wallet,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.ADMINISTRACION],
  },
  {
    label: 'Scripts',
    href: '/scripts',
    icon: FileText,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.SUPERVISOR, Role.PROMOTOR],
  },
  {
    label: 'Cotizador',
    href: '/quote',
    icon: Calculator,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.SUPERVISOR, Role.PROMOTOR],
  },
  {
    label: 'Anuncios',
    href: '/announcements',
    icon: Megaphone,
  },
  {
    label: 'Referidos',
    href: '/referrals',
    icon: GitBranch,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.SUPERVISOR],
  },
  {
    label: 'SIAC',
    href: '/siac',
    icon: Map,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.ADMINISTRACION],
  },
  {
    label: 'Integraciones',
    href: '/integrations',
    icon: Puzzle,
    roles: [Role.SUPER_ADMIN, Role.GERENTE],
  },
  {
    label: 'Logros',
    href: '/game',
    icon: Trophy,
  },
  {
    label: 'Gerente',
    href: '/manager',
    icon: UserSquare,
    roles: [Role.SUPER_ADMIN, Role.GERENTE],
  },
  {
    label: 'Mi Perfil',
    href: '/profile',
    icon: UserCog,
  },
  {
    label: 'Zonas',
    href: '/zones',
    icon: MapPin,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.SUPERVISOR],
  },
  {
    label: 'Contratos',
    href: '/contracts',
    icon: FileText,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.ADMINISTRACION, Role.SUPERVISOR],
  },
  {
    label: 'Catálogo',
    href: '/packages',
    icon: Package,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.ADMINISTRACION],
  },
  {
    label: 'Equipo',
    href: '/team',
    icon: UsersRound,
    roles: [Role.SUPER_ADMIN, Role.GERENTE, Role.SUPERVISOR],
  },
  {
    label: 'Auditoría',
    href: '/audit',
    icon: ShieldCheck,
    roles: [Role.SUPER_ADMIN, Role.GERENTE],
  },
  {
    label: 'Gestor de Datos',
    href: '/data',
    icon: Database,
    roles: [Role.SUPER_ADMIN, Role.GERENTE],
  },
];

// ============================================================
// Sidebar component
// ============================================================
export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-full w-64 flex-col bg-gray-900 border-r border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
          <span className="text-sm font-bold text-white">HD</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">HEAVENLY</p>
          <p className="text-xs text-gray-400">DREAMS</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white',
              )}
            >
              <Icon className={clsx('h-5 w-5 shrink-0', isActive ? 'text-indigo-400' : '')} />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="h-4 w-4 text-indigo-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info at bottom */}
      {user && (
        <div className="border-t border-gray-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              {user.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.nombre}</p>
              <p className="text-xs text-gray-500 truncate">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
