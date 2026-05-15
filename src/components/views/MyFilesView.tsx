import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen, CheckCircle2, AlertCircle, Upload,
  Download, FileText, FileImage, Video, PhoneCall,
  Search, Filter, Send, Loader2, FileAudio, FileVideo, FileCode
} from 'lucide-react';
import { auth } from '../../lib/firebase';

interface DocumentStatus {
  id: string;
  name: string;
  isUploaded: boolean;
  type: 'image' | 'pdf' | 'video' | 'audio' | 'mixed';
  optional?: boolean;
}

interface ClientRecord {
  id: string;
  name: string;
  folio: string;
  status: 'completado' | 'incompleto';
  promoterName: string;
  promoterPhone: string;
  docs: DocumentStatus[];
}

interface Sale {
  id?: string;
  folio?: string;
  asesorId?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  telefonoTitular?: string;
  ineFrente?: string;
  ineReverso?: string;
  curpDoc?: string;
  comprobanteDomicilio?: string;
  anexoPortabilidad?: string;
}

function buildClientsFromSales(sales: Sale[], usersMap: Record<string, { displayName?: string; nombre?: string; telefono?: string }>): ClientRecord[] {
  return sales.map<ClientRecord>(s => {
    const promoter = s.asesorId ? usersMap[s.asesorId] : undefined;
    const ineFrente = Boolean(s.ineFrente);
    const ineAtras  = Boolean(s.ineReverso);
    const domicilio = Boolean(s.comprobanteDomicilio);
    const portabilidad = Boolean(s.anexoPortabilidad);
    const docs: DocumentStatus[] = [
      { id: 'ine_frente', name: 'INE Frente', isUploaded: ineFrente, type: 'image' },
      { id: 'ine_atras',  name: 'INE Atrás',  isUploaded: ineAtras,  type: 'image' },
      { id: 'domicilio', name: 'Comprobante de domicilio', isUploaded: domicilio, type: 'image' },
      { id: 'contrato', name: 'Contrato firmado (Aviso priv. / T&C)', isUploaded: false, type: 'pdf' },
      { id: 'llamada', name: 'Llamada de validación', isUploaded: false, type: 'audio' },
      { id: 'videofirma', name: 'Video de videofirma', isUploaded: false, type: 'video' },
      { id: 'siac', name: 'Captura Folio SIAC', isUploaded: false, type: 'image' },
      { id: 'portabilidad', name: 'Anexo de portabilidad', isUploaded: portabilidad, type: 'pdf', optional: true },
    ];
    const allRequired = docs.filter(d => !d.optional).every(d => d.isUploaded);
    return {
      id: s.id || s.folio || `cli-${Math.random().toString(36).slice(2, 9)}`,
      name: [s.nombres, s.apellidoPaterno, s.apellidoMaterno].filter(Boolean).join(' ') || 'Cliente sin nombre',
      folio: s.folio ? `#${s.folio}` : '—',
      status: allRequired ? 'completado' : 'incompleto',
      promoterName: promoter?.displayName || promoter?.nombre || 'Asesor sin nombre',
      promoterPhone: promoter?.telefono || '—',
      docs,
    };
  });
}

