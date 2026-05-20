'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RefreshCw, Bot, X } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { get, post, del } from '@/lib/api';

// ============================================================
// Types
// ============================================================
type TelegramSessionStatus = 'ACTIVE' | 'INACTIVE';
type TelegramPurpose = 'CAPTACION' | 'SOPORTE' | 'COMUNIDAD';

interface TelegramSession {
  id: string;
  botName: string;
  purpose: TelegramPurpose;
  status: TelegramSessionStatus;
  createdAt: string;
}

interface NewSessionForm {
  botName: string;
  botToken: string;
  purpose: TelegramPurpose;
}

const PURPOSE_LABELS: Record<TelegramPurpose, string> = {
  CAPTACION: 'Captación',
  SOPORTE: 'Soporte',
  COMUNIDAD: 'Comunidad',
};

const PURPOSE_COLORS: Record<TelegramPurpose, string> = {
  CAPTACION: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  SOPORTE: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  COMUNIDAD: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
};

// ============================================================
// Telegram Page
// ============================================================
export default function TelegramPage() {
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewSessionForm>({
    botName: '',
    botToken: '',
    purpose: 'CAPTACION',
  });

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await get<TelegramSession[]>('/telegram/sessions');
      setSessions(data ?? []);
    } catch {
      toast.error('Error al cargar sesiones de Telegram');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await del(`/telegram/sessions/${id}`);
      toast.success('Sesión eliminada correctamente');
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error('Error al eliminar la sesión');
    } finally {
      setDeletingId(null);
    }
  };

  const handleFormChange = (key: keyof NewSessionForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.botName.trim() || !form.botToken.trim()) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await post<TelegramSession>('/telegram/sessions', form);
      toast.success('Sesión creada correctamente');
      setSessions((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ botName: '', botToken: '', purpose: 'CAPTACION' });
    } catch {
      toast.error('Error al crear la sesión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCount = sessions.filter((s) => s.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Sesiones de Telegram</h2>
          <p className="text-sm text-gray-400 mt-1">
            Gestión de bots y sesiones de Telegram
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSessions}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancelar' : 'Nueva Sesión'}
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Total Sesiones</p>
          <p className="mt-1 text-2xl font-bold text-white">{sessions.length}</p>
        </div>
        <div className="rounded-xl border border-green-800/50 bg-green-900/10 p-4">
          <p className="text-sm text-gray-400">Activas</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Inactivas</p>
          <p className="mt-1 text-2xl font-bold text-gray-400">{sessions.length - activeCount}</p>
        </div>
      </div>

      {/* Inline new session form */}
      {showForm && (
        <div className="rounded-xl border border-indigo-800/50 bg-indigo-900/10 p-6">
          <h3 className="text-base font-semibold text-white mb-4">Nueva Sesión de Bot</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Nombre del Bot <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.botName}
                onChange={(e) => handleFormChange('botName', e.target.value)}
                placeholder="Ej: HeavenlyBot"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Bot Token <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.botToken}
                onChange={(e) => handleFormChange('botToken', e.target.value)}
                placeholder="123456:ABC-..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Propósito
              </label>
              <select
                value={form.purpose}
                onChange={(e) => handleFormChange('purpose', e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="CAPTACION">Captación</option>
                <option value="SOPORTE">Soporte</option>
                <option value="COMUNIDAD">Comunidad</option>
              </select>
            </div>
            <div className="sm:col-span-3 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {isSubmitting && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                Crear Sesión
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Bot
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Propósito
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Creado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      Cargando...
                    </div>
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Bot className="h-8 w-8 text-gray-600" />
                      <p>No hay sesiones de Telegram configuradas</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900/30 border border-blue-800/50">
                          <Bot className="h-4 w-4 text-blue-400" />
                        </div>
                        <span className="font-medium text-gray-200">{session.botName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          PURPOSE_COLORS[session.purpose],
                        )}
                      >
                        {PURPOSE_LABELS[session.purpose]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                          session.status === 'ACTIVE'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
                        )}
                      >
                        <span
                          className={clsx(
                            'h-1.5 w-1.5 rounded-full',
                            session.status === 'ACTIVE' ? 'bg-green-400' : 'bg-gray-400',
                          )}
                        />
                        {session.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(session.createdAt).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(session.id)}
                        disabled={deletingId === session.id}
                        className="flex items-center gap-1.5 rounded-lg border border-red-800/50 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/40 disabled:opacity-50 transition-colors"
                      >
                        {deletingId === session.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Desactivar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
