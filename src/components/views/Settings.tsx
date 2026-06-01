import React, { useState, useEffect } from 'react';
import { Users, Bot, Smartphone, Download, Upload, Plus, Edit2, Power, AlertTriangle, FileText, BrainCircuit, Trash2, Key, Lock, BellRing, Loader2, CheckCircle2, QrCode, MessageCircle, Send, X, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { sendPushNotification, requestNotificationPermission } from '../../lib/notifications';
import { AgentDesigner } from './AgentDesigner';
import UserManagementView from './UserManagementView';
import { toast } from 'sonner';
import { ChannelKey as MessagingChannelKey, getChannels, refreshChannels, setChannel } from '../../lib/channels';
import { EmailSyncAPI } from '../../services/db';

type Tab = 'usuarios' | 'bot' | 'canales' | 'email_sync' | 'import_export' | 'integraciones' | 'notificaciones';

type OcrStatus = {
  primary?: string;
  strategy?: string;
  order?: string[];
  orders?: Record<string, string[]>;
  cache?: { entries?: number; ttlMs?: number; maxEntries?: number };
  providers?: Record<string, { configured?: boolean; reachable?: boolean; model?: string; url?: string }>;
};

function currentSessionRole() {
  try {
    return (JSON.parse(localStorage.getItem('hd_session') || '{}')?.role || '').toUpperCase();
  } catch {
    return '';
  }
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('usuarios');

  const role = currentSessionRole();
  const canManageChannels = ['GERENTE', 'ADMINISTRACION', 'ADMIN', 'SUPERUSER'].includes(role);

  const tabs = [
    { id: 'usuarios', label: 'Gestión de Usuarios', icon: Users },
    { id: 'bot', label: 'Agentes Inteligentes', icon: Bot },
    ...(canManageChannels ? [{ id: 'canales' as const, label: 'Cuentas de mensajería', icon: Smartphone }] : []),
    { id: 'email_sync', label: 'Email Sync', icon: Upload },
    { id: 'notificaciones', label: 'Notificaciones Push', icon: BellRing },
    { id: 'integraciones', label: 'Integraciones y APIs', icon: Key },
    { id: 'import_export', label: 'Importar / Exportar', icon: Download },
  ];

  return (
    <div className="p-6 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight">Ajustes y Administración</h1>
        <p className="text-slate-400 text-sm">Gestiona usuarios, bots, canales y datos del sistema.</p>
      </div>

      <div className="w-full overflow-x-auto pb-2 hide-scrollbar">
        <div className="flex gap-2 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/10" 
                  : "bg-slate-900/90 text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 border border-white/5"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/90 backdrop-blur-md border border-white/5 rounded-2xl p-6 min-h-[500px] shadow-xl">
        {activeTab === 'usuarios' && <UsuariosTab />}
        {activeTab === 'bot' && <BotTab />}
        {activeTab === 'canales' && <CanalesTab />}
        {activeTab === 'email_sync' && <EmailSyncTab />}
        {activeTab === 'notificaciones' && <NotificacionesTab />}
        {activeTab === 'integraciones' && <ApiVaultTab />}
        {activeTab === 'import_export' && <ImportExportTab />}
      </div>
    </div>
  );
}

function NotificacionesTab() {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(('Notification' in window) ? Notification.permission : 'denied');

  const handleRequestPermission = async () => {
    await requestNotificationPermission();
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  };

  const handleTestAlert = () => {
    sendPushNotification('⚠️ Alerta Crítica del Sistema', {
      body: 'Se ha detectado una anomalía en un documento subido recientemente. Revisión requerida.',
      type: 'warning'
    });
  };

  const handleTestTicket = () => {
    sendPushNotification('✅ Ticket Actualizado', {
      body: 'El ticket TK-4029 ha cambiado su estado a RESUELTO.',
      type: 'success'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-white mb-1">Configuración de Notificaciones Push</h3>
        <p className="text-sm text-slate-400">Administra las alertas del sistema directamente en tu navegador. Estas notificaciones se desplegarán para anomalías de IA y actualizaciones críticas de tickets.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-black/40 border border-white/5 rounded-2xl p-6">
          <h4 className="text-md font-medium text-white flex items-center gap-2 mb-4">
            <BellRing className="w-5 h-5 text-blue-400" />
            Estado de Permisos
          </h4>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-400">Permiso actual del navegador:</span>
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-bold uppercase",
              permissionStatus === 'granted' ? "bg-emerald-500/20 text-emerald-400" :
              permissionStatus === 'denied' ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
            )}>
              {permissionStatus}
            </span>
          </div>
          <button
            onClick={handleRequestPermission}
            disabled={permissionStatus === 'granted'}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {permissionStatus === 'granted' ? 'Permiso Concedido' : 'Solicitar Permiso'}
          </button>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-2xl p-6">
          <h4 className="text-md font-medium text-white flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Simulador de Notificaciones
          </h4>
          <p className="text-xs text-slate-500 mb-4 tracking-wide">
            Prueba cómo se visualizarán las alertas entrantes en el sistema y en el navegador.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleTestAlert}
              className="w-full py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" /> Validar Anomalía (IA)
            </button>
            <button
              onClick={handleTestTicket}
              className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" /> Alerta de Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type VaultSecret = {
  id: string;
  provider: string;
  label: string;
  keyName: string;
  valueLast4?: string;
  status: 'active' | 'pending' | 'revoked';
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  revokedAt?: string | null;
};

const API_PROVIDERS = [
  { id: 'gemini', label: 'Gemini', keyName: 'GEMINI_API_KEY', hint: 'Modelo recomendado: gemini-2.5-flash' },
  { id: 'openai', label: 'OpenAI', keyName: 'OPENAI_API_KEY', hint: 'Para Realtime, transcripcion y automatizaciones IA.' },
  { id: 'ollama', label: 'Ollama-compatible', keyName: 'OLLAMA_API_KEY', hint: 'Opcional; usa Base URL para servidor local/remoto.' },
  { id: 'twilio', label: 'Twilio', keyName: 'TWILIO_AUTH_TOKEN', hint: 'Tambien agrega TWILIO_ACCOUNT_SID y TWILIO_FROM_NUMBER.' },
  { id: 'elevenlabs', label: 'ElevenLabs', keyName: 'ELEVENLABS_API_KEY', hint: 'Voz/validaciones; agrega IDs como claves separadas si aplica.' },
  { id: 'telegram', label: 'Telegram', keyName: 'TELEGRAM_BOT_TOKEN', hint: 'Token del bot para canales Telegram.' },
  { id: 'didit', label: 'Didit KYC', keyName: 'DIDIT_API_KEY', hint: 'Validacion KYC/documental.' },
  { id: 'custom', label: 'Custom', keyName: 'CUSTOM_API_KEY', hint: 'Cualquier modelo o API externa nueva.' },
];

function ApiVaultTab() {
  const role = currentSessionRole();
  const isManager = role === 'GERENTE';
  const [secrets, setSecrets] = useState<VaultSecret[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    provider: 'gemini',
    label: 'Gemini API',
    keyName: 'GEMINI_API_KEY',
    value: '',
    status: 'active',
    model: 'gemini-2.5-flash',
    baseUrl: '',
    notes: '',
  });

  const selectedProvider = API_PROVIDERS.find(provider => provider.id === form.provider) || API_PROVIDERS[0];

  const loadVault = async () => {
    if (!isManager) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integration-secrets');
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'No se pudo cargar la bóveda');
      const data = await res.json();
      setSecrets(Array.isArray(data.value) ? data.value : []);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo cargar la bóveda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVault(); }, [isManager]);

  const updateProvider = (providerId: string) => {
    const provider = API_PROVIDERS.find(item => item.id === providerId) || API_PROVIDERS[0];
    setForm(prev => ({
      ...prev,
      provider: provider.id,
      label: provider.label,
      keyName: provider.keyName,
      model: provider.id === 'gemini' ? 'gemini-2.5-flash' : '',
      baseUrl: provider.id === 'ollama' ? 'http://127.0.0.1:11434' : '',
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      provider: 'gemini',
      label: 'Gemini API',
      keyName: 'GEMINI_API_KEY',
      value: '',
      status: 'active',
      model: 'gemini-2.5-flash',
      baseUrl: '',
      notes: '',
    });
  };

  const saveVaultSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.value.trim()) {
      toast.error('Pega la clave nueva para guardarla o reemplazarla.');
      return;
    }
    setSaving(true);
    try {
      const metadata: Record<string, string> = {};
      if (form.model.trim()) metadata.model = form.model.trim();
      if (form.baseUrl.trim()) metadata.baseUrl = form.baseUrl.trim();
      if (form.notes.trim()) metadata.notes = form.notes.trim();
      const res = await fetch('/api/admin/integration-secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          provider: form.provider,
          label: form.label,
          keyName: form.keyName,
          value: form.value,
          status: form.status,
          metadata,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'No se pudo guardar');
      toast.success(editingId ? 'Clave reemplazada sin exponer el valor.' : 'Clave guardada en la bóveda.');
      resetForm();
      await loadVault();
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const startReplace = (secret: VaultSecret) => {
    setEditingId(secret.id);
    setForm({
      provider: secret.provider || 'custom',
      label: secret.label || '',
      keyName: secret.keyName || '',
      value: '',
      status: secret.status === 'revoked' ? 'active' : secret.status,
      model: String(secret.metadata?.model || ''),
      baseUrl: String(secret.metadata?.baseUrl || ''),
      notes: String(secret.metadata?.notes || ''),
    });
  };

  const patchStatus = async (secret: VaultSecret, status: 'active' | 'pending') => {
    const res = await fetch(`/api/admin/integration-secrets/${secret.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'No se pudo actualizar');
    await loadVault();
  };

  const revoke = async (secret: VaultSecret) => {
    const res = await fetch(`/api/admin/integration-secrets/${secret.id}/revoke`, { method: 'POST' });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'No se pudo revocar');
    toast.success('Clave revocada en la bóveda.');
    await loadVault();
  };

  const remove = async (secret: VaultSecret) => {
    const res = await fetch(`/api/admin/integration-secrets/${secret.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'No se pudo eliminar');
    toast.success('Registro eliminado.');
    await loadVault();
  };

  const test = async (secret: VaultSecret) => {
    setTestingId(secret.id);
    try {
      const res = await fetch(`/api/admin/integration-secrets/${secret.id}/test`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.message || data.error || 'Prueba fallida');
      toast.success(data.message || 'Prueba correcta');
    } catch (err: any) {
      toast.error(err?.message || 'Prueba fallida');
    } finally {
      setTestingId(null);
    }
  };

  const statusClass = (status: string) => status === 'active'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
    : status === 'revoked'
      ? 'bg-red-500/15 text-red-300 border-red-500/25'
      : 'bg-amber-500/15 text-amber-300 border-amber-500/25';

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Lock className="w-10 h-10 text-blue-300 mb-4" />
        <h3 className="text-xl font-bold text-white">Bóveda solo para Gerente</h3>
        <p className="text-sm text-slate-400 mt-2 max-w-md">Tu rol actual es {role || 'desconocido'}. Solo GERENTE puede crear, reemplazar o revocar claves API.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-400" /> Bóveda de APIs
          </h3>
          <p className="text-sm text-slate-400 mt-1">Guarda, reemplaza y revoca claves sin exponer el valor completo al navegador.</p>
        </div>
        <button onClick={loadVault} className="px-3 py-2 rounded-lg border border-white/10 bg-slate-950/60 text-slate-300 text-sm flex items-center gap-2">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Actualizar
        </button>
      </div>

      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-100/90">La clave Gemini que se pegó en el chat debe rotarse en Google Cloud antes de guardarse aquí. Después de guardar, esta pantalla solo mostrará los últimos 4 caracteres.</p>
      </div>

      <form onSubmit={saveVaultSecret} className="grid grid-cols-1 lg:grid-cols-12 gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
        <div className="lg:col-span-3">
          <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Proveedor</label>
          <select value={form.provider} onChange={e => updateProvider(e.target.value)} className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white">
            {API_PROVIDERS.map(provider => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
          </select>
          <p className="text-[11px] text-slate-500 mt-2">{selectedProvider.hint}</p>
        </div>
        <div className="lg:col-span-3">
          <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Etiqueta</label>
          <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white" />
        </div>
        <div className="lg:col-span-3">
          <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Variable / uso</label>
          <input value={form.keyName} onChange={e => setForm({ ...form, keyName: e.target.value.toUpperCase() })} className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm font-mono text-white" />
        </div>
        <div className="lg:col-span-3">
          <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Estado</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white">
            <option value="active">Activo</option>
            <option value="pending">Pendiente</option>
          </select>
        </div>
        <div className="lg:col-span-6">
          <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Clave nueva</label>
          <input type="password" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={editingId ? 'Pega la clave nueva para reemplazar' : 'Pega la clave API'} className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white" autoComplete="off" />
        </div>
        <div className="lg:col-span-3">
          <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Modelo</label>
          <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="gemini-2.5-flash" className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white" />
        </div>
        <div className="lg:col-span-3">
          <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Base URL</label>
          <input value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api..." className="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white" />
        </div>
        <div className="lg:col-span-9">
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notas internas opcionales" className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white" />
        </div>
        <div className="lg:col-span-3 flex gap-2">
          {editingId && <button type="button" onClick={resetForm} className="flex-1 rounded-xl border border-white/10 bg-slate-800 text-slate-200 text-sm">Cancelar</button>}
          <button disabled={saving} className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Reemplazar' : 'Guardar'}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {secrets.map(secret => (
          <div key={secret.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">{secret.label}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">{secret.keyName} · {secret.provider}</p>
              </div>
              <span className={cn('px-2 py-1 rounded-full border text-[10px] uppercase font-bold', statusClass(secret.status))}>{secret.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-black/30 border border-white/5 p-3">
                <p className="text-slate-500 uppercase font-bold">Clave</p>
                <p className="text-slate-200 font-mono mt-1 flex items-center gap-2"><EyeOff className="w-3.5 h-3.5" /> ****{secret.valueLast4 || '----'}</p>
              </div>
              <div className="rounded-xl bg-black/30 border border-white/5 p-3">
                <p className="text-slate-500 uppercase font-bold">Actualizada</p>
                <p className="text-slate-200 mt-1">{secret.updatedAt ? new Date(secret.updatedAt).toLocaleString() : 'Sin fecha'}</p>
              </div>
            </div>
            {(secret.metadata?.model || secret.metadata?.baseUrl) && (
              <p className="text-xs text-slate-400">Modelo: <span className="text-slate-200">{secret.metadata?.model || 'N/A'}</span>{secret.metadata?.baseUrl ? ` · URL: ${secret.metadata.baseUrl}` : ''}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => test(secret)} disabled={testingId === secret.id || secret.status === 'revoked'} className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                {testingId === secret.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Probar
              </button>
              <button onClick={() => startReplace(secret)} className="px-3 py-2 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs font-bold flex items-center gap-2"><Edit2 className="w-3.5 h-3.5" /> Reemplazar</button>
              {secret.status !== 'active' && <button onClick={() => patchStatus(secret, 'active').then(() => toast.success('Clave activada')).catch(err => toast.error(err.message))} className="px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-bold flex items-center gap-2"><Power className="w-3.5 h-3.5" /> Activar</button>}
              {secret.status !== 'revoked' && <button onClick={() => revoke(secret).catch(err => toast.error(err.message))} className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-bold">Revocar</button>}
              <button onClick={() => remove(secret).catch(err => toast.error(err.message))} className="px-3 py-2 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20 text-xs font-bold flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {!loading && secrets.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-400">
          No hay claves guardadas todavía. Agrega Gemini, OpenAI u otra API para activarla en el backend.
        </div>
      )}
    </div>
  );
}

function IntegracionesTab() {
  const [isUnlocked, setIsUnlocked] = useState(() => currentSessionRole() === 'GERENTE');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [keys, setKeys] = useState<any[]>([]);

  const [ocrStatus, setOcrStatus] = useState<OcrStatus | null>(null);

  useEffect(() => {
    if (!isUnlocked) return;
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const [keysRes, ocrRes] = await Promise.all([
          fetch('/api/settings/integration_keys'),
          fetch('/api/vision/status'),
        ]);
        if (keysRes.ok) {
          const data = await keysRes.json();
          setKeys(Array.isArray(data.value) ? data.value : []);
        }
        if (ocrRes.ok) {
          setOcrStatus(await ocrRes.json());
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [isUnlocked]);

  const appsDirectory = [
    { id: 'hubspot', name: 'HubSpot CRM', desc: 'Sincroniza contactos y ventas', icon: 'HubSpot', status: 'connected' },
    { id: 'slack', name: 'Slack', desc: 'Recibe alertas en tus canales', icon: 'Slack', status: 'available' },
    { id: 'whatsapp', name: 'WhatsApp / Baileys', desc: 'Chats operativos y enlaces nativos sin API Meta oficial', icon: 'WhatsApp', status: 'connected' },
    { id: 'sendgrid', name: 'SendGrid', desc: 'Campañas de email masivo', icon: 'SendGrid', status: 'available' },
    { id: 'zapier', name: 'Zapier', desc: 'Automatiza con más de 5000 apps', icon: 'Zapier', status: 'available' },
  ];

  const [newService, setNewService] = useState('');
  const [newKey, setNewKey] = useState('');
  const [showKeyId, setShowKeyId] = useState<number | null>(null);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentSessionRole() === 'GERENTE') {
      setIsUnlocked(true);
      setError('');
    } else {
      setError('Solo GERENTE puede gestionar credenciales.');
    }
  };

  const persistKeys = async (nextKeys: any[]) => {
    const res = await fetch('/api/settings/integration_keys', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: nextKeys }),
    });
    if (!res.ok) throw new Error('No se pudo guardar en el servidor');
    setKeys(nextKeys);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newService && newKey) {
      const newEntry = { id: `key-${Date.now()}`, service: newService, key: newKey, createdAt: new Date().toISOString() };
      const updated = [newEntry, ...keys];
      try {
        await persistKeys(updated);
        toast.success('Llave API guardada en servidor.');
        setNewService('');
        setNewKey('');
      } catch {
        toast.error('No se pudo guardar la llave API.');
      }
    }
  };

  const handleDelete = async (id: string) => {
    const updated = keys.filter(k => k.id !== id);
    try {
      await persistKeys(updated);
      toast.success('Llave eliminada.');
    } catch {
      toast.error('No se pudo eliminar la llave.');
    }
  };

  const configuredOcrProviders = (Object.values(ocrStatus?.providers ?? {}) as Array<{ configured?: boolean }>).filter(provider => provider.configured).length;

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] mb-2">
          <Lock className="w-8 h-8 text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-100">Bóveda de Integraciones</h3>
        <p className="text-slate-400 text-sm text-center max-w-md">
          Las credenciales se gestionan con permisos del servidor. Solo GERENTE puede acceder.
        </p>
        <form onSubmit={handleUnlock} className="w-full max-w-sm space-y-3 mt-6">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Acceso protegido por rol"
            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-center tracking-widest"
          />
          {error && <p className="text-red-400 text-xs px-1 text-center font-medium">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20">
            Verificar acceso
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-400" /> APIs e Integraciones
          </h3>
          <p className="text-slate-400 text-sm mt-1">Conecta el sistema con tus aplicaciones favoritas.</p>
        </div>
        <button onClick={() => setIsUnlocked(false)} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-white/5 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5" /> Bloquear
        </button>
      </div>

      {/* ── OCR local privado ─────────────────────── */}
      <div className="bg-gradient-to-br from-blue-950/40 to-slate-900/60 border border-blue-500/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <BrainCircuit className="w-6 h-6 text-blue-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              OCR local privado
              {configuredOcrProviders > 0
                ? <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">{configuredOcrProviders} activos</span>
                : <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">Solo local</span>}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Orquestador privado con Ollama como primario y Tesseract local como respaldo. Las INE, comprobantes, capturas SIAC y documentos financieros no se envían a Google Vision ni Gemini.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-cyan-400/15 bg-slate-950/50 p-4">
            <p className="text-[10px] uppercase tracking-wider text-cyan-300 font-bold">Ollama</p>
            <p className="text-sm text-slate-100 font-semibold mt-1">{ocrStatus?.providers?.ollama?.model || 'glm-ocr / llava / qwen2-vl'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {ocrStatus?.providers?.ollama?.reachable ? 'Disponible para OCR privado.' : 'Si no responde, el sistema usa Tesseract o captura manual.'}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/15 bg-slate-950/50 p-4">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">Fallback local</p>
            <p className="text-sm text-slate-100 font-semibold mt-1">{ocrStatus?.providers?.tesseract?.model || 'tesseract-spa (local)'}</p>
            <p className="text-xs text-slate-400 mt-1">No requiere red ni APIs externas; puede pedir revisión manual si la lectura no es confiable.</p>
          </div>
        </div>

        {ocrStatus && (
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Estrategia</p>
                <p className="text-sm text-cyan-200 font-semibold">{ocrStatus.strategy || 'adaptive'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Primario INE</p>
                <p className="text-sm text-slate-100 font-semibold">{ocrStatus.primary || 'ollama'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Cache</p>
                <p className="text-sm text-slate-100 font-semibold">{ocrStatus.cache?.entries ?? 0} / {ocrStatus.cache?.maxEntries ?? 100}</p>
              </div>
            </div>

            <div className="space-y-2">
              {(Object.entries(ocrStatus.orders ?? {}) as [string, string[]][]).map(([doc, order]) => (
                <div key={doc} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="w-28 text-[10px] uppercase tracking-wider text-slate-500 font-bold">{doc}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(order || []).map((provider, index) => {
                      const configured = ocrStatus.providers?.[provider]?.configured;
                      return (
                        <span
                          key={`${doc}-${provider}`}
                          className={cn(
                            'px-2 py-1 rounded-lg text-[10px] font-bold uppercase border',
                            configured
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                              : 'bg-slate-800/70 text-slate-400 border-white/10'
                          )}
                        >
                          {index + 1}. {provider}{configured ? '' : ' sin config'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recommended Apps */}
      <div>
        <h4 className="text-sm font-medium text-slate-100 mb-4 uppercase tracking-wider text-[11px]">Directorio de Aplicaciones</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {appsDirectory.map(app => (
            <div key={app.id} className="bg-slate-950/90 border border-white/5 hover:border-white/10 rounded-xl p-5 flex flex-col transition-all hover:bg-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center font-bold text-blue-400">
                    {app.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-100">{app.name}</div>
                    <div className="text-xs text-slate-500">{app.desc}</div>
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-4 flex gap-2">
                {app.status === 'connected' ? (
                  <button className="flex-1 bg-slate-800/80 text-slate-300 py-2 rounded-lg text-xs font-medium border border-white/5 flex items-center justify-center gap-1.5 cursor-default">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Conectado
                  </button>
                ) : app.status === 'disabled' ? (
                  <button disabled className="flex-1 bg-slate-800/20 text-slate-500 py-2 rounded-lg text-xs font-medium border border-white/5 cursor-not-allowed">
                    Próximamente
                  </button>
                ) : (
                  <button className="flex-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 py-2 rounded-lg text-xs font-medium transition-all border border-blue-500/20">
                    Conectar
                  </button>
                )}
                <button className="px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-300 transition-colors border border-white/5">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-6 border-t border-white/5">
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-slate-100 mb-2 uppercase tracking-wider text-[11px]">Integraciones Activas (Claves API)</h4>
          <div className="space-y-3">
            {keys.map(k => (
              <div key={k.id} className="bg-slate-900/90 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-inner">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 mb-1">{k.service}</div>
                  <div className="flex items-center gap-2 max-w-full">
                    <code className="bg-black/30 px-2 py-1 rounded text-xs text-blue-300 font-mono truncate">
                      {showKeyId === k.id ? k.key : '••••••••••••••••••••••••••••••••••••••••'}
                    </code>
                    <button onClick={() => setShowKeyId(showKeyId === k.id ? null : k.id)} className="p-1.5 text-slate-500 hover:text-slate-300 bg-slate-800/50 rounded-md transition-colors shrink-0">
                      {showKeyId === k.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <button onClick={() => handleDelete(k.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0 self-end sm:self-auto">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {keys.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-800/50 rounded-xl">
                No hay credenciales personalizadas guardadas.
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-950/90 border border-white/5 rounded-xl p-5">
          <h4 className="text-sm font-medium text-slate-100 mb-4 uppercase tracking-wider text-[11px]">Añadir Integración Personalizada</h4>
          <p className="text-xs text-slate-400 mb-4">Usa esta sección para añadir tokens de aplicaciones que no están en el directorio.</p>
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <input
              type="text"
              value={newService}
              onChange={e => setNewService(e.target.value)}
              placeholder="Nombre (ej. My Webhook)"
              className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            <input
              type="password"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="Llave API / Token"
              className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 font-mono"
            />
            <button disabled={!newService || !newKey || isLoading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all mt-2 flex justify-center items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Añadir Credencial'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function UsuariosTab() {
  return <UserManagementView />;
}

function BotTab() {
  const [showDesigner, setShowDesigner] = useState(false);

  const agents = [
    {
      id: 'capturista',
      name: 'Agente Capturista',
      role: 'Atención y Captura de Datos',
      desc: 'Recibe información entrante de clientes estructurando leads y extrayendo datos iniciales.',
      channels: ['WhatsApp', 'Telegram', 'Web App'],
      status: 'active'
    },
    {
      id: 'documentos',
      name: 'Administrador de Documentos',
      role: 'Gestión de Expedientes',
      desc: 'Valida, clasifica y archiva los documentos recibidos, actualizando el expediente de cada cliente.',
      channels: ['Sistema Interno'],
      status: 'active'
    },
    {
      id: 'validacion',
      name: 'Agente de Validación',
      role: 'Llamadas y Verificación',
      desc: 'Realiza llamadas automatizadas para confirmar datos y verificar la identidad de los prospectos.',
      channels: ['Voz / Telefonía'],
      status: 'training'
    },
    {
      id: 'analista',
      name: 'Agente Analista',
      role: 'Monitoreo y Rendimiento',
      desc: 'Mide tiempos de respuesta, tasas de conversión y métricas de desempeño del equipo humano y los bots.',
      channels: ['Dashboard Analytics'],
      status: 'active'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {agents.map(agent => (
          <div key={agent.id} className="bg-slate-950/90 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all shadow-inner">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center text-blue-400 font-bold shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{agent.name}</h3>
                  <p className="text-xs font-medium text-blue-400/80 uppercase tracking-wider">{agent.role}</p>
                </div>
              </div>
              <div className={cn(
                "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border",
                agent.status === 'active' 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : "bg-amber-500/10 text-amber-500 border-amber-500/20"
              )}>
                {agent.status === 'active' ? 'Operativo' : 'En Entrenamiento'}
              </div>
            </div>

            <div className="mt-4 relative z-10 space-y-4">
              <p className="text-sm text-slate-400">{agent.desc}</p>
              
              <div className="bg-black/30 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Canales Activos:</span>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {agent.channels.map(channel => (
                    <span key={channel} className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md border border-white/5">
                      {channel}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-xs font-medium transition-colors border border-white/5 flex items-center justify-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> Prompt y Base
                </button>
                <button className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 py-2 rounded-lg text-xs font-medium transition-colors border border-blue-500/20 flex items-center justify-center gap-2">
                  <BrainCircuit className="w-3.5 h-3.5" /> Ajustar Modelo
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-6 shadow-inner">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-2">
              <Plus className="w-5 h-5 text-blue-400" /> Crear Nuevo Agente IA
            </h3>
            <p className="text-sm text-slate-400 max-w-xl">
              Diseña un nuevo agente proporcionando un nombre, asignando las integraciones necesarias (por ejemplo, correos, base de datos) y definiendo sus instrucciones maestras.
            </p>
          </div>
          <button onClick={() => setShowDesigner(true)} className="whitespace-nowrap px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20">
            Diseñador de Agentes
          </button>
        </div>
      </div>
      
      {showDesigner && <AgentDesigner onClose={() => setShowDesigner(false)} />}
    </div>
  );
}

interface ChannelState {
  connected: boolean;
  identifier?: string; // teléfono (+52…) o @username del bot
  connectedAt?: string; // ISO date
  status?: string;
  error?: string | null;
  credentialsPresent?: boolean;
}

type ChannelKey = 'whatsappPromotores' | 'whatsappClientes' | 'telegram';

const DEFAULT_CHANNELS: Record<ChannelKey, ChannelState> = {
  whatsappPromotores: { connected: false },
  whatsappClientes: { connected: false },
  telegram: { connected: false },
};

function CanalesTab() {
  // Restricción de rol — solo GERENTE/ADMIN puede ver/configurar canales
  const role = currentSessionRole();
  const isAuthorized = role === 'GERENTE' || role === 'ADMINISTRACION' || role === 'ADMIN';

  const [channels, setChannels] = useState<typeof DEFAULT_CHANNELS>(() => {
    return DEFAULT_CHANNELS;
  });

  const [connectModal, setConnectModal] = useState<ChannelKey | null>(null);

  const messagingKey = (key: ChannelKey): MessagingChannelKey => {
    if (key === 'whatsappClientes') return 'whatsappClientes';
    if (key === 'telegram') return 'telegramVendedores';
    return 'whatsappVendedores';
  };

  const buildWhatsAppState = (link: any, live: any): ChannelState => ({
    connected: live?.status === 'connected',
    identifier: link?.identifier || live?.externalId || '',
    connectedAt: link?.linkedAt,
    status: live?.status || 'disconnected',
    error: live?.error || null,
    credentialsPresent: live?.credentialsPresent === true,
  });

  const loadChannels = async () => {
    const linked = await refreshChannels().catch(() => getChannels());
    const [whatsAppStatus, telegramStatus] = await Promise.all([
      fetch('/api/whatsapp/status', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/telegram/status', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    setChannels({
      whatsappPromotores: buildWhatsAppState(linked.whatsappVendedores, whatsAppStatus?.promotores),
      whatsappClientes: buildWhatsAppState(linked.whatsappClientes, whatsAppStatus?.clientes),
      telegram: linked.telegramVendedores
        ? {
            connected: telegramStatus?.status ? telegramStatus.status === 'polling' : true,
            identifier: linked.telegramVendedores.identifier || (telegramStatus?.botName ? `@${telegramStatus.botName}` : ''),
            connectedAt: linked.telegramVendedores.linkedAt,
            status: telegramStatus?.status || 'polling',
            error: telegramStatus?.error || null,
          }
        : { connected: telegramStatus?.status === 'polling', identifier: telegramStatus?.botName ? `@${telegramStatus.botName}` : '', status: telegramStatus?.status || 'disconnected', error: telegramStatus?.error || null },
    });
  };

  useEffect(() => { void loadChannels(); }, []);

  const handleWhatsAppConnected = (which: 'whatsappPromotores' | 'whatsappClientes', phone: string) => {
    const linkedAt = new Date().toISOString();
    setChannel(messagingKey(which), { alias: which === 'whatsappClientes' ? 'WhatsApp Clientes' : 'WhatsApp Promotores', identifier: phone, linkedAt });
    setChannels({ ...channels, [which]: { connected: true, identifier: phone, connectedAt: linkedAt } });
    setConnectModal(null);
  };

  const handleTelegramConnected = (botUsername: string) => {
    const linkedAt = new Date().toISOString();
    setChannel('telegramVendedores', { alias: 'Telegram Vendedores', identifier: `@${botUsername}`, linkedAt });
    setChannels({ ...channels, telegram: { connected: true, identifier: `@${botUsername}`, connectedAt: linkedAt } });
    setConnectModal(null);
  };

  const disconnect = (which: ChannelKey) => {
    const isTelegram = which === 'telegram';
    const label = which === 'whatsappPromotores' ? 'WhatsApp Promotores' : which === 'whatsappClientes' ? 'WhatsApp Clientes' : 'Telegram';
    if (!confirm(`¿Desconectar la cuenta de ${label}? El agente IA dejará de atender los mensajes entrantes de esa cuenta.`)) return;
    const endpoint = isTelegram ? '/api/telegram/stop' : '/api/whatsapp/logout';
    const body = isTelegram ? {} : { account: which === 'whatsappClientes' ? 'clientes' : 'promotores' };
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
    setChannel(messagingKey(which), null);
    setChannels({ ...channels, [which]: { connected: false } });
    toast.success(`${label} desconectado.`);
  };

  // Gate de acceso
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-100 mb-1">Acceso restringido</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          La gestión de cuentas de WhatsApp y Telegram solo está disponible para usuarios con rol <b className="text-slate-200">Gerente</b> o <b className="text-slate-200">Administración</b>.
        </p>
        <p className="text-xs text-slate-500 mt-2">Tu rol actual: <span className="font-mono text-slate-400">{role || 'desconocido'}</span></p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-start gap-4 pb-4 border-b border-white/5">
        <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-100 mb-0.5">Cuentas de mensajería</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            El <b className="text-slate-200">Agente IA</b> recibe automáticamente los mensajes que entren por estas cuentas. Usa un número para <b className="text-slate-200">promotores</b> y otro número independiente para <b className="text-slate-200">clientes</b>.
          </p>
        </div>
      </div>

      {/* Cuentas separadas — WhatsApp promotores, WhatsApp clientes y Telegram */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ChannelCard
          platform="whatsapp"
          title="WhatsApp Promotores"
          subtitle="ARIUX promotores"
          description="Número exclusivo para promotores: consultas de folio, captura de datos y flujo operativo."
          state={channels.whatsappPromotores}
          onConnect={() => setConnectModal('whatsappPromotores')}
          onDisconnect={() => disconnect('whatsappPromotores')}
        />
        <ChannelCard
          platform="whatsapp"
          title="WhatsApp Clientes"
          subtitle="ARIUX Clientes"
          description="Número exclusivo para clientes: bienvenida, dudas, domiciliación, soporte y morosidad."
          state={channels.whatsappClientes}
          onConnect={() => setConnectModal('whatsappClientes')}
          onDisconnect={() => disconnect('whatsappClientes')}
        />
        <ChannelCard
          platform="telegram"
          title="Telegram"
          subtitle="Bot operativo"
          description="Conecta un bot creado en @BotFather usando su token de acceso."
          state={channels.telegram}
          onConnect={() => setConnectModal('telegram')}
          onDisconnect={() => disconnect('telegram')}
        />
      </div>

      {/* Resumen del agente IA */}
      <div className="bg-gradient-to-br from-blue-950/40 to-slate-900/60 border border-blue-500/15 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-slate-100 mb-1">Agente IA — Atención automática</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              WhatsApp Promotores alimenta el flujo de promotores. WhatsApp Clientes alimenta el CRM de clientes y campañas. Telegram permanece como canal operativo adicional.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <StatusPill label="WA Promotores" connected={channels.whatsappPromotores.connected} accent="emerald" />
              <StatusPill label="WA Clientes" connected={channels.whatsappClientes.connected} accent="emerald" />
              <StatusPill label="Telegram" connected={channels.telegram.connected} accent="sky" />
            </div>
          </div>
        </div>
      </div>

      {(connectModal === 'whatsappPromotores' || connectModal === 'whatsappClientes') && (
        <WhatsAppQrModal
          account={connectModal === 'whatsappClientes' ? 'clientes' : 'promotores'}
          title={connectModal === 'whatsappClientes' ? 'Vincular WhatsApp Clientes' : 'Vincular WhatsApp Promotores'}
          onClose={() => setConnectModal(null)}
          onConnected={(phone) => handleWhatsAppConnected(connectModal as 'whatsappPromotores' | 'whatsappClientes', phone)}
        />
      )}
      {connectModal === 'telegram' && (
        <TelegramConnectModal
          onClose={() => setConnectModal(null)}
          onConnected={handleTelegramConnected}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────
// Tarjeta de canal (WhatsApp / Telegram)
// ───────────────────────────────────────
function ChannelCard({
  platform,
  title,
  subtitle,
  description,
  state,
  onConnect,
  onDisconnect,
}: {
  platform: 'whatsapp' | 'telegram';
  title: string;
  subtitle: string;
  description: string;
  state: ChannelState;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const isWA = platform === 'whatsapp';
  const accent = isWA ? 'emerald' : 'sky';
  const Icon = isWA ? MessageCircle : Send;
  const waitingQr = isWA && state.status === 'qr';
  const authenticating = isWA && state.status === 'authenticating';
  const statusLabel = state.connected ? 'Activa' : waitingQr ? 'Esperando QR' : authenticating ? 'Autenticando' : 'Sin conectar';
  const statusClasses = state.connected
    ? isWA
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
    : waitingQr || authenticating
      ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
      : 'bg-slate-800 text-slate-400 border-white/5';

  const connectedAtFmt = state.connectedAt
    ? new Date(state.connectedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-6 transition-all',
        state.connected
          ? isWA
            ? 'bg-gradient-to-br from-emerald-950/50 via-emerald-900/20 to-slate-950/40 border-emerald-500/30'
            : 'bg-gradient-to-br from-sky-950/50 via-sky-900/20 to-slate-950/40 border-sky-500/30'
          : 'bg-slate-950/60 border-white/5 hover:border-white/10',
      )}
    >
      {/* Glow decorativo */}
      {state.connected && (
        <div
          className={cn(
            'absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none',
            isWA ? 'bg-emerald-500' : 'bg-sky-500',
          )}
        />
      )}

      <div className="relative flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-xl border flex items-center justify-center shrink-0',
              isWA ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-sky-500/20 border-sky-500/30',
            )}
          >
            <Icon className={cn('w-6 h-6', isWA ? 'text-emerald-400' : 'text-sky-400')} />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-100">{title}</h4>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        <span
          className={cn(
            'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5',
            statusClasses,
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              state.connected
                ? (isWA ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400 animate-pulse')
                : waitingQr || authenticating ? 'bg-yellow-300 animate-pulse' : 'bg-slate-500',
            )}
          />
          {statusLabel}
        </span>
      </div>

      {state.connected ? (
        <div className="relative space-y-3">
          <div className="bg-black/30 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              {isWA ? 'Número vinculado' : 'Bot vinculado'}
            </div>
            <div className="font-mono text-sm text-slate-100">{state.identifier}</div>
            {connectedAtFmt && (
              <div className="text-[10px] text-slate-500 mt-1">Conectado el {connectedAtFmt}</div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={onConnect}
              className={cn(
                'w-full py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 border',
                isWA
                  ? 'bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border-emerald-500/20'
                  : 'bg-sky-600/15 hover:bg-sky-600/25 text-sky-300 border-sky-500/20',
              )}
            >
              {isWA ? <QrCode className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
              {isWA ? 'Re-vincular QR' : 'Cambiar token'}
            </button>
            <button
              onClick={onDisconnect}
              className="w-full bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/20 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Power className="w-3.5 h-3.5" /> Desconectar
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            {waitingQr
              ? 'Hay una sesión esperando escaneo. Abre el QR para terminar la vinculación.'
              : state.error
                ? state.error
                : description}
          </p>
          <button
            onClick={onConnect}
            className={cn(
              'w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg',
              isWA
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                : 'bg-sky-600 hover:bg-sky-500 shadow-sky-500/20',
            )}
          >
            {isWA ? <><QrCode className="w-4 h-4" /> {waitingQr ? 'Escanear QR' : 'Vincular con QR'}</> : <><Send className="w-4 h-4" /> Conectar bot</>}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, connected, accent }: { label: string; connected: boolean; accent: 'emerald' | 'sky' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
        connected
          ? accent === 'emerald'
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
          : 'bg-slate-800/60 text-slate-500 border-white/5',
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', connected ? (accent === 'emerald' ? 'bg-emerald-400' : 'bg-sky-400') : 'bg-slate-500')} />
      {label} · {connected ? 'on' : 'off'}
    </span>
  );
}

function EmailSyncTab() {
  const [status, setStatus] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: 'gmail-primary',
    label: 'Gmail principal',
    email: '',
    query: 'has:attachment (filename:csv OR filename:xlsx OR filename:xls) newer_than:14d',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    enabled: true,
  });

  const load = async () => {
    const [nextStatus, nextJobs, nextAccounts] = await Promise.all([
      EmailSyncAPI.status(),
      EmailSyncAPI.jobs(50),
      EmailSyncAPI.accounts(),
    ]);
    setStatus(nextStatus);
    setJobs(Array.isArray(nextJobs) ? nextJobs : []);
    setAccounts(Array.isArray(nextAccounts) ? nextAccounts : []);
    const first = Array.isArray(nextAccounts) ? nextAccounts[0] : null;
    if (first) {
      setForm(prev => ({
        ...prev,
        id: first.id || prev.id,
        label: first.label || prev.label,
        email: first.email || '',
        query: first.query || prev.query,
        enabled: first.enabled !== 0,
      }));
    }
  };

  useEffect(() => {
    load().catch(err => toast.error(err?.message || 'No se pudo cargar Email Sync.'));
  }, []);

  const saveAccount = async () => {
    setBusy('save');
    try {
      await EmailSyncAPI.saveAccount(form);
      toast.success('Configuración Gmail guardada.');
      await load();
      setForm(prev => ({ ...prev, clientSecret: '', refreshToken: '' }));
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar Gmail Sync.');
    } finally {
      setBusy(null);
    }
  };

  const runGmail = async () => {
    setBusy('run');
    try {
      const result = await EmailSyncAPI.run({ accountId: form.id, limit: 10 });
      toast.success(`Gmail revisado: ${result?.processed?.length || 0} archivo(s) procesado(s).`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo ejecutar Gmail Sync.');
    } finally {
      setBusy(null);
    }
  };

  const uploadFile = async (file: File | null) => {
    if (!file) return;
    setBusy('upload');
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const result = await EmailSyncAPI.upload({ fileName: file.name, contentBase64, mimeType: file.type });
      toast.success(`Archivo procesado: ${result?.result?.imported ?? 0} registros actualizados.`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo procesar el archivo.');
    } finally {
      setBusy(null);
    }
  };

  const totals = status?.jobs || {};
  const recent = jobs.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Upload className="w-5 h-5 text-cyan-300" />
            Automatización Email → CSV/XLSX → CRM
          </h3>
          <p className="text-sm text-slate-300 mt-1">
            Monitorea Gmail, descarga adjuntos, clasifica archivos y actualiza SIAC, morosidad y seguimientos.
          </p>
        </div>
        <button
          onClick={runGmail}
          disabled={busy === 'run'}
          className="hd-premium-button px-5 py-3 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy === 'run' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Revisar Gmail ahora
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Procesados', totals.completed || 0, 'text-emerald-300'],
          ['Errores', totals.failed || 0, 'text-rose-300'],
          ['Importados', totals.imported || 0, 'text-cyan-300'],
          ['Omitidos', totals.skipped || 0, 'text-orange-300'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="hd-premium-card rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">{label}</p>
            <p className={cn('text-3xl font-black mt-1', String(color))}>{String(value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-5">
        <section className="hd-premium-card rounded-3xl p-5 space-y-4">
          <div>
            <h4 className="text-white font-black">Conector Gmail OAuth2</h4>
            <p className="text-xs text-slate-400 mt-1">
              Usa refresh token seguro. No se guarda contraseña de Gmail.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest font-black text-cyan-300">Etiqueta</span>
              <input className="hd-premium-input w-full rounded-xl px-3 py-2.5 text-sm" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest font-black text-cyan-300">Correo origen</span>
              <input className="hd-premium-input w-full rounded-xl px-3 py-2.5 text-sm" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="reportes@empresa.com" />
            </label>
            <label className="md:col-span-2 space-y-1">
              <span className="text-[10px] uppercase tracking-widest font-black text-cyan-300">Query Gmail</span>
              <input className="hd-premium-input w-full rounded-xl px-3 py-2.5 text-sm" value={form.query} onChange={e => setForm({ ...form, query: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest font-black text-cyan-300">Client ID</span>
              <input className="hd-premium-input w-full rounded-xl px-3 py-2.5 text-sm" value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} placeholder="Opcional si está en .env" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest font-black text-cyan-300">Client Secret</span>
              <input className="hd-premium-input w-full rounded-xl px-3 py-2.5 text-sm" type="password" value={form.clientSecret} onChange={e => setForm({ ...form, clientSecret: e.target.value })} placeholder="No se muestra al cargar" />
            </label>
            <label className="md:col-span-2 space-y-1">
              <span className="text-[10px] uppercase tracking-widest font-black text-cyan-300">Refresh Token</span>
              <input className="hd-premium-input w-full rounded-xl px-3 py-2.5 text-sm" type="password" value={form.refreshToken} onChange={e => setForm({ ...form, refreshToken: e.target.value })} placeholder="Pegar token OAuth2 con scope Gmail readonly" />
            </label>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={saveAccount} disabled={busy === 'save'} className="hd-premium-button rounded-2xl px-4 py-3 text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-60">
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Guardar conector
            </button>
            <label className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-black text-cyan-100 border border-cyan-300/25 bg-cyan-400/10 hover:bg-cyan-400/20 transition flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              Subir CSV/XLSX manual
              <input className="hidden" type="file" accept=".csv,.xlsx,.xlsm" onChange={e => uploadFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-950/20 p-3 text-xs text-slate-300">
            Estado: {status?.configured ? <b className="text-emerald-300">configurado</b> : <b className="text-orange-300">pendiente de token</b>}
            {accounts.length > 0 && <span> · {accounts.length} cuenta(s) registradas</span>}
          </div>
        </section>

        <section className="hd-premium-card rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="text-white font-black">Historial de sincronización</h4>
              <p className="text-xs text-slate-400">Clasificación local IA v1 + validación básica.</p>
            </div>
            <button onClick={load} className="p-2 rounded-xl bg-cyan-400/10 border border-cyan-300/20 text-cyan-200 hover:bg-cyan-400/20">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {recent.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
                Aún no hay archivos procesados.
              </div>
            ) : recent.map(job => (
              <div key={job.id} className="rounded-2xl border border-cyan-300/15 bg-[#061b3a]/85 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white truncate">{job.file_name || job.subject || 'Archivo'}</p>
                    <p className="text-[11px] text-slate-400 truncate">{job.sender || job.source} · {job.detected_type || 'sin clasificar'}</p>
                  </div>
                  <span className={cn(
                    'shrink-0 px-2 py-1 rounded-full text-[10px] uppercase font-black border',
                    job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25' :
                    job.status === 'failed' ? 'bg-rose-500/10 text-rose-300 border-rose-400/25' :
                    'bg-cyan-500/10 text-cyan-300 border-cyan-400/25'
                  )}>
                    {job.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="rounded-xl bg-black/20 p-2"><b className="text-cyan-200">{job.imported || 0}</b> importados</div>
                  <div className="rounded-xl bg-black/20 p-2"><b className="text-orange-200">{job.skipped || 0}</b> omitidos</div>
                </div>
                {job.metadata?.summary && <p className="mt-2 text-xs text-slate-300 leading-relaxed">{job.metadata.summary}</p>}
                {Array.isArray(job.errors) && job.errors.length > 0 && (
                  <p className="mt-2 text-xs text-rose-300 flex gap-1"><AlertTriangle className="w-3 h-3 mt-0.5" />{job.errors[0]}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ImportExportTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-5">
        <h3 className="text-slate-100 font-medium flex items-center gap-2">
          <Download className="w-5 h-5 text-blue-400" /> Exportar Datos
        </h3>
        <p className="text-sm text-slate-400">Descarga reportes y expedientes con el membrete oficial de la empresa.</p>
        
        <div className="space-y-3">
          <button className="w-full text-left px-5 py-4 bg-slate-950/80 border border-white/5 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-sm text-slate-100 flex justify-between items-center group">
            Expedientes de Candidatos 
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 group-hover:text-blue-400 transition-colors">PDF</span>
          </button>
          <button className="w-full text-left px-5 py-4 bg-slate-950/80 border border-white/5 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-sm text-slate-100 flex justify-between items-center group">
            Reporte de Morosos 
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 group-hover:text-blue-400 transition-colors">Excel / PDF</span>
          </button>
          <button className="w-full text-left px-5 py-4 bg-slate-950/80 border border-white/5 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-sm text-slate-100 flex justify-between items-center group">
            Historial de Nóminas 
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 group-hover:text-blue-400 transition-colors">PDF</span>
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <h3 className="text-slate-100 font-medium flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-400" /> Importar Configuración
        </h3>
        <p className="text-sm text-slate-400">Sube archivos de configuración del sistema (Backend/Frontend).</p>
        
        <div className="border-2 border-dashed border-slate-700/50 rounded-2xl p-10 text-center hover:bg-slate-800/30 transition-colors cursor-pointer bg-slate-950/20">
          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-100 text-sm font-medium mb-1">Seleccionar archivo JSON/ENV</p>
          <p className="text-xs text-slate-500">Arrastra tu archivo aquí</p>
        </div>

        <div className="mt-6">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Historial Reciente</h4>
          <div className="bg-slate-950/80 border border-white/5 rounded-xl p-4 flex justify-between items-center text-sm shadow-inner">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800/50 rounded-lg">
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <span className="text-slate-300 font-medium">config_prod_v2.json</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">12 KB • Hace 2 días</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// WhatsApp QR Modal — usa Baileys en el servidor para vincular por QR.
// ──────────────────────────────────────────────────────────
function WhatsAppQrModal({
  account,
  title,
  onClose,
  onConnected,
}: {
  account: 'promotores' | 'clientes';
  title: string;
  onClose: () => void;
  onConnected: (phone: string) => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'qr' | 'authenticating' | 'connected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  const startSession = async () => {
    setInitializing(true);
    setError(null);
    setQr(null);
    setStatus('authenticating');
    try {
      const r = await fetch('/api/whatsapp/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account }),
      });
      if (!r.ok) throw new Error('No se pudo iniciar WhatsApp en el servidor.');
    } catch (e: any) {
      setError(e.message);
      setStatus('disconnected');
    } finally {
      setInitializing(false);
    }
  };

  // Iniciar sesión y hacer polling cada 2s
  useEffect(() => {
    let cancelled = false;

    startSession();

    const poll = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/whatsapp/qr?account=${account}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.qr) {
          setQr(data.qr);
        } else if (data.status?.status !== 'qr') {
          setQr(null);
        }
        if (data.status?.status) setStatus(data.status.status);
        if (data.status?.error) {
          setError(data.status.error);
        } else if (data.status?.status && data.status.status !== 'disconnected') {
          setError(null);
        }
        if (data.status?.status === 'connected') {
          toast.success(`${title.replace('Vincular ', '')} conectado correctamente.`);
          setTimeout(() => onConnected(title.replace('Vincular ', '')), 600);
          clearInterval(poll);
        }
      } catch {
        // ignorar errores transitorios
      }
    }, 2000);

    return () => { cancelled = true; clearInterval(poll); };
  }, [account, onConnected, title]);

  const canRetry = status === 'disconnected' && !initializing;

  return (
    <ModalShell title={title} accent="emerald" icon={<MessageCircle className="w-5 h-5 text-emerald-400" />} onClose={onClose}>
      <ol className="text-xs text-slate-400 space-y-1.5 mb-4 list-decimal list-inside">
        <li>Abre <b className="text-slate-200">WhatsApp</b> en tu teléfono.</li>
        <li>Toca <b className="text-slate-200">Menú</b> (⋮) o <b className="text-slate-200">Ajustes</b> y selecciona <b className="text-slate-200">Dispositivos vinculados</b>.</li>
        <li>Toca <b className="text-slate-200">Vincular un dispositivo</b> y escanea este código.</li>
      </ol>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="relative mx-auto w-fit bg-white p-2 rounded-xl min-h-[280px] min-w-[280px] flex items-center justify-center">
        {qr && status === 'qr' ? (
          <img src={qr} alt="QR real de WhatsApp Web" className="block w-[260px] h-[260px]" />
        ) : canRetry ? (
          <div className="flex flex-col items-center gap-3 text-slate-600 px-6 text-center">
            <RefreshCw className="w-10 h-10 text-emerald-600" />
            <p className="text-xs font-medium">La sesión anterior se cerró. Genera un QR nuevo para vincular WhatsApp.</p>
            <button
              type="button"
              onClick={startSession}
              className="mt-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-colors"
            >
              Regenerar QR
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-600">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
            <p className="text-xs font-medium">
              {initializing && 'Iniciando WhatsApp en el servidor…'}
              {!initializing && status === 'disconnected' && 'Generando código QR…'}
              {status === 'authenticating' && 'Autenticando con WhatsApp…'}
              {status === 'connected' && '¡Conectado!'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-slate-500 text-center">
        Estado: <span className="text-slate-300 font-mono">{status}</span> · Motor: <span className="text-emerald-300 font-mono">Baileys</span>
        <span className="block mt-1">Cuenta: <span className="text-slate-300 font-mono">{account}</span></span>
      </div>
    </ModalShell>
  );
}

// ──────────────────────────────────────────────────────────
// Telegram Bot Modal — envia el token al servidor; no se persiste en el navegador.
// ──────────────────────────────────────────────────────────
function TelegramConnectModal({ onClose, onConnected }: { onClose: () => void; onConnected: (botUsername: string) => void; }) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setError('Pega el token del bot.');
      return;
    }
    setError('');
    setVerifying(true);
    try {
      const res = await fetch('/api/telegram/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.botName) {
        throw new Error(data?.error || 'Token inválido');
      }
      const username = data.botName as string;
      toast.success(`Bot @${username} conectado.`);
      onConnected(username);
    } catch (e: any) {
      setError(e?.message || 'No se pudo conectar con Telegram.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <ModalShell title="Conectar Telegram" accent="sky" icon={<Send className="w-5 h-5 text-sky-400" />} onClose={onClose}>
      <ol className="text-xs text-slate-400 space-y-1.5 mb-4 list-decimal list-inside">
        <li>Abre <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline">@BotFather</a> en Telegram.</li>
        <li>Envía <code className="bg-slate-900 px-1.5 py-0.5 rounded text-sky-300 font-mono">/newbot</code> y sigue las instrucciones (nombre + username terminando en <code className="text-sky-300">_bot</code>).</li>
        <li>BotFather te dará un token tipo <span className="font-mono text-slate-300">123456:ABC-DEF…</span>. Pégalo abajo.</li>
      </ol>

      <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Token del bot</label>
      <div className="relative">
        <input
          type={showToken ? 'text' : 'password'}
          value={token}
          onChange={e => { setToken(e.target.value); setError(''); }}
          placeholder="123456:ABC-DEF1234ghIkl…"
          className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 pr-10 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500/50 font-mono"
          autoFocus
        />
        <button
          type="button"
          onClick={() => setShowToken(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={verifying || !token.trim()}
        className="mt-4 w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {verifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</> : 'Conectar bot'}
      </button>
    </ModalShell>
  );
}

// ──────────────────────────────────────────────────────────
// ModalShell — contenedor reutilizable para modales
// ──────────────────────────────────────────────────────────
function ModalShell({
  title,
  icon,
  accent,
  onClose,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accent: 'emerald' | 'sky';
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ring = accent === 'emerald' ? 'ring-emerald-500/20' : 'ring-sky-500/20';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className={cn('bg-slate-950 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl ring-1', ring)}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-200 hover:bg-white/5 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
