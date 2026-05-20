'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Phone, Mail, RefreshCw, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { get, post } from '@/lib/api';

// ============================================================
// Local types (API shapes not in @heavenly/types yet)
// ============================================================
interface PhoneValidationResult {
  phone: string;
  valid: boolean;
  carrier?: string;
  lineType?: string;
  fraudScore?: number;
}

interface EmailValidationResult {
  email: string;
  valid: boolean;
  hasMx?: boolean;
  isDisposable?: boolean;
  fraudScore?: number;
}

interface PhoneHistoryItem {
  id: string;
  phone: string;
  valid: boolean;
  carrier?: string;
  lineType?: string;
  fraudScore?: number;
  createdAt: string;
}

interface EmailHistoryItem {
  id: string;
  email: string;
  valid: boolean;
  hasMx?: boolean;
  isDisposable?: boolean;
  fraudScore?: number;
  createdAt: string;
}

// ============================================================
// Helpers
// ============================================================
function FraudScoreBar({ score }: { score?: number }) {
  if (score === undefined || score === null) return <span className="text-gray-600 text-xs">—</span>;

  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct <= 30 ? 'bg-green-500' : pct <= 60 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor =
    pct <= 30 ? 'text-green-400' : pct <= 60 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-gray-700">
        <div className={clsx('h-2 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={clsx('text-xs font-medium', textColor)}>{pct}</span>
    </div>
  );
}

function ValidBadge({ valid }: { valid: boolean }) {
  return valid ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400 border border-green-500/30">
      <CheckCircle className="h-3 w-3" /> Válido
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400 border border-red-500/30">
      <XCircle className="h-3 w-3" /> Inválido
    </span>
  );
}

// ============================================================
// Phone Tab
// ============================================================
function PhoneTab() {
  const [phoneInput, setPhoneInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<PhoneValidationResult | null>(null);
  const [history, setHistory] = useState<PhoneHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await get<PhoneHistoryItem[]>('/phone-validation/history');
      setHistory(data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleValidate = async () => {
    const phone = phoneInput.trim();
    if (!phone) {
      toast.error('Ingresa un número de teléfono');
      return;
    }
    setIsValidating(true);
    setResult(null);
    try {
      const data = await post<PhoneValidationResult>('/phone-validation/validate', { phone });
      setResult(data);
      toast.success('Validación completada');
      loadHistory();
    } catch {
      toast.error('Error al validar el teléfono');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-300">Validar número de teléfono</h3>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="tel"
              placeholder="+52 55 1234 5678"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={handleValidate}
            disabled={isValidating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {isValidating ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : null}
            Validar
          </button>
        </div>
      </div>

      {/* Result card */}
      {result && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-900/10 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-indigo-400">Resultado</h3>
            <ValidBadge valid={result.valid} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Número</p>
              <p className="mt-0.5 font-mono text-sm text-gray-200">{result.phone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Operadora</p>
              <p className="mt-0.5 text-sm text-gray-200">{result.carrier ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tipo de línea</p>
              <p className="mt-0.5 text-sm text-gray-200">{result.lineType ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Score de fraude</p>
              <div className="mt-1">
                <FraudScoreBar score={result.fraudScore} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-300">Validaciones recientes</h3>
          <button
            type="button"
            onClick={loadHistory}
            disabled={isLoadingHistory}
            className="rounded p-1 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Refrescar"
          >
            <RefreshCw className={clsx('h-4 w-4', isLoadingHistory && 'animate-spin')} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Operadora</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Score fraude</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoadingHistory ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      Cargando...
                    </div>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <Phone className="mx-auto mb-2 h-7 w-7 text-gray-600" />
                    <p className="text-sm text-gray-500">Sin validaciones recientes</p>
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-200">{item.phone}</td>
                    <td className="px-4 py-3">
                      <ValidBadge valid={item.valid} />
                    </td>
                    <td className="px-4 py-3 text-gray-400">{item.carrier ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{item.lineType ?? '—'}</td>
                    <td className="px-4 py-3">
                      <FraudScoreBar score={item.fraudScore} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {format(new Date(item.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
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

// ============================================================
// Email Tab
// ============================================================
function EmailTab() {
  const [emailInput, setEmailInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<EmailValidationResult | null>(null);
  const [history, setHistory] = useState<EmailHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await get<EmailHistoryItem[]>('/email-validation/history');
      setHistory(data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleValidate = async () => {
    const email = emailInput.trim();
    if (!email) {
      toast.error('Ingresa un correo electrónico');
      return;
    }
    setIsValidating(true);
    setResult(null);
    try {
      const data = await post<EmailValidationResult>('/email-validation/validate', { email });
      setResult(data);
      toast.success('Validación completada');
      loadHistory();
    } catch {
      toast.error('Error al validar el correo');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-300">Validar correo electrónico</h3>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="email"
              placeholder="ejemplo@dominio.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={handleValidate}
            disabled={isValidating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {isValidating ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : null}
            Validar
          </button>
        </div>
      </div>

      {/* Result card */}
      {result && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-900/10 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-indigo-400">Resultado</h3>
            <ValidBadge valid={result.valid} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Correo</p>
              <p className="mt-0.5 font-mono text-sm text-gray-200 break-all">{result.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tiene MX</p>
              <p className="mt-0.5 text-sm text-gray-200">
                {result.hasMx === undefined ? '—' : result.hasMx ? 'Sí' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Desechable</p>
              <p className="mt-0.5 text-sm">
                {result.isDisposable === undefined ? (
                  <span className="text-gray-200">—</span>
                ) : result.isDisposable ? (
                  <span className="text-red-400">Sí</span>
                ) : (
                  <span className="text-green-400">No</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Score de fraude</p>
              <div className="mt-1">
                <FraudScoreBar score={result.fraudScore} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-300">Validaciones recientes</h3>
          <button
            type="button"
            onClick={loadHistory}
            disabled={isLoadingHistory}
            className="rounded p-1 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Refrescar"
          >
            <RefreshCw className={clsx('h-4 w-4', isLoadingHistory && 'animate-spin')} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Correo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">MX</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Desechable</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Score fraude</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoadingHistory ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      Cargando...
                    </div>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <Mail className="mx-auto mb-2 h-7 w-7 text-gray-600" />
                    <p className="text-sm text-gray-500">Sin validaciones recientes</p>
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-200 break-all">{item.email}</td>
                    <td className="px-4 py-3">
                      <ValidBadge valid={item.valid} />
                    </td>
                    <td className="px-4 py-3 text-gray-400">{item.hasMx === undefined ? '—' : item.hasMx ? 'Sí' : 'No'}</td>
                    <td className="px-4 py-3">
                      {item.isDisposable === undefined ? (
                        <span className="text-gray-400">—</span>
                      ) : item.isDisposable ? (
                        <span className="text-red-400 text-xs">Sí</span>
                      ) : (
                        <span className="text-green-400 text-xs">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <FraudScoreBar score={item.fraudScore} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {format(new Date(item.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
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

// ============================================================
// Validations Page
// ============================================================
type Tab = 'phone' | 'email';

export default function ValidationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('phone');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-900/50">
          <ShieldAlert className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Validaciones</h2>
          <p className="text-sm text-gray-400">Verifica teléfonos y correos en tiempo real</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('phone')}
          className={clsx(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'phone'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-gray-200',
          )}
        >
          <Phone className="h-4 w-4" />
          Teléfono
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={clsx(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'email'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-gray-200',
          )}
        >
          <Mail className="h-4 w-4" />
          Email
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'phone' ? <PhoneTab /> : <EmailTab />}
    </div>
  );
}
