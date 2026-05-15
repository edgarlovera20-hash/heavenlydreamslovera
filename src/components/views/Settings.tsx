import React, { useState, useEffect } from 'react';
import { Users, Bot, Smartphone, Download, Upload, Plus, Edit2, Power, AlertTriangle, FileText, BrainCircuit, Trash2, Key, Lock, Eye, EyeOff, BellRing, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { sendPushNotification, requestNotificationPermission } from '../../lib/notifications';
import { AgentDesigner } from './AgentDesigner';
import { toast } from 'sonner';

type Tab = 'usuarios' | 'bot' | 'canales' | 'import_export' | 'integraciones' | 'notificaciones';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('usuarios');

  const tabs = [
    { id: 'usuarios', label: 'Gestión de Usuarios', icon: Users },
    { id: 'bot', label: 'Agentes Inteligentes', icon: Bot },
    { id: 'canales', label: 'Canales y Líneas', icon: Smartphone },
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
  const [isUnlocked, setIsUnlocked] = useState(false);
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

  useEffect(() => {
    if (!isUnlocked) return;
    const saved: any[] = JSON.parse(localStorage.getItem('adhdreams_apikeys') || '[]');
    setKeys(saved);
    const vk = localStorage.getItem('adhdreams_google_vision_key') || '';
    setVisionKeySaved(vk);
    setVisionKey(vk);
  }, [isUnlocked]);

  const handleSaveVisionKey = () => {
    const trimmed = visionKey.trim();
    localStorage.setItem('adhdreams_google_vision_key', trimmed);
    setVisionKeySaved(trimmed);
    setVisionTestResult(null);
    toast.success(trimmed ? 'API key de Google Vision guardada.' : 'API key eliminada.');
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
    if (password === 'admin123' || password === 'admin') { 
      setIsUnlocked(true);
      setError('');
    } else {
      setError('Contraseña incorrecta (Usa: admin)');
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newService && newKey) {
      const newEntry = { id: `key-${Date.now()}`, service: newService, key: newKey, createdAt: new Date().toISOString() };
      const updated = [newEntry, ...keys];
      setKeys(updated);
      localStorage.setItem('adhdreams_apikeys', JSON.stringify(updated));
      toast.success('Llave API guardada con éxito.');
      setNewService('');
      setNewKey('');
    }
  };

  const handleDelete = (id: string) => {
    const updated = keys.filter(k => k.id !== id);
    setKeys(updated);
    localStorage.setItem('adhdreams_apikeys', JSON.stringify(updated));
    toast.success('Llave eliminada.');
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] mb-2">
          <Lock className="w-8 h-8 text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-100">Bóveda de Integraciones</h3>
        <p className="text-slate-400 text-sm text-center max-w-md">
          Introduce la contraseña maestra para conectar nuevas aplicaciones y gestionar las credenciales/llaves API.
        </p>
        <form onSubmit={handleUnlock} className="w-full max-w-sm space-y-3 mt-6">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña maestra (admin)"
            className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-center tracking-widest"
          />
          {error && <p className="text-red-400 text-xs px-1 text-center font-medium">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20">
            Desbloquear Bóveda
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

      {/* ── Google Cloud Vision OCR ─────────────────────── */}
      <div className="bg-gradient-to-br from-blue-950/40 to-slate-900/60 border border-blue-500/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <span className="text-xl">🔍</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
              OCR con Google Cloud Vision
              {visionKeySaved
                ? <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Activo</span>
                : <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">Sin configurar</span>}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Se usa al capturar documentos (INE frente/atrás) para extraer CURP, nombre y domicilio con precisión superior a Tesseract. Necesitas una API key de{' '}
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

function CanalesTab() {
  const [lines, setLines] = useState([
    { id: 1, name: 'Captura y Seguimiento QR (WhatsApp)', type: 'WhatsApp', status: 'Conectada', supportBoth: false },
    { id: 2, name: 'Captura y Seguimiento QR (Telegram)', type: 'Telegram', status: 'Conectada', supportBoth: false },
    { id: 3, name: 'Soporte, Seguimiento y Morosidad', type: 'WhatsApp', status: 'Conectada', supportBoth: true },
    { id: 4, name: 'Línea — Reclutamiento', type: 'WhatsApp', status: 'Conectada', supportBoth: false },
    { id: 5, name: 'Línea — Ventas Externas', type: 'WhatsApp', status: 'Esperando QR', supportBoth: false },
  ]);

  const [configuringId, setConfiguringId] = useState<number | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleConnect = (id: number) => {
    setLines(lines.map(l => l.id === id ? { ...l, status: 'Conectada' } : l));
  };

  const handleDisconnect = (id: number) => {
    setLines(lines.map(l => l.id === id ? { ...l, status: 'Desconectada' } : l));
  };

  const handleTypeChange = (id: number, newType: string) => {
    setLines(lines.map(l => l.id === id ? { ...l, type: newType, status: 'Esperando QR' } : l));
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-amber-400 font-medium text-sm">Escaneo Pendiente</h4>
            <p className="text-amber-400/80 text-xs mt-1">Hay una línea en "Esperando QR". Se requiere escanear el código para activarla.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lines.map(line => (
          <div key={line.id} className="bg-slate-950/80 border border-white/5 rounded-xl p-5 flex flex-col shadow-inner relative">
            <div className="flex justify-between items-start mb-4">
              <div className="font-medium text-slate-100 text-sm leading-tight pr-2">{line.name}</div>
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                line.status === 'Conectada' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                line.status === 'Esperando QR' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
              )}>
                {line.status}
              </span>
            </div>

            {configuringId === line.id ? (
              <div className="mb-5 space-y-3">
                {line.supportBoth && (
                  <div>
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Plataforma</label>
                    <select 
                      value={line.type} 
                      onChange={(e) => handleTypeChange(line.id, e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    >
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Telegram">Telegram</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Número de Teléfono</label>
                  <input 
                    type="text" 
                    placeholder="+52 1 234 567 8900"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 mb-5">{line.type}</div>
            )}

            <div className="mt-auto flex gap-2">
               {configuringId === line.id ? (
                 <>
                  <button 
                    onClick={() => setConfiguringId(null)} 
                    className="flex-1 bg-slate-800/80 hover:bg-slate-700 text-white py-2 rounded-lg text-xs font-medium transition-colors ring-1 ring-white/5"
                  >
                    Guardar
                  </button>
                 </>
               ) : (
                 <>
                  <button 
                    onClick={() => {
                      setConfiguringId(line.id);
                      setPhoneNumber('');
                    }} 
                    className="flex-1 bg-slate-800/80 hover:bg-slate-700 text-white py-2 rounded-lg text-xs font-medium transition-colors ring-1 ring-white/5"
                  >
                    Configurar
                  </button>
                  {line.status === 'Conectada' ? (
                     <button 
                       onClick={() => handleDisconnect(line.id)}
                       className="flex-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 py-2 rounded-lg text-xs font-medium transition-all"
                     >
                       Desconectar
                     </button>
                  ) : (
                    <button 
                      onClick={() => handleConnect(line.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-medium transition-all shadow-lg shadow-blue-500/20"
                    >
                      Conectar
                    </button>
                  )}
                 </>
               )}
            </div>
          </div>
        ))}
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
