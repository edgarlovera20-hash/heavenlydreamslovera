'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, X, RefreshCw, Info, AlertTriangle, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { get, post } from '@/lib/api';

// ============================================================
// Types
// ============================================================
type AnnouncementTipo = 'INFO' | 'URGENTE' | 'EVENTO';

interface Announcement {
  id: string;
  title: string;
  content: string;
  tipo: AnnouncementTipo;
  createdAt: string;
  authorNombre?: string;
}

// ============================================================
// Tipo badge
// ============================================================
const TIPO_STYLES: Record<AnnouncementTipo, { classes: string; icon: React.ReactNode; label: string }> = {
  INFO: {
    classes: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    icon: <Info className="h-3 w-3" />,
    label: 'Información',
  },
  URGENTE: {
    classes: 'bg-red-500/20 text-red-400 border border-red-500/30',
    icon: <AlertTriangle className="h-3 w-3" />,
    label: 'Urgente',
  },
  EVENTO: {
    classes: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    icon: <CalendarDays className="h-3 w-3" />,
    label: 'Evento',
  },
};

function TipoBadge({ tipo }: { tipo: AnnouncementTipo }) {
  const style = TIPO_STYLES[tipo] ?? TIPO_STYLES.INFO;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        style.classes,
      )}
    >
      {style.icon}
      {style.label}
    </span>
  );
}

// ============================================================
// New announcement form
// ============================================================
interface NewAnnouncementFormProps {
  onCreated: () => void;
  onCancel: () => void;
}

function NewAnnouncementForm({ onCreated, onCancel }: NewAnnouncementFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tipo, setTipo] = useState<AnnouncementTipo>('INFO');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('El título y el contenido son requeridos');
      return;
    }
    setIsSaving(true);
    try {
      await post('/announcements', { title: title.trim(), content: content.trim(), tipo });
      toast.success('Anuncio publicado');
      onCreated();
    } catch {
      toast.error('Error al publicar el anuncio');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-900/10 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-indigo-400">Nuevo anuncio</h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del anuncio"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as AnnouncementTipo)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="INFO">Información</option>
            <option value="URGENTE">Urgente</option>
            <option value="EVENTO">Evento</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Contenido</label>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribe el contenido del anuncio..."
            className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {isSaving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : null}
            Publicar
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// Announcements Page
// ============================================================
export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // Derive canCreate from role stored in localStorage (SUPER_ADMIN or GERENTE)
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('hd_auth');
        if (stored) {
          const parsed = JSON.parse(stored) as { state?: { user?: { role?: string } } };
          const role = parsed?.state?.user?.role ?? '';
          setCanCreate(role === 'SUPER_ADMIN' || role === 'GERENTE');
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await get<Announcement[]>('/announcements');
      setAnnouncements(data ?? []);
    } catch {
      // 404 or endpoint not yet implemented — show empty state gracefully
      setAnnouncements([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleCreated = () => {
    setShowForm(false);
    loadAnnouncements();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-900/50">
            <Megaphone className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Anuncios</h2>
            <p className="text-sm text-gray-400">Comunicados internos del equipo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAnnouncements}
            disabled={isLoading}
            className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 transition-colors"
            aria-label="Refrescar"
          >
            <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
          {canCreate && !showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nuevo Anuncio
            </button>
          )}
        </div>
      </div>

      {/* New announcement form */}
      {showForm && (
        <NewAnnouncementForm
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-2 text-gray-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Cargando anuncios...
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && announcements.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900 py-20">
          <Megaphone className="mb-3 h-12 w-12 text-gray-700" />
          <p className="text-base font-medium text-gray-400">No hay anuncios disponibles</p>
          <p className="mt-1 text-sm text-gray-600">
            {canCreate
              ? 'Crea el primer anuncio usando el botón "Nuevo Anuncio".'
              : 'Los comunicados del equipo aparecerán aquí cuando sean publicados.'}
          </p>
        </div>
      )}

      {/* Announcements grid */}
      {!isLoading && announcements.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {announcements.map((item) => (
            <div
              key={item.id}
              className="flex flex-col rounded-xl border border-gray-800 bg-gray-800 p-5 transition-colors hover:border-gray-700"
            >
              {/* Top row: tipo badge + date */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <TipoBadge tipo={item.tipo} />
                <span className="text-xs text-gray-500 shrink-0">
                  {format(new Date(item.createdAt), 'dd MMM yyyy', { locale: es })}
                </span>
              </div>

              {/* Title */}
              <h3 className="mb-2 text-sm font-semibold text-white leading-snug">
                {item.title}
              </h3>

              {/* Content — clamped to 3 lines */}
              <p className="flex-1 text-xs leading-relaxed text-gray-400 line-clamp-3">
                {item.content}
              </p>

              {/* Author */}
              {item.authorNombre && (
                <p className="mt-3 border-t border-gray-700 pt-3 text-xs text-gray-600">
                  Por <span className="text-gray-400">{item.authorNombre}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
