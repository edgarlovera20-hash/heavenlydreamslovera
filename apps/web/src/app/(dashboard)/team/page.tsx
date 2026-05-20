'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  MapPin,
  Briefcase,
  X,
  Mail,
  UserPlus,
  Loader2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { StatsCard } from '@/components/ui/StatsCard';
import { get, post } from '@/lib/api';
import type { User, PaginatedResponse } from '@heavenly/types';
import { Role } from '@heavenly/types';
import { ROLE_LABELS } from '@heavenly/shared';

// ============================================================
// Role badge colors
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
// Avatar initials helper
// ============================================================
function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ============================================================
// Avatar background colors (based on role for visual variety)
// ============================================================
const AVATAR_BG: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'bg-red-700',
  [Role.GERENTE]: 'bg-orange-700',
  [Role.ADMINISTRACION]: 'bg-yellow-700',
  [Role.SUPERVISOR]: 'bg-blue-700',
  [Role.PROMOTOR]: 'bg-green-700',
  [Role.COBRANZA]: 'bg-purple-700',
  [Role.SOPORTE]: 'bg-gray-700',
};

// ============================================================
// Member card
// ============================================================
function MemberCard({ user }: { user: User }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-gray-800 bg-gray-900 p-5 text-center hover:border-gray-700 transition-colors">
      {/* Avatar */}
      <div
        className={clsx(
          'flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white shadow-md mb-3',
          AVATAR_BG[user.role],
        )}
      >
        {getInitials(user.nombre)}
      </div>

      {/* Name */}
      <p className="font-semibold text-gray-100 leading-tight">{user.nombre}</p>
      <p className="text-xs text-indigo-400 mt-0.5">@{user.username}</p>

      {/* Role badge */}
      <span
        className={clsx(
          'mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          ROLE_COLORS[user.role],
        )}
      >
        {ROLE_LABELS[user.role]}
      </span>

      {/* Details */}
      <div className="mt-3 w-full space-y-1.5 border-t border-gray-800 pt-3">
        {user.puesto && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Briefcase className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
            <span className="truncate">{user.puesto}</span>
          </div>
        )}
        {user.zona && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
            <span className="truncate">{user.zona}</span>
          </div>
        )}
        {user.email && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
            <span className="truncate">{user.email}</span>
          </div>
        )}
      </div>

      {/* Active indicator */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        <span
          className={clsx(
            'h-2 w-2 rounded-full',
            user.active ? 'bg-green-400' : 'bg-gray-600',
          )}
        />
        <span className={clsx('text-xs', user.active ? 'text-green-400' : 'text-gray-500')}>
          {user.active ? 'Activo' : 'Inactivo'}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Invite modal
// ============================================================
interface InviteModalProps {
  onClose: () => void;
}

function InviteModal({ onClose }: InviteModalProps) {
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    username: '',
    role: Role.PROMOTOR,
    zona: '',
    puesto: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.email || !form.username) {
      toast.error('Nombre, email y username son obligatorios');
      return;
    }
    setIsSaving(true);
    try {
      await post('/users', form);
      toast.success(`Usuario ${form.nombre} creado exitosamente`);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al crear usuario';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-900/50 text-indigo-400">
              <UserPlus className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-white">Invitar miembro</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Nombre completo</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => handleChange('nombre', e.target.value)}
              placeholder="Juan Perez Lopez"
              className={inputCls}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="juan@empresa.com"
              className={inputCls}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder="juan.perez"
                className={clsx(inputCls, 'pl-7')}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Rol</label>
            <select
              value={form.role}
              onChange={(e) => handleChange('role', e.target.value as Role)}
              className={inputCls}
            >
              {Object.values(Role).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Zona</label>
              <input
                type="text"
                value={form.zona}
                onChange={(e) => handleChange('zona', e.target.value)}
                placeholder="Norte"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Puesto</label>
              <input
                type="text"
                value={form.puesto}
                onChange={(e) => handleChange('puesto', e.target.value)}
                placeholder="Promotor de ventas"
                className={inputCls}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Se enviara un correo al usuario con sus credenciales de acceso.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {isSaving ? 'Creando...' : 'Invitar miembro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Team Page
// ============================================================
export default function TeamPage() {
  const [members, setMembers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [zonaFilter, setZonaFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (search) params.search = search;
      if (zonaFilter) params.zona = zonaFilter;

      const response = await get<PaginatedResponse<User>>('/users', params);
      setMembers(response.data);
      setTotal(response.total);
    } catch {
      toast.error('Error al cargar el equipo');
    } finally {
      setIsLoading(false);
    }
  }, [search, zonaFilter]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const activeCount = members.filter((m) => m.active).length;

  // Get unique zones for filter dropdown
  const zones = Array.from(
    new Set(members.map((m) => m.zona).filter(Boolean) as string[]),
  ).sort();

  const handleModalClose = () => {
    setShowModal(false);
    loadMembers();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Equipo</h2>
          <p className="text-sm text-gray-400 mt-1">
            Vista de miembros del equipo por zona y rol
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Invitar miembro
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatsCard title="Total miembros" value={total} icon={Users} variant="info" />
        <StatsCard title="Activos" value={activeCount} icon={Users} variant="success" />
        <StatsCard title="Zonas" value={zones.length} icon={MapPin} variant="purple" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Zone filter */}
        <select
          value={zonaFilter}
          onChange={(e) => setZonaFilter(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todas las zonas</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>

        {/* Refresh */}
        <button
          type="button"
          onClick={loadMembers}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-2 text-gray-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Cargando equipo...
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 py-16 text-center text-gray-500">
          No se encontraron miembros del equipo
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {members.map((member) => (
            <MemberCard key={member.id} user={member} />
          ))}
        </div>
      )}

      {/* Invite modal */}
      {showModal && <InviteModal onClose={handleModalClose} />}
    </div>
  );
}
