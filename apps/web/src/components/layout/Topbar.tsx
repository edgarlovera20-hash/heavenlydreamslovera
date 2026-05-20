'use client';

import React from 'react';
import { Bell, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@heavenly/shared';

// ============================================================
// Topbar component
// ============================================================
interface TopbarProps {
  title?: string;
}

export function Topbar({ title = 'Dashboard' }: TopbarProps) {
  const { user, logout } = useAuth();

  const initials = user?.nombre
    ? user.nombre
        .split(' ')
        .slice(0, 2)
        .map((n) => n.charAt(0))
        .join('')
        .toUpperCase()
    : '?';

  const roleLabel = user?.role ? ROLE_LABELS[user.role] : '';

  return (
    <header className="fixed right-0 top-0 z-20 flex h-16 w-[calc(100%-16rem)] items-center justify-between border-b border-gray-800 bg-gray-950/80 px-6 backdrop-blur-sm">
      {/* Page title */}
      <div>
        <h1 className="text-base font-semibold text-white">{title}</h1>
        <p className="text-xs text-gray-500">Heavenly Dreams Enterprise</p>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-500" />
        </button>

        {/* User info */}
        <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2">
          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            {initials}
          </div>

          {/* Name + role */}
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-white leading-tight">
              {user?.nombre ?? 'Usuario'}
            </p>
            {roleLabel && (
              <span
                className={clsx(
                  'inline-block text-xs font-medium px-1.5 py-0.5 rounded',
                  'bg-indigo-600/20 text-indigo-400',
                )}
              >
                {roleLabel}
              </span>
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

export default Topbar;
