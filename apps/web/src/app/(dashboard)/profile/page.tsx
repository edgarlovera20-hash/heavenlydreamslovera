'use client';

import React, { useState } from 'react';
import {
  User,
  Mail,
  AtSign,
  MapPin,
  Briefcase,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { post } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@heavenly/shared';
import { Role } from '@heavenly/types';

// ============================================================
// Role badge colors (same as users page)
// ============================================================
const ROLE_COLORS: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'bg-red-500/20 text-red-400 border border-red-500/30',
  [Role.GERENTE]: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  [Role.ADMINISTRACION]: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  [Role.SUPERVISOR]: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  [Role.PROMOTOR]: 'bg-green-500/20 text-green-400 border border-green-500/30',
  [Role.COBRANZA]: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  [Role.SOPORTE]: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

// ============================================================
// Detail row
// ============================================================
function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-800 text-gray-400">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-gray-200">{value}</div>
      </div>
    </div>
  );
}

// ============================================================
// Change password form
// ============================================================
interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

function ChangePasswordForm() {
  const [form, setForm] = useState<ChangePasswordPayload & { confirmPassword: string }>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleShow = (key: keyof typeof show) => {
    setShow((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.newPassword.length < 8) {
      toast.error('La nueva contrasena debe tener al menos 8 caracteres');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Las contrasenas no coinciden');
      return;
    }

    setIsSaving(true);
    try {
      await post('/users/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Contrasena actualizada correctamente');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al cambiar contrasena';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-10';

  const fields = [
    { key: 'currentPassword' as const, label: 'Contrasena actual', showKey: 'current' as const },
    { key: 'newPassword' as const, label: 'Nueva contrasena', showKey: 'new' as const },
    { key: 'confirmPassword' as const, label: 'Confirmar nueva contrasena', showKey: 'confirm' as const },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map(({ key, label, showKey }) => (
        <div key={key} className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-300">{label}</label>
          <div className="relative">
            <input
              type={show[showKey] ? 'text' : 'password'}
              value={form[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className={inputCls}
              required
              autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              onClick={() => toggleShow(showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              tabIndex={-1}
              aria-label={show[showKey] ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            >
              {show[showKey] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ))}

      <p className="text-xs text-gray-500">
        Minimo 8 caracteres. Se recomienda incluir letras, numeros y simbolos.
      </p>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? 'Actualizando...' : 'Cambiar contrasena'}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// Profile Page
// ============================================================
export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="py-24 text-center text-gray-500">
        No se encontro informacion de usuario
      </div>
    );
  }

  // Avatar initials
  const initials = user.nombre
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Mi Perfil</h2>
        <p className="text-sm text-gray-400 mt-1">
          Informacion de tu cuenta y configuracion de seguridad
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-4 pb-5 border-b border-gray-800">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600 text-2xl font-bold text-white shadow-lg shadow-indigo-900/50">
                {initials}
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">{user.nombre}</p>
                <p className="text-sm text-gray-400">@{user.username}</p>
                {user.role && (
                  <span
                    className={clsx(
                      'mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      ROLE_COLORS[user.role],
                    )}
                  >
                    {ROLE_LABELS[user.role]}
                  </span>
                )}
              </div>
            </div>

            {/* Detail rows */}
            <div className="pt-2">
              <DetailRow icon={Mail} label="Email" value={user.email} />
              <DetailRow icon={AtSign} label="Username" value={`@${user.username}`} />
              <DetailRow
                icon={Shield}
                label="Rol"
                value={
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      ROLE_COLORS[user.role],
                    )}
                  >
                    {ROLE_LABELS[user.role]}
                  </span>
                }
              />
              <DetailRow icon={MapPin} label="Zona" value={user.zona ?? '—'} />
              <DetailRow icon={Briefcase} label="Puesto" value={user.puesto ?? '—'} />
              <DetailRow
                icon={User}
                label="Estado"
                value={
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1.5 text-xs font-medium',
                      user.active ? 'text-green-400' : 'text-red-400',
                    )}
                  >
                    <span
                      className={clsx(
                        'h-1.5 w-1.5 rounded-full',
                        user.active ? 'bg-green-400' : 'bg-red-400',
                      )}
                    />
                    {user.active ? 'Activo' : 'Inactivo'}
                  </span>
                }
              />
            </div>
          </div>
        </div>

        {/* Change password card */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <div className="mb-5 flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-900/50 text-indigo-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Cambiar contrasena</h3>
                <p className="text-xs text-gray-500">
                  Actualiza tu contrasena para mantener tu cuenta segura
                </p>
              </div>
            </div>
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