export default function MyFilesView({ onBack }: { onBack: () => void }) {
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [isNotifying, setIsNotifying] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<{success: boolean; message: string} | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [clients, setClients] = useState<ClientRecord[]>([]);

  useEffect(() => {
    const load = () => {
      try {
        const sales: Sale[] = JSON.parse(localStorage.getItem('adhdreams_sales') || '[]');
        const users: any[] = JSON.parse(localStorage.getItem('adhdreams_users') || '[]');
        const usersMap: Record<string, any> = {};
        users.forEach(u => { if (u.uid) usersMap[u.uid] = u; });
        // Filter to current user if ASESOR; managers/supervisors see all
        const myRole = (auth.currentUser?.role || '').toUpperCase();
        const visible = myRole === 'ASESOR'
          ? sales.filter(s => s.asesorId === auth.currentUser?.uid)
          : sales;
        setClients(buildClientsFromSales(visible, usersMap));
      } catch {
        setClients([]);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ clientId: string, docId: string, type: 'image' | 'pdf' | 'video' | 'audio' | 'mixed' } | null>(null);
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);

  const triggerUpload = (clientId: string, docId: string, type: 'image' | 'pdf' | 'video' | 'audio' | 'mixed') => {
    setUploadTarget({ clientId, docId, type });
    if (fileInputRef.current) {
      let accept = '*/*';
      if (type === 'image') accept = 'image/*';
      if (type === 'pdf') accept = 'application/pdf';
      if (type === 'video') accept = 'video/*';
      if (type === 'audio') accept = 'audio/*';
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (file && uploadTarget) {
      // Validate file type
      let isValid = true;
      if (uploadTarget.type === 'image' && !file.type.startsWith('image/')) isValid = false;
      if (uploadTarget.type === 'pdf' && file.type !== 'application/pdf') isValid = false;
      if (uploadTarget.type === 'video' && !file.type.startsWith('video/')) isValid = false;
      if (uploadTarget.type === 'audio' && !file.type.startsWith('audio/')) isValid = false;

      if (!isValid) {
        setUploadError(`El archivo seleccionado no es válido para el tipo requerido (${uploadTarget.type}). Por favor, selecciona un archivo correcto.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setUploadTarget(null);
        return;
      }

      const targetRef = { ...uploadTarget };
      setAnalyzingDocId(targetRef.docId);

      // Simulate AI validation for manipulation/editing
      setTimeout(() => {
        setAnalyzingDocId(null);
        
        // Simular un 15% de probabilidad de detectar manipulación para demostración
        // En producción aquí iría la llamada a la API de verificación de la IA
        const isManipulated = Math.random() < 0.15;
        
        if (isManipulated) {
          setUploadError(`⚠️ Alerta de Seguridad IA: El documento "${file.name}" muestra indicios de haber sido modificado digitalmente o generado artificialmente. Sube el documento original sin alteraciones.`);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        // Proceed with upload simulation
        setClients(prev => prev.map(c => {
          if (c.id === targetRef.clientId) {
            const updatedDocs = c.docs.map(d => d.id === targetRef.docId ? { ...d, isUploaded: true } : d);
            const allRequiredUploaded = updatedDocs.filter(d => !d.optional).every(d => d.isUploaded);
            return { ...c, docs: updatedDocs, status: allRequiredUploaded ? 'completado' : 'incompleto' };
          }
          return c;
        }));
        
        // Also update selected client if matching
        if (selectedClient && selectedClient.id === targetRef.clientId) {
          const updatedDocs = selectedClient.docs.map(d => d.id === targetRef.docId ? { ...d, isUploaded: true } : d);
          const allRequiredUploaded = updatedDocs.filter(d => !d.optional).every(d => d.isUploaded);
          setSelectedClient({ ...selectedClient, docs: updatedDocs, status: allRequiredUploaded ? 'completado' : 'incompleto' });
        }
        setNotificationStatus(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 2500);
    }
    
    setUploadTarget(null);
  };

  const notifyPromoter = () => {
    if (!selectedClient) return;
    setIsNotifying(true);
    setNotificationStatus(null);
    
    // Simulate AI or API call to notify the promoter
    setTimeout(() => {
      setIsNotifying(false);
      setNotificationStatus({
        success: true,
        message: `Se ha notificado vía SMS/WhatsApp a ${selectedClient.promoterName} sobre los documentos faltantes.`
      });
    }, 1500);
  };

  if (selectedClient) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <button 
          onClick={() => setSelectedClient(null)}
          className="text-slate-400 hover:text-white flex items-center gap-2 mb-6"
        >
          &larr; Volver a la lista
        </button>

        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
                  Folio: {selectedClient.folio}
                </span>
                {selectedClient.status === 'completado' ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Completado
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Incompleto
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">{selectedClient.name}</h2>
              <p className="text-slate-400">Detalle del expediente y documentos requeridos.</p>
            </div>
            <button className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors">
              <Download className="w-4 h-4" />
              Descargar Expediente Completo
            </button>
          </div>

          {selectedClient.status === 'incompleto' && (
            <div className="p-5 rounded-2xl mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4 bg-slate-900/90 border border-slate-700">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-white text-md">Notificación Automática (IA Agent)</p>
                  <p className="text-sm mt-1 text-slate-400">
                    Faltan documentos en este expediente. Notifica al promotor para que cargue los archivos faltantes: <span className="text-amber-400/90 font-medium">({
                      selectedClient.docs.filter(d => !d.isUploaded && !d.optional).map(d => d.name).join(', ')
                    })</span>
                  </p>
                  {notificationStatus && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      {notificationStatus.message}
                    </div>
                  )}
                </div>
              </div>
              
              <button 
                onClick={notifyPromoter}
                disabled={isNotifying}
                className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-all border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isNotifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Notificando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-blue-400" /> Notificar Promotor
                  </>
                )}
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Documentos del Expediente</h3>
            </div>
            
            {uploadError && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{uploadError}</p>
              </div>
            )}
            
            {/* Hidden file input for file selection */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange} 
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedClient.docs.map((doc) => {
                const getIcon = () => {
                  if (doc.type === 'pdf') return <FileText className="w-5 h-5" />;
                  if (doc.type === 'image') return <FileImage className="w-5 h-5" />;
                  if (doc.type === 'video') return <FileVideo className="w-5 h-5" />;
                  if (doc.type === 'audio') return <FileAudio className="w-5 h-5" />;
                  return <FileText className="w-5 h-5" />;
                };

                return (
                  <div key={doc.id} className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-colors ${doc.isUploaded ? 'bg-slate-800/40 border-slate-700/50' : 'bg-amber-500/5 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${doc.isUploaded ? 'bg-slate-700/50 text-slate-400' : 'bg-amber-500/20 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]'}`}>
                        {getIcon()}
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-200 text-sm flex items-center gap-2">
                          {doc.name}
                          {doc.optional && <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Opcional</span>}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          {doc.isUploaded ? (
                            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Registrado
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Faltante
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {!doc.isUploaded ? (
                      <button 
                        onClick={() => triggerUpload(selectedClient.id, doc.id, doc.type)}
                        disabled={analyzingDocId === doc.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                          analyzingDocId === doc.id 
                            ? 'bg-blue-600 hover:bg-blue-600 border border-blue-500 text-white cursor-wait'
                            : 'bg-amber-500 hover:bg-amber-400 border border-amber-400 text-amber-950'
                        }`}
                      >
                        {analyzingDocId === doc.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="hidden sm:inline">IA Analizando...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span className="hidden sm:inline">Cargar</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button className="flex items-center justify-center w-8 h-8 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button 
        onClick={onBack}
        className="text-slate-400 hover:text-white flex items-center gap-2 mb-6"
      >
        &larr; Volver al menú
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-blue-400" /> Mis Expedientes
          </h2>
          <p className="text-slate-400">Gestiona los documentos y el estado de validación de cada cliente.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por folio o nombre…"
              className="pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 text-slate-200 w-full md:w-64"
              aria-label="Buscar expedientes"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {clients.length === 0 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-10 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <h3 className="text-white font-bold mb-1">Aún no tienes expedientes</h3>
            <p className="text-slate-400 text-sm">Cada venta que registres aparecerá aquí con su lista de documentos requeridos.</p>
          </div>
        )}
        {clients
          .filter(c => {
            const q = searchTerm.trim().toLowerCase();
            if (!q) return true;
            return c.name.toLowerCase().includes(q) || c.folio.toLowerCase().includes(q);
          })
          .map(client => {
          const completedCount = client.docs.filter(d => d.isUploaded).length;
          const totalDocs = client.docs.length;
          const progress = Math.round((completedCount / totalDocs) * 100);

          return (
            <div 
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className="bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded-2xl p-5 hover:border-blue-500/40 hover:bg-slate-800/40 transition-all cursor-pointer group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700">
                      {client.folio}
                    </span>
                    {client.status === 'completado' ? (
                      <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completado
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Incompleto ({totalDocs - completedCount} faltantes)
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">{client.name}</h3>
                </div>

                <div className="flex-1 max-w-xs w-full">
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>Progreso del expediente</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${client.status === 'completado' ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end text-slate-500 group-hover:text-blue-400 transition-colors">
                  <span className="text-sm font-medium mr-2 hidden md:inline">Ver detalles</span>
                  <FolderOpen className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
