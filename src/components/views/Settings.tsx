import React, { useState, useEffect } from 'react';
import { Users, Bot, Smartphone, Download, Upload, Plus, Edit2, Power, AlertTriangle, FileText, BrainCircuit, Trash2, Key, Lock, Eye, EyeOff, BellRing, Loader2, CheckCircle2, QrCode, MessageCircle, Send, X, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { sendPushNotification, requestNotificationPermission } from '../../lib/notifications';
import { AgentDesigner } from './AgentDesigner';
import { toast } from 'sonner';

type Tab = 'usuarios' | 'bot' | 'canales' | 'import_export' | 'integraciones' | 'notificaciones';

type OcrStatus = {
  primary?: string;
  strategy?: string;
  order?: string[];
  orders?: Record<string, string[]>;
  cache?: { entries?: number; ttlMs?: number; maxEntries?: number };
  providers?: Record<string, { configured?: boolean; model?: string; url?: string }>;
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
  const canManageChannels = ['GERENTE', 'ADMIN', 'SUPERUSER'].includes(role);

  const tabs = [
    { id: 'usuarios', label: 'Gestión de Usuarios', icon: Users },
    { id: 'bot', label: 'Agentes Inteligentes', icon: Bot },
    ...(canManageChannels ? [{ id: 'canales' as const, label: 'Cuentas de mensajería', icon: Smartphone }] : []),
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
        {activeTab === 'notificaciones' && <NotificacionesTab />}
        {activeTab === 'integraciones' && <IntegracionesTab />}
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

function IntegracionesTab() {
  const [isUnlocked, setIsUnlocked] = useState(() => currentSessionRole() === 'GERENTE');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [keys, setKeys] = useState<any[]>([]);

  // Google Vision OCR key
  const [visionKey, setVisionKey] = useState('');
  const [visionKeySaved, setVisionKeySaved] = useState('');
  const [showVisionKey, setShowVisionKey] = useState(false);
  const [visionTesting, setVisionTesting] = useState(false);
  const [visionTestResult, setVisionTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus | null>(null);

  useEffect(() => {
    if (!isUnlocked) return;
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const [keysRes, visionRes, ocrRes] = await Promise.all([
          fetch('/api/settings/integration_keys'),
          fetch('/api/settings/google_vision_key'),
          fetch('/api/vision/status'),
        ]);
        if (keysRes.ok) {
          const data = await keysRes.json();
          setKeys(Array.isArray(data.value) ? data.value : []);
        }
        if (visionRes.ok) {
          const data = await visionRes.json();
          const vk = typeof data.value === 'string' ? data.value : '';
          setVisionKeySaved(vk);
          setVisionKey(vk);
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

  const handleSaveVisionKey = async () => {
    const trimmed = visionKey.trim();
    const res = await fetch('/api/settings/google_vision_key', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: trimmed }),
    });
    if (!res.ok) {
      toast.error('No se pudo guardar la API key en el servidor.');
      return;
    }
    setVisionKeySaved(trimmed);
    setVisionTestResult(null);
    toast.success(trimmed ? 'API key de Google Vision guardada en servidor.' : 'API key eliminada.');
  };

  const handleTestVisionKey = async () => {
    const key = visionKey.trim();
    if (!key) return;
    setVisionTesting(true);
    setVisionTestResult(null);
    try {
      // Imagen mínima 1×1 px en PNG base64 — solo para verificar que la key es válida
      const tiny = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ image: { content: tiny }, features: [{ type: 'LABEL_DETECTION', maxResults: 1 }] }] }),
      });
      if (res.ok) {
        setVisionTestResult({ ok: true, msg: 'Conexión exitosa ✓ La API key es válida.' });
      } else {
        const err = await res.json().catch(() => ({})) as any;
        setVisionTestResult({ ok: false, msg: err?.error?.message || `Error ${res.status}` });
      }
    } catch (e: any) {
      setVisionTestResult({ ok: false, msg: e?.message || 'Error de red' });
    } finally {
      setVisionTesting(false);
    }
  };

  const appsDirectory = [
    { id: 'hubspot', name: 'HubSpot CRM', desc: 'Sincroniza contactos y ventas', icon: 'HubSpot', status: 'connected' },
    { id: 'slack', name: 'Slack', desc: 'Recibe alertas en tus canales', icon: 'Slack', status: 'available' },
    { id: 'whatsapp', name: 'WhatsApp Business', desc: 'API Oficial para atención', icon: 'WhatsApp', status: 'connected' },
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

      {/* ── OCR multi-modelo ─────────────────────── */}
      <div className="bg-gradient-to-br from-blue-950/40 to-slate-900/60 border border-blue-500/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <BrainCircuit className="w-6 h-6 text-blue-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              OCR multi-modelo
              {configuredOcrProviders > 0
                ? <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">{configuredOcrProviders} activos</span>
                : <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">Solo local</span>}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Orquestador con Claude, Gemini, OpenAI, Ollama y Tesseract. Al capturar documentos extrae CURP, nombre, domicilio y SIAC con fallback automático. Puedes conservar una API key de{' '}
              <a href="https://console.cloud.google.com/apis/library/vision.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
                Google Cloud Console
              </a>.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showVisionKey ? 'text' : 'password'}
              value={visionKey}
              onChange={e => { setVisionKey(e.target.value); setVisionTestResult(null); }}
              placeholder="AIza…"
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 pr-10 text-slate-100 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={() => setShowVisionKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showVisionKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleTestVisionKey}
            disabled={!visionKey.trim() || visionTesting}
            className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl border border-white/5 transition-colors whitespace-nowrap"
          >
            {visionTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Probar'}
          </button>
          <button
            onClick={handleSaveVisionKey}
            disabled={visionKey.trim() === visionKeySaved}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-colors whitespace-nowrap"
          >
            Guardar
          </button>
        </div>

        {visionTestResult && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${visionTestResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {visionTestResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {visionTestResult.msg}
          </div>
        )}

        {ocrStatus && (
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Estrategia</p>
                <p className="text-sm text-cyan-200 font-semibold">{ocrStatus.strategy || 'adaptive'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Primario INE</p>
                <p className="text-sm text-slate-100 font-semibold">{ocrStatus.primary || 'claude'}</p>
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
  const users = [
    { id: 1, name: 'Edgar Lovera', email: 'edgar@hdreams.com', role: 'Administrador General', status: 'Activo' },
    { id: 2, name: 'Laura Martínez', email: 'laura@hdreams.com', role: 'Promotor Ventas', status: 'Activo' },
    { id: 3, name: 'Carlos Gómez', email: 'carlos@hdreams.com', role: 'Agente Reclutamiento', status: 'Inactivo' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <div className="bg-slate-950/80 border border-white/5 rounded-xl px-5 py-3 shadow-inner">
            <div className="text-[10px] uppercase tracking-wider font-medium text-slate-500 mb-1">Usuarios Registrados</div>
            <div className="text-2xl font-mono font-bold text-slate-100">24</div>
          </div>
          <div className="bg-slate-950/80 border border-white/5 rounded-xl px-5 py-3 shadow-inner">
            <div className="text-[10px] uppercase tracking-wider font-medium text-slate-500 mb-1">Usuarios Activos</div>
            <div className="text-2xl font-mono font-bold text-emerald-400">18</div>
          </div>
        </div>
        <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4" /> Nuevo Usuario
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500 border-b border-white/5">
            <tr>
              <th className="pb-4 font-medium uppercase tracking-wider text-[11px]">Nombre</th>
              <th className="pb-4 font-medium uppercase tracking-wider text-[11px]">Correo</th>
              <th className="pb-4 font-medium uppercase tracking-wider text-[11px]">Rol</th>
              <th className="pb-4 font-medium uppercase tracking-wider text-[11px]">Estado</th>
              <th className="pb-4 font-medium uppercase tracking-wider text-[11px] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-4 font-medium text-slate-100">{user.name}</td>
                <td className="py-4 text-slate-400">{user.email}</td>
                <td className="py-4 text-slate-400">{user.role}</td>
                <td className="py-4">
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider",
                    user.status === 'Activo' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                  )}>
                    {user.status}
                  </span>
                </td>
                <td className="py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-2 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
}

const DEFAULT_CHANNELS: { whatsapp: ChannelState; telegram: ChannelState } = {
  whatsapp: { connected: false },
  telegram: { connected: false },
};

function CanalesTab() {
  // Restricción de rol — solo GERENTE/ADMIN puede ver/configurar canales
  const role = currentSessionRole();
  const isAuthorized = role === 'GERENTE' || role === 'ADMIN';

  const [channels, setChannels] = useState<typeof DEFAULT_CHANNELS>(() => {
    const saved = localStorage.getItem('adhdreams_channels_v2');
    if (saved) {
      try { return { ...DEFAULT_CHANNELS, ...JSON.parse(saved) }; } catch {}
    }
    return DEFAULT_CHANNELS;
  });

  const [connectModal, setConnectModal] = useState<'whatsapp' | 'telegram' | null>(null);

  const persist = (next: typeof channels) => {
    setChannels(next);
    localStorage.setItem('adhdreams_channels_v2', JSON.stringify(next));
  };

  const handleWhatsAppConnected = (phone: string) => {
    persist({ ...channels, whatsapp: { connected: true, identifier: phone, connectedAt: new Date().toISOString() } });
    setConnectModal(null);
  };

  const handleTelegramConnected = (botUsername: string) => {
    persist({ ...channels, telegram: { connected: true, identifier: `@${botUsername}`, connectedAt: new Date().toISOString() } });
    setConnectModal(null);
  };

  const disconnect = (which: 'whatsapp' | 'telegram') => {
    if (!confirm(`¿Desconectar la cuenta de ${which === 'whatsapp' ? 'WhatsApp' : 'Telegram'}? El agente IA dejará de atender los mensajes entrantes.`)) return;
    persist({ ...channels, [which]: { connected: false } });
    toast.success(`${which === 'whatsapp' ? 'WhatsApp' : 'Telegram'} desconectado.`);
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
            El <b className="text-slate-200">Agente IA</b> recibe automáticamente los mensajes que entren por estas cuentas — captura datos, los enruta y notifica a supervisores y vendedores. Solo hay <b className="text-slate-200">una cuenta de cada plataforma</b>.
          </p>
        </div>
      </div>

      {/* Las 2 tarjetas grandes — WhatsApp + Telegram */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ChannelCard
          platform="whatsapp"
          state={channels.whatsapp}
          onConnect={() => setConnectModal('whatsapp')}
          onDisconnect={() => disconnect('whatsapp')}
        />
        <ChannelCard
          platform="telegram"
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
              Cuando una cuenta está conectada, el agente lee los mensajes entrantes, los clasifica (venta, soporte, morosidad, reclutamiento) y distribuye la información al equipo adecuado.
              Los <b className="text-slate-200">supervisores y vendedores no necesitan iniciar sesión</b> en WhatsApp ni Telegram — todo llega a su panel.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <StatusPill label="WhatsApp" connected={channels.whatsapp.connected} accent="emerald" />
              <StatusPill label="Telegram" connected={channels.telegram.connected} accent="sky" />
            </div>
          </div>
        </div>
      </div>

      {connectModal === 'whatsapp' && (
        <WhatsAppQrModal
          onClose={() => setConnectModal(null)}
          onConnected={handleWhatsAppConnected}
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
  state,
  onConnect,
  onDisconnect,
}: {
  platform: 'whatsapp' | 'telegram';
  state: ChannelState;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const isWA = platform === 'whatsapp';
  const accent = isWA ? 'emerald' : 'sky';
  const label = isWA ? 'WhatsApp' : 'Telegram';
  const Icon = isWA ? MessageCircle : Send;
  const description = isWA
    ? 'Vincula tu número escaneando un código QR (igual que WhatsApp Web).'
    : 'Conecta un bot creado en @BotFather usando su token de acceso.';

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
            <h4 className="text-base font-bold text-slate-100">{label}</h4>
            <p className="text-[11px] text-slate-500">Atendido por Agente IA</p>
          </div>
        </div>
        <span
          className={cn(
            'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5',
            state.connected
              ? `bg-${accent}-500/15 text-${accent}-400 border-${accent}-500/30`
              : 'bg-slate-800 text-slate-400 border-white/5',
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              state.connected ? (isWA ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400 animate-pulse') : 'bg-slate-500',
            )}
          />
          {state.connected ? 'Activa' : 'Sin conectar'}
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
          <button
            onClick={onDisconnect}
            className="w-full bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/20 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Power className="w-3.5 h-3.5" /> Desconectar cuenta
          </button>
        </div>
      ) : (
        <div className="relative">
          <p className="text-xs text-slate-400 leading-relaxed mb-4">{description}</p>
          <button
            onClick={onConnect}
            className={cn(
              'w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg',
              isWA
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                : 'bg-sky-600 hover:bg-sky-500 shadow-sky-500/20',
            )}
          >
            {isWA ? <><QrCode className="w-4 h-4" /> Vincular con QR</> : <><Send className="w-4 h-4" /> Conectar bot</>}
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
function WhatsAppQrModal({ onClose, onConnected }: { onClose: () => void; onConnected: (phone: string) => void; }) {
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
      const r = await fetch('/api/whatsapp/init', { method: 'POST' });
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
        const res = await fetch('/api/whatsapp/qr');
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
          toast.success('WhatsApp conectado correctamente con Baileys.');
          setTimeout(() => onConnected('WhatsApp Baileys'), 600);
          clearInterval(poll);
        }
      } catch {
        // ignorar errores transitorios
      }
    }, 2000);

    return () => { cancelled = true; clearInterval(poll); };
  }, [onConnected]);

  const canRetry = status === 'disconnected' && !initializing;

  return (
    <ModalShell title="Vincular WhatsApp" accent="emerald" icon={<MessageCircle className="w-5 h-5 text-emerald-400" />} onClose={onClose}>
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
      </div>
    </ModalShell>
  );
}

// ──────────────────────────────────────────────────────────
// Telegram Bot Modal — pide el token y verifica con getMe.
// Guarda el token en localStorage para uso futuro.
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
      const res = await fetch(`https://api.telegram.org/bot${trimmed}/getMe`);
      const data = await res.json();
      if (!data?.ok || !data?.result?.username) {
        throw new Error(data?.description || 'Token inválido');
      }
      const username = data.result.username as string;
      // Persistir tokens
      const tokens: Record<string, string> = JSON.parse(localStorage.getItem('adhdreams_telegram_bots') || '{}');
      tokens[username] = trimmed;
      localStorage.setItem('adhdreams_telegram_bots', JSON.stringify(tokens));
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
