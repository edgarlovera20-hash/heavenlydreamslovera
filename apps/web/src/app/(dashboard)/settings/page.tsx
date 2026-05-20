'use client';

import React, { useState } from 'react';
import { Building2, Shield, Bell, Save, Loader2, Globe, Image, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';

// ============================================================
// Tab definitions
// ============================================================
type Tab = 'empresa' | 'seguridad' | 'notificaciones';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'empresa', label: 'Perfil de empresa', icon: Building2 },
  { id: 'seguridad', label: 'Seguridad', icon: Shield },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
];

// ============================================================
// Field wrapper
// ============================================================
function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

// ============================================================
// Empresa tab
// ============================================================
function EmpresaTab() {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    rfc: '',
    logoUrl: '',
    website: '',
    emailContacto: '',
    telefono: '',
    direccion: '',
  });

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Simulated save — in production: await patch('/companies/:id', form)
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Configuracion de empresa guardada');
    } catch {
      toast.error('Error al guardar configuracion');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField label="Nombre de la empresa">
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => handleChange('nombre', e.target.value)}
            placeholder="Heavenly Dreams S.A. de C.V."
            className={inputCls}
          />
        </FormField>

        <FormField label="RFC">
          <input
            type="text"
            value={form.rfc}
            onChange={(e) => handleChange('rfc', e.target.value)}
            placeholder="HDR000101ABC"
            className={inputCls}
          />
        </FormField>

        <FormField
          label="URL del logotipo"
          hint="URL publica de la imagen (PNG o SVG recomendado)"
        >
          <div className="relative">
            <Image className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="url"
              value={form.logoUrl}
              onChange={(e) => handleChange('logoUrl', e.target.value)}
              placeholder="https://cdn.empresa.com/logo.png"
              className={clsx(inputCls, 'pl-9')}
            />
          </div>
        </FormField>

        <FormField label="Sitio web">
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="url"
              value={form.website}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="https://www.empresa.com"
              className={clsx(inputCls, 'pl-9')}
            />
          </div>
        </FormField>

        <FormField label="Email de contacto">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="email"
              value={form.emailContacto}
              onChange={(e) => handleChange('emailContacto', e.target.value)}
              placeholder="contacto@empresa.com"
              className={clsx(inputCls, 'pl-9')}
            />
          </div>
        </FormField>

        <FormField label="Telefono">
          <input
            type="tel"
            value={form.telefono}
            onChange={(e) => handleChange('telefono', e.target.value)}
            placeholder="800-000-0000"
            className={inputCls}
          />
        </FormField>

        <FormField label="Direccion fiscal" hint="Solo para facturacion interna">
          <input
            type="text"
            value={form.direccion}
            onChange={(e) => handleChange('direccion', e.target.value)}
            placeholder="Calle, Colonia, Ciudad, CP"
            className={clsx(inputCls, 'sm:col-span-2')}
          />
        </FormField>
      </div>

      <div className="flex justify-end pt-2">
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
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// Seguridad tab
// ============================================================
function SeguridadTab() {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    sessionTimeout: '60',
    mfaEnabled: false,
    ipWhitelist: '',
    maxLoginAttempts: '5',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Configuracion de seguridad guardada');
    } catch {
      toast.error('Error al guardar configuracion');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Session config */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Lock className="h-4 w-4 text-indigo-400" />
          Sesion y acceso
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Tiempo de sesion (minutos)"
            hint="Cierra sesion automaticamente despues del periodo de inactividad"
          >
            <input
              type="number"
              min="5"
              max="480"
              value={form.sessionTimeout}
              onChange={(e) => setForm((p) => ({ ...p, sessionTimeout: e.target.value }))}
              className={inputCls}
            />
          </FormField>

          <FormField
            label="Max intentos de login"
            hint="La cuenta se bloquea temporalmente al superar el limite"
          >
            <input
              type="number"
              min="3"
              max="10"
              value={form.maxLoginAttempts}
              onChange={(e) => setForm((p) => ({ ...p, maxLoginAttempts: e.target.value }))}
              className={inputCls}
            />
          </FormField>

          <FormField
            label="IPs permitidas"
            hint="Separadas por coma. Dejar vacio para permitir todas"
          >
            <input
              type="text"
              value={form.ipWhitelist}
              onChange={(e) => setForm((p) => ({ ...p, ipWhitelist: e.target.value }))}
              placeholder="192.168.1.1, 10.0.0.0/24"
              className={inputCls}
            />
          </FormField>
        </div>

        {/* MFA toggle */}
        <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-200">
              Autenticacion de dos factores (2FA)
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Requiere codigo adicional al iniciar sesion
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, mfaEnabled: !p.mfaEnabled }))}
            className={clsx(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
              form.mfaEnabled ? 'bg-indigo-600' : 'bg-gray-600',
            )}
            role="switch"
            aria-checked={form.mfaEnabled}
          >
            <span
              className={clsx(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                form.mfaEnabled ? 'translate-x-6' : 'translate-x-1',
              )}
            />
          </button>
        </div>
      </div>

      {/* Password info */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-5">
        <p className="text-sm text-gray-400">
          Para cambiar tu contrasena personal, ve a la pagina de{' '}
          <a href="/profile" className="text-indigo-400 hover:text-indigo-300 underline">
            Perfil
          </a>
          .
        </p>
      </div>

      <div className="flex justify-end pt-2">
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
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// Notificaciones tab
// ============================================================
interface NotifSetting {
  key: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
}

function NotificacionesTab() {
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<NotifSetting[]>([
    {
      key: 'nueva_venta',
      label: 'Nueva venta registrada',
      description: 'Cuando un promotor registra una venta nueva',
      email: true,
      push: true,
    },
    {
      key: 'venta_aprobada',
      label: 'Venta aprobada',
      description: 'Cuando una venta pasa a estado APROBADA',
      email: true,
      push: false,
    },
    {
      key: 'venta_rechazada',
      label: 'Venta rechazada',
      description: 'Cuando una venta es rechazada',
      email: false,
      push: true,
    },
    {
      key: 'fraude_detectado',
      label: 'Riesgo de fraude alto',
      description: 'Cuando el score de fraude supera el umbral critico',
      email: true,
      push: true,
    },
    {
      key: 'nuevo_usuario',
      label: 'Nuevo usuario creado',
      description: 'Cuando se agrega un usuario al sistema',
      email: true,
      push: false,
    },
    {
      key: 'whatsapp_desconectado',
      label: 'WhatsApp desconectado',
      description: 'Cuando una sesion de WhatsApp pierde conexion',
      email: false,
      push: true,
    },
  ]);

  const toggle = (key: string, channel: 'email' | 'push') => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, [channel]: !s[channel] } : s)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Preferencias de notificacion guardadas');
    } catch {
      toast.error('Error al guardar preferencias');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Evento
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 w-24">
                Email
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 w-24">
                Push
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {settings.map((s) => (
              <tr key={s.key} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-200">{s.label}</p>
                  <p className="text-xs text-gray-500">{s.description}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggle(s.key, 'email')}
                    className={clsx(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                      s.email ? 'bg-indigo-600' : 'bg-gray-600',
                    )}
                    role="switch"
                    aria-checked={s.email}
                  >
                    <span
                      className={clsx(
                        'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                        s.email ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggle(s.key, 'push')}
                    className={clsx(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                      s.push ? 'bg-indigo-600' : 'bg-gray-600',
                    )}
                    role="switch"
                    aria-checked={s.push}
                  >
                    <span
                      className={clsx(
                        'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                        s.push ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-2">
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
          {isSaving ? 'Guardando...' : 'Guardar preferencias'}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// Settings Page
// ============================================================
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('empresa');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Configuracion</h2>
        <p className="text-sm text-gray-400 mt-1">
          Administra las preferencias de tu empresa y cuenta
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        {activeTab === 'empresa' && <EmpresaTab />}
        {activeTab === 'seguridad' && <SeguridadTab />}
        {activeTab === 'notificaciones' && <NotificacionesTab />}
      </div>
    </div>
  );
}
