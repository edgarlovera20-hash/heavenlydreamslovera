'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Send, RefreshCw, QrCode, Wifi, WifiOff, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { useForm } from 'react-hook-form';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { get, post } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { WhatsAppSession } from '@heavenly/types';
import { WhatsAppSessionStatus } from '@heavenly/types';

// ============================================================
// Message form data
// ============================================================
interface SendMessageForm {
  sessionId: string;
  phone: string;
  message: string;
}

// ============================================================
// WhatsApp Page
// ============================================================
export default function WhatsAppPage() {
  const { isGerente } = useAuth();
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<WhatsAppSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [recentMessages, setRecentMessages] = useState<
    { id: string; phone: string; message: string; direction: 'IN' | 'OUT'; createdAt: string }[]
  >([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SendMessageForm>();

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await get<WhatsAppSession[]>('/whatsapp/sessions');
      setSessions(data ?? []);
    } catch (error) {
      toast.error('Error al cargar sesiones');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [loadSessions]);

  const handleSendMessage = async (data: SendMessageForm) => {
    if (!selectedSession) {
      toast.error('Selecciona una sesion activa');
      return;
    }
    setIsSending(true);
    try {
      await post('/whatsapp/send', {
        sessionId: selectedSession.id,
        to: data.phone,
        message: data.message,
      });
      toast.success('Mensaje enviado');
      reset({ phone: '', message: '', sessionId: selectedSession.id });
      // Optimistically add to recent
      setRecentMessages((prev) => [
        {
          id: Date.now().toString(),
          phone: data.phone,
          message: data.message,
          direction: 'OUT',
          createdAt: new Date().toISOString(),
        },
        ...prev.slice(0, 19),
      ]);
    } catch (error) {
      toast.error('Error al enviar mensaje');
    } finally {
      setIsSending(false);
    }
  };

  const getStatusIcon = (status: WhatsAppSessionStatus) => {
    switch (status) {
      case WhatsAppSessionStatus.CONNECTED:
        return <Wifi className="h-4 w-4 text-green-400" />;
      case WhatsAppSessionStatus.QR_READY:
        return <QrCode className="h-4 w-4 text-yellow-400" />;
      default:
        return <WifiOff className="h-4 w-4 text-red-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">WhatsApp</h2>
          <p className="text-sm text-gray-400 mt-1">Gestion de sesiones y mensajeria</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSessions}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
            Actualizar
          </button>
          {isGerente && (
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva Sesion
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Session Cards */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Sesiones ({sessions.length})
          </h3>

          {isLoading && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-500">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">No hay sesiones configuradas</p>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSession(session)}
                className={clsx(
                  'w-full rounded-xl border p-4 text-left transition-all',
                  selectedSession?.id === session.id
                    ? 'border-green-500/50 bg-green-900/20'
                    : 'border-gray-800 bg-gray-900 hover:border-gray-700',
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(session.status)}
                    <span className="font-medium text-white text-sm">{session.name}</span>
                  </div>
                  <StatusBadge status={session.status} type="whatsapp" />
                </div>

                {session.phoneNumber && (
                  <p className="text-xs text-gray-500">{session.phoneNumber}</p>
                )}
                <p className="text-xs text-gray-600 mt-1">{session.purpose}</p>

                {/* QR Code display */}
                {session.status === WhatsAppSessionStatus.QR_READY && session.qrCode && (
                  <div className="mt-3 rounded-lg bg-white p-2 flex items-center justify-center">
                    {/* In production, render actual QR image */}
                    <div className="text-center">
                      <QrCode className="h-16 w-16 text-gray-900 mx-auto" />
                      <p className="text-xs text-gray-600 mt-1">Escanea el QR</p>
                    </div>
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Send Message + Recent Messages */}
        <div className="lg:col-span-2 space-y-4">
          {/* Send message form */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="mb-4 text-base font-semibold text-white">Enviar Mensaje</h3>

            <form onSubmit={handleSubmit(handleSendMessage)} className="space-y-4">
              {/* Session select */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Sesion
                </label>
                <select
                  {...register('sessionId', { required: true })}
                  onChange={(e) => {
                    const s = sessions.find((s) => s.id === e.target.value);
                    setSelectedSession(s ?? null);
                  }}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
                >
                  <option value="">Selecciona una sesion...</option>
                  {sessions
                    .filter((s) => s.status === WhatsAppSessionStatus.CONNECTED)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.phoneNumber ? `(${s.phoneNumber})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Telefono destino
                </label>
                <input
                  type="tel"
                  placeholder="5512345678"
                  {...register('phone', {
                    required: 'El telefono es requerido',
                    pattern: { value: /^\d{10,12}$/, message: 'Telefono invalido (10-12 digitos)' },
                  })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                />
                {errors.phone && (
                  <p className="mt-1 text-xs text-red-400">{errors.phone.message}</p>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Mensaje
                </label>
                <textarea
                  rows={3}
                  placeholder="Escribe tu mensaje aqui..."
                  {...register('message', { required: 'El mensaje es requerido' })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none resize-none"
                />
                {errors.message && (
                  <p className="mt-1 text-xs text-red-400">{errors.message.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 transition-colors disabled:opacity-60"
              >
                {isSending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar Mensaje
              </button>
            </form>
          </div>

          {/* Recent messages */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="mb-4 text-base font-semibold text-white">Mensajes Recientes</h3>

            {recentMessages.length === 0 ? (
              <p className="text-sm text-gray-500">No hay mensajes recientes</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {recentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={clsx(
                      'flex flex-col rounded-lg p-3',
                      msg.direction === 'OUT'
                        ? 'bg-green-900/20 border border-green-800/30 items-end'
                        : 'bg-gray-800/50 border border-gray-700',
                    )}
                  >
                    <p className="text-sm text-gray-300">{msg.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{msg.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
