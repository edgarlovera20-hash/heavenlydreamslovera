import React, { useState, useRef, useEffect } from 'react';
import { PACKAGE_CATALOG, PackageCatalogItem, ClientType, ServiceSegment, ProductCategory } from '../../configs/package-catalog';
import { ChevronRight, ChevronLeft, CheckCircle2, FileText, Download, Upload, User, MapPin, Wifi, Tv, Phone, Crosshair, Loader2, MessageCircle, X, ScanLine, Sparkles } from 'lucide-react';
import { chatUrl } from '../../lib/channels';
import { cn, formatCurrency } from '../../lib/utils';
import { AnimatedCheckbox } from '../ui/AnimatedCheckbox';
import { MatrixInput } from '../ui/MatrixInput';
import { auth } from '../../lib/firebase';
import { toast } from 'sonner';
import { aiAgent } from '../../services/aiAgent';

interface CustomerCaptureData {
  folio: string;
  tipoCliente: ClientType;
  tipoServicio: ServiceSegment;
  categoriaProducto: ProductCategory;

  // OCR Data
  ineFrente?: string;
  ineReverso?: string;
  curpDoc?: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  folioIne: string;
  
  telefonoTitular: string;
  telefonoReferencia?: string;
  correo?: string;
  
  // Address Data
  mismaDireccionIne: boolean;
  comprobanteDomicilio?: string;
  calle: string;
  numeroExterior: string;
  numeroInterior?: string;
  codigoPostal: string;
  colonia: string;
  ciudad: string;
  delegacion: string;
  entrecalle1: string;
  entrecalle2: string;
  coordenadas: string;

  packageId: string;
  paqueteNombre: string;
  rentaMensual: number;
  megas: string;
  lineasTelefonicas?: number;
  incluyeClaroVideo: boolean;
  antivirus?: string;
  claroDrive?: string;
  infinitumMail?: string;
  streamingElegido?: "netflix" | "hbo_max" | "hbo_max_gratis" | "ninguno";
  plataformasAdicionales?: string[];

  // Portability
  numeroAPortar?: string;
  companiaActual?: string;
  nip?: string;
  anexoPortabilidad?: string;
  anexoPendiente?: boolean;

  fechaSolicitud: string;
}

const PLATAFORMAS_ADICIONALES = [
  { id: 'nfx_basico', provider: 'Netflix', name: 'Básico 2 pantallas con Anuncios', price: 99 },
  { id: 'nfx_estandar', provider: 'Netflix', name: 'Estándar 2 pantallas HD', price: 219 },
  { id: 'nfx_premium', provider: 'Netflix', name: 'Premium 4 pantallas 4K', price: 299 },
  
  { id: 'hbo_estandar', provider: 'HBO Max', name: 'Estándar 2 pantallas HD', price: 149 },
  { id: 'hbo_premium', provider: 'HBO Max', name: 'Premium', price: 199 },
  
  { id: 'dsn_estandar', provider: 'Disney+', name: 'Estándar', price: 219 },
  { id: 'dsn_premium', provider: 'Disney+', name: 'Premium', price: 299 },
  
  { id: 'amazon_prime', provider: 'Amazon Prime', name: 'Suscripción Prime', price: 99 },
  { id: 'mvs_hub', provider: 'mvshub', name: 'Suscripción Básica', price: 119 },
  { id: 'star_tv', provider: 'StarTV Stream', name: 'Suscripción StarTV Stream', price: 99 },
  { id: 'f1_tv', provider: 'F1 TV', name: 'Suscripción F1 TV Pro', price: 129 },
];

export default function NewSaleForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Partial<CustomerCaptureData>>({
    folio: `FOL-${Math.floor(Math.random() * 1000000)}`,
    fechaSolicitud: new Date().toISOString().split('T')[0],
    tipoCliente: 'linea_nueva',
    tipoServicio: 'residencial',
    categoriaProducto: 'infinitum_puro',
    streamingElegido: 'ninguno',
    mismaDireccionIne: true,
    coordenadas: '19.432608, -99.133209' // Default CDMX Zocalo
  });
  
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [docType, setDocType] = useState<'ine' | 'curp'>('ine');
  const [selectedPackage, setSelectedPackage] = useState<PackageCatalogItem | null>(null);
  const [error, setError] = useState<string>('');
  const receiptRef = useRef<HTMLDivElement>(null);
  
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lineWidth, setLineWidth] = useState(2);
  const [lineColor, setLineColor] = useState('#000080');
  const [canvasScale, setCanvasScale] = useState(1);
  const [initialDist, setInitialDist] = useState<number | null>(null);

  const [isVideoFirmaActive, setIsVideoFirmaActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startVideoFirma = async () => {
    setIsVideoFirmaActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera", err);
      alert("No se pudo acceder a la cámara. Por favor verifica los permisos.");
    }
  };

  const stopVideoFirma = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsVideoFirmaActive(false);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = sigCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      // To ensure a dot is drawn if they just click
      draw(e);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = sigCanvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !sigCanvasRef.current) return;
    const canvas = sigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle multi-touch for pinch-to-zoom
    if ('touches' in e && e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      
      if (initialDist === null) {
        setInitialDist(dist);
      } else {
        const factor = dist / initialDist;
        setCanvasScale(prev => Math.min(Math.max(prev * factor, 0.5), 3));
        setInitialDist(dist);
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left) / canvasScale;
    const y = (('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top) / canvasScale;

    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = lineColor;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      setInitialDist(Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      ));
    } else {
      startDrawing(e);
    }
  };

  const handleTouchEnd = () => {
    setInitialDist(null);
    stopDrawing();
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleNext = () => setStep(s => Math.min(s + 1, 5));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const updateForm = (updates: Partial<CustomerCaptureData>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  const getAvailablePackages = () => {
    return PACKAGE_CATALOG.filter((pkg) => {
      return (
        pkg.segment === form.tipoServicio &&
        pkg.category === form.categoriaProducto &&
        pkg.allowedClientTypes.includes(form.tipoCliente as ClientType)
      );
    });
  };

  const handleSelectPackage = (pkg: PackageCatalogItem) => {
    setSelectedPackage(pkg);
    updateForm({
      packageId: pkg.id,
      paqueteNombre: pkg.displayName,
      rentaMensual: pkg.price,
      megas: pkg.internetMbps.toString(),
      lineasTelefonicas: pkg.phoneLines,
      incluyeClaroVideo: pkg.includesClaroVideo,
      antivirus: pkg.antivirus,
      claroDrive: pkg.claroDrive,
      infinitumMail: pkg.infinitumMail,
      streamingElegido: pkg.category === 'infinitum_puro' ? 'hbo_max_gratis' : 'ninguno',
      plataformasAdicionales: [] 
    });
    setError('');
  };

  const shouldShowStreamingChoice = () => {
    return (
      form.tipoServicio === "residencial" &&
      form.categoriaProducto === "doble_play" &&
      selectedPackage?.allowsStreamingChoice
    );
  };

  const frenteInputRef = useRef<HTMLInputElement>(null);
  const reversoInputRef = useRef<HTMLInputElement>(null);

  // Guardar la imagen como base64 en el formulario, sin ejecutar OCR todavía.
  const handleFileSelect = (slot: 'frente' | 'reverso' | 'curp') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => toast.error('No se pudo leer el archivo.');
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (slot === 'frente') updateForm({ ineFrente: base64 });
      else if (slot === 'reverso') updateForm({ ineReverso: base64 });
      else updateForm({ curpDoc: base64 });
    };
    reader.readAsDataURL(file);
    // limpiar el value para permitir reseleccionar el mismo archivo
    event.target.value = '';
  };

  // Ejecuta OCR con Google Vision sobre las imágenes ya subidas.
  const handleScan = async () => {
    const imgs: string[] = [];
    if (docType === 'ine') {
      if (form.ineFrente) imgs.push(form.ineFrente);
      if (form.ineReverso) imgs.push(form.ineReverso);
    } else {
      if (form.curpDoc) imgs.push(form.curpDoc);
    }
    if (imgs.length === 0) {
      toast.error('Sube al menos una imagen antes de escanear.');
      return;
    }

    setIsOcrLoading(true);
    setOcrProgress(0);
    try {
      // Procesar cada imagen secuencialmente y combinar resultados (la última no-vacía gana por campo).
      const merged: Record<string, string> = {};
      for (let i = 0; i < imgs.length; i++) {
        const baseProgress = Math.round((i / imgs.length) * 100);
        const result = await aiAgent.analyzeDocument(imgs[i], 'image/png', (p) => {
          setOcrProgress(baseProgress + Math.round(p / imgs.length));
        });
        if (result) {
          for (const [k, v] of Object.entries(result)) {
            if (v && (!merged[k] || v.length > merged[k].length)) merged[k] = v as string;
          }
        }
      }
      const fields = Object.keys(merged);
      if (fields.length > 0) {
        updateForm(merged);
        toast.success(`OCR completado: ${fields.length} campo${fields.length !== 1 ? 's' : ''} detectado${fields.length !== 1 ? 's' : ''}. Verifica los datos.`);
      } else {
        toast.info('No se pudieron extraer datos. Completa los campos manualmente.', { duration: 5000 });
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      toast.error(err?.message || 'Error al procesar el documento.', { duration: 7000 });
    } finally {
      setIsOcrLoading(false);
      setOcrProgress(0);
    }
  };

  const removeImage = (slot: 'frente' | 'reverso' | 'curp') => {
    if (slot === 'frente') updateForm({ ineFrente: undefined });
    else if (slot === 'reverso') updateForm({ ineReverso: undefined });
    else updateForm({ curpDoc: undefined });
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        updateForm({ coordenadas: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` });
      });
    }
  };

  const exportToPDF = async () => {
    if (!receiptRef.current) return;
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(receiptRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Contrato_${form.folio}_${form.nombres}.pdf`);
    } catch (error) {
      console.error("Error generating PDF", error);
    }
  };

  const handleSaveAndFinish = async () => {
    if (isVideoFirmaActive) stopVideoFirma();
    
    setIsLoading(true);

    try {
      // 1. Copy signature to PDF ref
      const sourceCanvas = sigCanvasRef.current;
      if (sourceCanvas && receiptRef.current) {
        const firmaContainer = receiptRef.current.querySelector('.border-b.h-32') as HTMLDivElement;
        if (firmaContainer) {
          const img = new Image();
          img.src = sourceCanvas.toDataURL();
          img.className = "absolute inset-0 w-full h-full object-contain p-2";
          firmaContainer.innerHTML = '';
          firmaContainer.appendChild(img);
        }
      }
      
      // 2. Save to localStorage
      const saleData = {
        ...form,
        id: `sale-${Date.now()}`,
        asesorId: auth.currentUser?.uid || 'anonymous',
        status: 'PENDIENTE',
        fechaSolicitud: new Date().toISOString()
      };
      const sales: any[] = JSON.parse(localStorage.getItem('adhdreams_sales') || '[]');
      sales.push(saleData);
      localStorage.setItem('adhdreams_sales', JSON.stringify(sales));
      
      // 3. Export PDF
      await exportToPDF();
      
      toast.success('Venta registrada con éxito en el sistema.');
      onBack();
    } catch (err) {
      console.error('Error al guardar la venta:', err);
      toast.error('Error al guardar la venta.');
    } finally {
      setIsLoading(false);
    }
  };

  const availablePackages = getAvailablePackages();
  const steps = [
    { id: 1, label: 'Identidad' },
    { id: 2, label: 'Servicio' },
    { id: 3, label: 'Paquete' },
    { id: 4, label: 'Detalles' },
    { id: 5, label: 'Documentos' }
  ];

  const currentStepLabel = steps.find(s => s.id === step)?.label || '';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Persistent breadcrumb — sticky so the user always knows where they are */}
      <div className="sticky top-0 z-30 -mx-2 px-2 py-3 backdrop-blur-xl bg-slate-950/90 border-b border-white/10 mb-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-white flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded px-1"
            aria-label="Volver al menú"
          >
            <ChevronLeft className="w-3 h-3" /> Menú
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">Nueva Venta</span>
          <span className="text-slate-600">/</span>
          <span className="text-cyber-neon">Paso {step} de {steps.length} · {currentStepLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
          aria-label="Volver al menú"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Registrar Nueva Venta</h1>
          <p className="text-slate-400 text-sm">Captura de expediente y selección de paquete</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-12 px-2 md:px-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-cyber-electric/20 -z-10 rounded-full"></div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-cyber-neon -z-10 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,229,255,0.8)]" style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}></div>
          
          {steps.map((s) => (
            <div key={s.id} className="relative flex flex-col items-center group">
              <div className={cn(
                "w-10 h-10 rounded flex items-center justify-center font-bold text-sm transition-all duration-300 border-2",
                step >= s.id 
                  ? "bg-cyber-neon/20 border-cyber-neon text-cyber-neon shadow-[0_0_15px_rgba(0,229,255,0.5)] scale-110" 
                  : "bg-cyber-dark border-cyber-electric/30 text-cyber-electric/50"
              )}>
                {step > s.id ? <CheckCircle2 className="w-5 h-5 drop-shadow-[0_0_8px_rgba(0,229,255,1)]" /> : s.id}
              </div>
              <div className={cn(
                "absolute top-12 text-[10px] md:text-xs font-bold uppercase tracking-widest whitespace-nowrap text-center transition-colors",
                step === s.id ? "text-white drop-shadow-md" : step > s.id ? "text-cyber-neon" : "text-cyber-electric/50"
              )}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
        
        {/* STEP 1: Identidad y Domicilio */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            
            {/* OCR Section */}
            <div className="bg-slate-950/80 border border-white/10 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-blue-400" /> Documento de Identidad (OCR)
              </h2>
              
              <div className="flex gap-4 mb-6">
                <button 
                  onClick={() => setDocType('ine')}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", docType === 'ine' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}
                >
                  INE / IFE
                </button>
                <button 
                  onClick={() => setDocType('curp')}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", docType === 'curp' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}
                >
                  CURP
                </button>
              </div>

              {/* Inputs ocultos para cada slot */}
              <input type="file" ref={frenteInputRef} onChange={handleFileSelect(docType === 'ine' ? 'frente' : 'curp')} accept="image/*" className="hidden" />
              <input type="file" ref={reversoInputRef} onChange={handleFileSelect('reverso')} accept="image/*" className="hidden" />

              {/* Zonas de carga con preview */}
              <div className={cn('grid gap-4', docType === 'ine' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
                <UploadSlot
                  title={docType === 'ine' ? 'Frente de INE' : 'Documento CURP'}
                  image={docType === 'ine' ? form.ineFrente : form.curpDoc}
                  onPick={() => frenteInputRef.current?.click()}
                  onRemove={() => removeImage(docType === 'ine' ? 'frente' : 'curp')}
                  disabled={isOcrLoading}
                />
                {docType === 'ine' && (
                  <UploadSlot
                    title="Reverso de INE"
                    image={form.ineReverso}
                    onPick={() => reversoInputRef.current?.click()}
                    onRemove={() => removeImage('reverso')}
                    disabled={isOcrLoading}
                  />
                )}
              </div>

              {/* Botón Escanear / Estado del escaneo */}
              {(() => {
                const hasImages = docType === 'ine'
                  ? Boolean(form.ineFrente || form.ineReverso)
                  : Boolean(form.curpDoc);
                if (!hasImages) return null;
                return (
                  <div className="mt-5">
                    {isOcrLoading ? (
                      <div className="bg-gradient-to-r from-blue-600/20 via-blue-500/15 to-blue-600/20 border border-blue-500/30 rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-blue-300 mb-1">Escaneando con Google Vision…</div>
                          <div className="w-full h-2 bg-blue-500/20 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200" style={{ width: `${Math.max(5, ocrProgress)}%` }} />
                          </div>
                        </div>
                        <span className="font-mono text-xs text-blue-300 shrink-0">{ocrProgress}%</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleScan}
                        className="group w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-500/30 ring-1 ring-white/10"
                      >
                        <ScanLine className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span>Escanear con IA y autorellenar campos</span>
                        <Sparkles className="w-4 h-4 opacity-80" />
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Datos Personales */}
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-blue-400" /> Datos Personales
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Nombres</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.nombres || ''} onChange={e => updateForm({ nombres: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Apellido Paterno</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.apellidoPaterno || ''} onChange={e => updateForm({ apellidoPaterno: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Apellido Materno</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.apellidoMaterno || ''} onChange={e => updateForm({ apellidoMaterno: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">CURP</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500 uppercase font-mono" 
                    value={form.curp || ''} onChange={e => updateForm({ curp: e.target.value })} />
                </div>
                {docType === 'ine' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Folio INE (Atrás)</label>
                    <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500 font-mono" 
                      value={form.folioIne || ''} onChange={e => updateForm({ folioIne: e.target.value })} />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Teléfono Titular</label>
                  <MatrixInput type="tel" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.telefonoTitular || ''} onChange={e => updateForm({ telefonoTitular: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Teléfono Referencia</label>
                  <MatrixInput type="tel" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.telefonoReferencia || ''} onChange={e => updateForm({ telefonoReferencia: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Correo Electrónico</label>
                  <MatrixInput type="email" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.correo || ''} onChange={e => updateForm({ correo: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Domicilio */}
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
                <MapPin className="w-5 h-5 text-blue-400" /> Domicilio de Instalación
              </h2>
              
              <div className="glass-panel rounded-xl p-5 mb-6 border-cyber-electric/30">
                <AnimatedCheckbox 
                  checked={form.mismaDireccionIne || false} 
                  onChange={(checked) => updateForm({ mismaDireccionIne: checked })}
                  label="¿La dirección de instalación coincide con la de la INE?"
                />
                
                {!form.mismaDireccionIne && (
                  <div className="mt-4 pt-4 border-t border-cyber-electric/20">
                    <div className="border-2 border-dashed border-amber-500/30 bg-amber-500/10 rounded-xl p-6 text-center hover:bg-amber-500/20 transition-colors cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                      <Upload className="w-6 h-6 text-amber-400 mx-auto mb-2 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                      <p className="text-sm text-amber-400 font-bold uppercase tracking-wider">Subir Comprobante de Domicilio</p>
                      <p className="text-[10px] text-amber-400/60 mt-1 uppercase tracking-widest font-mono">Requerido ya que la dirección no coincide</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Calle</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.calle || ''} onChange={e => updateForm({ calle: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">C.P.</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.codigoPostal || ''} onChange={e => updateForm({ codigoPostal: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">No. Exterior</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.numeroExterior || ''} onChange={e => updateForm({ numeroExterior: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">No. Interior</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.numeroInterior || ''} onChange={e => updateForm({ numeroInterior: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Colonia</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.colonia || ''} onChange={e => updateForm({ colonia: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Ciudad</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.ciudad || ''} onChange={e => updateForm({ ciudad: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Delegación / Municipio</label>
                  <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                    value={form.delegacion || ''} onChange={e => updateForm({ delegacion: e.target.value })} />
                </div>
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Entrecalle 1</label>
                    <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                      value={form.entrecalle1 || ''} onChange={e => updateForm({ entrecalle1: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Entrecalle 2</label>
                    <MatrixInput type="text" className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                      value={form.entrecalle2 || ''} onChange={e => updateForm({ entrecalle2: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Mini Mapa */}
              <div className="bg-slate-950/80 border border-white/10 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-white">Ubicación GPS (Coordenadas)</label>
                  <button onClick={getCurrentLocation} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                    <Crosshair className="w-3 h-3" /> Obtener Ubicación Actual
                  </button>
                </div>
                <MatrixInput type="text" className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white text-sm font-mono mb-3" 
                  value={form.coordenadas || ''} onChange={e => updateForm({ coordenadas: e.target.value })} placeholder="Latitud, Longitud" />
                
                <div className="w-full h-20 bg-slate-800/50 rounded-lg flex items-center justify-center border border-white/5 text-slate-500 text-xs font-mono">
                  📍 Coordenadas: {form.coordenadas || 'No especificadas'}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-8">
              <button onClick={handleNext} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2">
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Configuración del Servicio */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-semibold text-white mb-6">Configuración del Servicio</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">1. Tipo de Contratación</label>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => updateForm({ tipoCliente: 'linea_nueva' })}
                    className={cn("p-4 rounded-xl border text-left transition-all", form.tipoCliente === 'linea_nueva' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20")}>
                    <div className="font-medium">Línea Nueva</div>
                    <div className="text-xs mt-1 opacity-70">Instalación desde cero</div>
                  </button>
                  <button onClick={() => updateForm({ tipoCliente: 'portado', categoriaProducto: 'doble_play' })}
                    className={cn("p-4 rounded-xl border text-left transition-all", form.tipoCliente === 'portado' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20")}>
                    <div className="font-medium">Portabilidad</div>
                    <div className="text-xs mt-1 opacity-70">Conserva su número actual</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">2. Tipo de Servicio</label>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => updateForm({ tipoServicio: 'residencial' })}
                    className={cn("p-4 rounded-xl border text-left transition-all", form.tipoServicio === 'residencial' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20")}>
                    <div className="font-medium">Residencial</div>
                    <div className="text-xs mt-1 opacity-70">Para el hogar</div>
                  </button>
                  <button onClick={() => updateForm({ tipoServicio: 'negocio' })}
                    className={cn("p-4 rounded-xl border text-left transition-all", form.tipoServicio === 'negocio' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20")}>
                    <div className="font-medium">Negocio</div>
                    <div className="text-xs mt-1 opacity-70">Para empresas o locales</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">3. Categoría del Producto</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => updateForm({ categoriaProducto: 'infinitum_puro' })}
                    disabled={form.tipoCliente === 'portado'}
                    className={cn("p-4 rounded-xl border text-left transition-all", 
                      form.categoriaProducto === 'infinitum_puro' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20",
                      form.tipoCliente === 'portado' && "opacity-50 cursor-not-allowed"
                    )}>
                    <div className="font-medium">Infinitum Puro</div>
                    <div className="text-xs mt-1 opacity-70">Solo Internet</div>
                  </button>
                  <button onClick={() => updateForm({ categoriaProducto: 'doble_play' })}
                    className={cn("p-4 rounded-xl border text-left transition-all", form.categoriaProducto === 'doble_play' ? "bg-blue-600/20 border-blue-500 text-white" : "bg-slate-950/80 border-white/10 text-slate-400 hover:border-white/20")}>
                    <div className="font-medium">Doble Play</div>
                    <div className="text-xs mt-1 opacity-70">Internet + Telefonía</div>
                  </button>
                </div>
                {form.tipoCliente === 'portado' && (
                  <p className="text-xs text-amber-400 mt-2">La portabilidad requiere un paquete Doble Play para conservar la línea.</p>
                )}
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button onClick={handlePrev} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-medium">Atrás</button>
              <button onClick={handleNext} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2">
                Ver Paquetes <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Selección de Paquete */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-semibold text-white mb-2">Paquetes Disponibles</h2>
            <p className="text-slate-400 text-sm mb-6">
              Mostrando opciones para: <span className="text-white font-medium capitalize">{form.tipoServicio}</span> • <span className="text-white font-medium capitalize">{form.categoriaProducto?.replace('_', ' ')}</span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {availablePackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handleSelectPackage(pkg)}
                  className={cn(
                    "text-left p-5 rounded-2xl border transition-all hover:-translate-y-1",
                    selectedPackage?.id === pkg.id 
                      ? "bg-blue-600/20 border-blue-500 ring-1 ring-blue-500" 
                      : "bg-slate-950/80 border-white/10 hover:border-white/30 hover:bg-slate-900/80"
                  )}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-white text-lg leading-tight pr-4">{pkg.displayName}</h3>
                    <div className="text-right">
                      <div className="text-xl font-bold text-emerald-400">{formatCurrency(pkg.price)}</div>
                      <div className="text-[10px] text-slate-500 uppercase">Al mes</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Wifi className="w-4 h-4 text-blue-400" /> {pkg.internetMbps} Megas de velocidad
                    </div>
                    {pkg.phoneLines && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Phone className="w-4 h-4 text-blue-400" /> {pkg.phoneLines} línea(s) telefónica(s)
                      </div>
                    )}
                    {pkg.includesClaroVideo && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Tv className="w-4 h-4 text-blue-400" /> Claro Video incluido
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {pkg.claroDrive && <span className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">Drive: {pkg.claroDrive}</span>}
                    {pkg.antivirus && <span className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">Antivirus</span>}
                    {pkg.allowsStreamingChoice && <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs border border-blue-500/30">Streaming a elegir</span>}
                  </div>
                </button>
              ))}
              {availablePackages.length === 0 && (
                <div className="col-span-2 text-center py-12 text-slate-500">
                  No hay paquetes disponibles para esta configuración.
                </div>
              )}
            </div>

            {error && step === 3 && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500 text-red-500 rounded-lg text-sm text-center font-medium">
                {error}
              </div>
            )}
            <div className="flex justify-between mt-8">
              <button onClick={() => { setError(''); handlePrev(); }} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-medium">Atrás</button>
              <button 
                onClick={() => {
                  if (!selectedPackage) {
                    setError('Debes seleccionar un paquete para continuar.');
                    return;
                  }
                  setError('');
                  handleNext();
                }} 
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Extras y Portabilidad */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-semibold text-white mb-6">Detalles Adicionales</h2>

            {form.categoriaProducto === 'infinitum_puro' ? (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center shrink-0 border border-purple-500/50">
                  <Tv className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-purple-300 font-medium">Beneficio Incluido</h3>
                  <p className="text-white text-sm">HBO Max Gratis por 6 meses por contratar paquete Infinitum Puro.</p>
                </div>
              </div>
            ) : shouldShowStreamingChoice() && (
              <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-6">
                <label className="block font-medium text-white mb-2 flex items-center gap-2">
                  <Tv className="w-5 h-5 text-blue-400" /> Elige tu beneficio de streaming por {selectedPackage?.streamingMonths || 6} meses
                </label>
                <select
                  value={form.streamingElegido === 'hbo_max_gratis' ? 'hbo_max' : form.streamingElegido}
                  onChange={(e) => updateForm({ streamingElegido: e.target.value as any })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-blue-500 mt-2"
                >
                  <option value="ninguno">Selecciona una opción (Opcional)</option>
                  <option value="netflix">Netflix</option>
                  <option value="hbo_max">HBO Max</option>
                </select>
              </div>
            )}

            {/* Plataformas Adicionales */}
            <div className="bg-slate-950/80 border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="font-medium text-white flex items-center gap-2 mb-1">
                <Tv className="w-5 h-5 text-blue-400" /> Contratar Plataformas Adicionales
              </h3>
              <p className="text-sm text-slate-400 mb-4">Puedes agregar suscripciones de streaming adicionales con cargo a tu recibo.</p>

              {/* Order total summary */}
              <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl mb-4">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-slate-300">Paquete Base: {form.paqueteNombre || "Sin seleccionar"}</span>
                  <span className="text-white font-medium">${form.rentaMensual || 0}/m</span>
                </div>
                {form.plataformasAdicionales?.map(pid => {
                  const p = PLATAFORMAS_ADICIONALES.find(x => x.id === pid);
                  if (!p) return null;
                  return (
                    <div key={pid} className="flex justify-between items-center text-sm mb-2">
                      <span className="text-slate-400">+ {p.provider} ({p.name})</span>
                      <span className="text-white font-medium">${p.price}/m</span>
                    </div>
                  );
                })}
                <div className="border-t border-white/10 mt-3 pt-3 flex justify-between items-center font-bold">
                  <span className="text-white">Total Mensual Estimado</span>
                  <span className="text-blue-400 text-lg">
                    ${(form.rentaMensual || 0) + (form.plataformasAdicionales?.reduce((acc, pid) => acc + (PLATAFORMAS_ADICIONALES.find(x => x.id === pid)?.price || 0), 0) || 0)}/m
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Netflix y HBO Max combinados por requerimiento "Elegir 1" */}
                {(() => {
                  const netflixHboOptions = PLATAFORMAS_ADICIONALES.filter(p => p.provider === 'Netflix' || p.provider === 'HBO Max');
                  const netflixHboIds = netflixHboOptions.map(o => o.id);
                  const selectedId = form.plataformasAdicionales?.find(id => netflixHboIds.includes(id)) || '';

                  return (
                    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-900/90 backdrop-blur-sm border border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)] col-span-1 md:col-span-2 transition-all hover:bg-slate-900/90">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          Netflix o HBO Max (Elegir 1)
                        </label>
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full uppercase font-bold tracking-tighter border border-blue-500/30">
                          Promoción
                        </span>
                      </div>
                      <select 
                        className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-3 text-white font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer appearance-none transition-all"
                        value={selectedId}
                        onChange={(e) => {
                          const val = e.target.value;
                          let updated = form.plataformasAdicionales?.filter(id => !netflixHboIds.includes(id)) || [];
                          if (val) updated.push(val);
                          updateForm({ plataformasAdicionales: updated });
                        }}
                      >
                        <option value="">🚫 No incluir (Ninguno)</option>
                        <optgroup label="🎬 NETFLIX">
                          {netflixHboOptions.filter(o => o.provider === 'Netflix').map(opt => (
                            <option key={opt.id} value={opt.id}>📺 {opt.name} - ${opt.price}/m</option>
                          ))}
                        </optgroup>
                        <optgroup label="📺 HBO MAX">
                          {netflixHboOptions.filter(o => o.provider === 'HBO Max').map(opt => (
                            <option key={opt.id} value={opt.id}>✨ {opt.name} - ${opt.price}/m</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  );
                })()}

                {/* Demás plataformas individuales */}
                {Object.entries(
                  PLATAFORMAS_ADICIONALES.reduce((acc, curr) => {
                    if (curr.provider === 'Netflix' || curr.provider === 'HBO Max') return acc;
                    if (!acc[curr.provider]) acc[curr.provider] = [];
                    acc[curr.provider].push(curr);
                    return acc;
                  }, {} as Record<string, typeof PLATAFORMAS_ADICIONALES>)
                ).map(([provider, options]) => {
                  const selectedForProvider = form.plataformasAdicionales?.find(id => options.some(o => o.id === id)) || '';
                  
                  return (
                    <div key={provider} className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-900/90 backdrop-blur-sm border border-white/10 transition-all hover:border-white/30 hover:bg-slate-900/90">
                      <label className="text-sm font-black text-slate-300 uppercase tracking-widest">{provider}</label>
                      <select 
                        className="w-full bg-slate-950/80 border border-white/20 rounded-xl p-3 text-white font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer appearance-none transition-all"
                        value={selectedForProvider}
                        onChange={(e) => {
                          const val = e.target.value;
                          const providerIds = options.map(o => o.id);
                          let updated = form.plataformasAdicionales?.filter(id => !providerIds.includes(id)) || [];
                          if (val) updated.push(val);
                          updateForm({ plataformasAdicionales: updated });
                        }}
                      >
                        <option value="">🚫 No incluir {provider}</option>
                        {options.map(opt => (
                          <option key={opt.id} value={opt.id}>✅ {opt.name} - ${opt.price}/m</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {form.tipoCliente === 'portado' && (
              <div className="bg-slate-950/80 border border-white/10 rounded-xl p-6 space-y-4">
                <h3 className="font-medium text-white flex items-center gap-2 mb-4">
                  <Phone className="w-5 h-5 text-blue-400" /> Datos de Portabilidad
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Número a Portar (10 dígitos)</label>
                    <MatrixInput type="tel" maxLength={10} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500" 
                      value={form.numeroAPortar || ''} onChange={e => updateForm({ numeroAPortar: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Compañía Actual</label>
                    <select className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500"
                      value={form.companiaActual || ''} onChange={e => updateForm({ companiaActual: e.target.value })}>
                      <option value="">Seleccionar compañía...</option>
                      <option value="Izzi">Izzi</option>
                      <option value="Totalplay">Totalplay</option>
                      <option value="Megacable">Megacable</option>
                      <option value="Telmex">Telmex (Cambio de domicilio)</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">NIP de Portabilidad</label>
                    <MatrixInput type="text" maxLength={4} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500 font-mono tracking-widest text-center" 
                      value={form.nip || ''} onChange={e => updateForm({ nip: e.target.value })} placeholder="1234" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                  <div 
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${form.anexoPendiente ? 'opacity-50 pointer-events-none border-slate-700 bg-slate-800 text-slate-500' : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400'}`} 
                    onClick={() => updateForm({ anexoPortabilidad: 'uploaded' })}
                  >
                    <Upload className="w-6 h-6 mx-auto mb-2" />
                    <p className={`text-sm font-medium ${form.anexoPendiente ? 'text-slate-400' : 'text-blue-300'}`}>
                      {form.anexoPortabilidad ? '✅ Anexo de Portabilidad Cargado' : 'Subir Anexo de Portabilidad'}
                    </p>
                    <p className={`text-xs mt-1 ${form.anexoPendiente ? 'text-slate-500' : 'text-blue-400/70'}`}>
                      {form.anexoPendiente ? 'Subirá el anexo después' : 'Requerido para el trámite de portabilidad'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-900 border border-white/10 rounded-xl p-4">
                    <AnimatedCheckbox 
                      checked={form.anexoPendiente || false} 
                      onChange={(checked) => {
                        updateForm({ anexoPendiente: checked });
                        if (checked) updateForm({ anexoPortabilidad: undefined });
                      }}
                      label="Subir Anexo de Portabilidad más tarde"
                    />
                  </div>
                </div>
              </div>
            )}

            {!shouldShowStreamingChoice() && form.tipoCliente !== 'portado' && (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No se requieren datos adicionales para este paquete.</p>
              </div>
            )}

            {error && step === 4 && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500 text-red-500 rounded-lg text-sm text-center font-medium">
                {error}
              </div>
            )}
            <div className="flex justify-between mt-8">
              <button onClick={() => { setError(''); handlePrev(); }} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-medium">Atrás</button>
              <button 
                onClick={() => {
                  if (form.tipoCliente === 'portado' && !form.anexoPortabilidad && !form.anexoPendiente) {
                    setError('Debes cargar el Anexo de Portabilidad para continuar o indicar que se subirá después.');
                    return;
                  }
                  setError('');
                  handleNext();
                }} 
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
              >
                Revisar y Generar <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Documento Final */}
        {step === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-semibold text-white mb-6">Firma y Generación de PDF</h2>

            {/* Contrato Template para PDF - Oculto visualmente en móvil para centrarse en la firma, u ocupando espacio limpio */}
            <div className="bg-white text-black p-8 md:p-12 rounded-lg max-w-3xl mx-auto shadow-2xl relative mb-12" ref={receiptRef}>
              
              {/* ENCABEZADO */}
              <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold uppercase">Solicitud de Servicio</h1>
                  <p className="text-sm mt-1">Tipo de Solicitud: <strong>{form.tipoCliente === 'portado' ? 'Portabilidad' : 'Línea Nueva'}</strong></p>
                  <p className="text-sm">Segmento: <strong>{form.tipoServicio === 'residencial' ? 'Residencial' : 'Negocio'}</strong></p>
                </div>
                <div className="text-right text-sm">
                  <p>Asesor: <strong>Sistema Automático</strong></p>
                  <p>Fecha: <strong>{form.fechaSolicitud}</strong></p>
                </div>
              </div>

              {/* DATOS DEL TITULAR */}
              <section className="mb-4">
                <h3 className="font-bold bg-gray-200 px-2 py-1 mb-2 text-sm uppercase">👤 Datos del Titular</h3>
                <div className="grid grid-cols-2 gap-2 text-sm px-2">
                  <div className="col-span-2"><strong>Nombre(s):</strong> {form.nombres || '____________________'}</div>
                  <div className="col-span-2"><strong>Apellidos:</strong> {form.apellidoPaterno || '[Paterno]'} {form.apellidoMaterno || '[Materno]'}</div>
                  <div><strong>CURP:</strong> {form.curp || '____________________'}</div>
                  <div><strong>Folio INE:</strong> {form.folioIne || '____________________'}</div>
                  <div className="col-span-2">
                    <strong>Contacto:</strong> {form.telefonoTitular || '[Tel. Titular]'} {form.telefonoReferencia ? `| ${form.telefonoReferencia}` : ''} | {form.correo || '[E-mail]'}
                  </div>
                </div>
              </section>

              {/* DOMICILIO DE INSTALACIÓN */}
              <section className="mb-4">
                <h3 className="font-bold bg-gray-200 px-2 py-1 mb-2 text-sm uppercase">📍 Domicilio de Instalación</h3>
                <div className="grid grid-cols-1 gap-2 text-sm px-2">
                  <div><strong>Calle y Núm:</strong> {form.calle || '[Calle]'} Ext: {form.numeroExterior || '[Ext]'} {form.numeroInterior ? `Int: ${form.numeroInterior}` : ''}</div>
                  <div><strong>Ubicación:</strong> Col. {form.colonia || '[Colonia]'}, {form.delegacion || '[Delegación]'}, CP {form.codigoPostal || '[CP]'}, {form.ciudad || '[Ciudad]'}</div>
                  <div><strong>Referencias:</strong> Entre {form.entrecalle1 || '[Calle 1]'} y {form.entrecalle2 || '[Calle 2]'}</div>
                  <div><strong>GPS:</strong> {form.coordenadas || '[Coordenadas 📍]'}</div>
                </div>
              </section>

              {/* CONFIGURACIÓN POR TIPO DE SERVICIO */}
              <section className="mb-6">
                <h3 className="font-bold bg-gray-200 px-2 py-1 mb-2 text-sm uppercase">🛠️ Configuración e Información del Servicio</h3>
                <div className="text-sm px-2 space-y-2">
                  {form.tipoCliente === 'portado' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-3 bg-gray-50 border p-2">
                        <div><strong>Número a portar:</strong> {form.numeroAPortar || 'N/A'}</div>
                        <div><strong>Compañía actual:</strong> {form.companiaActual || 'N/A'}</div>
                      </div>
                      <p><strong>1. Costo de Instalación:</strong> $0.00 MXN (Bonificado por promoción).</p>
                      <p><strong>2. Meses Gratis:</strong> El cliente recibirá el 4to, 8vo y 12vo mes sin costo de renta básica.</p>
                      <p><strong>3. Facturación:</strong> El primer pago se realiza bajo la modalidad post-pago.</p>
                      <p><strong>4. Entretenimiento:</strong> {form.tipoServicio === 'residencial' ? 'Incluye Claro Video + Universal. No incluye canales abiertos ni es TV de paga convencional.' : 'Negocio no incluye Claro Video.'}</p>
                      <p><strong>5. Streaming:</strong> 6 meses de cortesía en Netflix o Max. A partir del 7mo mes, se aplicará el cargo adicional vigente.</p>
                    </>
                  ) : (
                    <>
                      <p><strong>1. Costo de Instalación:</strong> $1,600 MXN. Se liquida con un pago inicial de $400 en canales autorizados y el remanente de $1,200 diferido a 12 mensualidades de $100 adicionales al paquete.</p>
                      <p><strong>2. Meses Gratis:</strong> Esta modalidad no cuenta con meses de renta gratuita.</p>
                      <p><strong>3. Entretenimiento:</strong> {form.tipoServicio === 'residencial' ? 'Incluye Claro Video. No incluye canales abiertos.' : 'No incluye Claro Video.'}</p>
                      <p><strong>4. Streaming:</strong> 6 meses de cortesía en Netflix o Max. A partir del 7mo mes, se aplicará el cargo adicional vigente.</p>
                      {form.tipoServicio === 'negocio' && (
                        <p><strong>5. Negocios:</strong> Incluye servicios de valor agregado específicos para comercio/empresa.</p>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* SECCIÓN LEGAL */}
              <section className="mb-8">
                <h3 className="font-bold bg-gray-200 px-2 py-1 mb-2 text-sm uppercase">🔐 Sección Legal</h3>
                <div className="text-xs px-2 text-justify space-y-3">
                  <div className="bg-gray-100 p-3 border-l-4 border-gray-400 font-serif italic text-gray-700">
                    "AUTORIZACIÓN DE DATOS Y VIDEO-FIRMA: El titular autoriza a [Nombre de la Empresa/Distribuidor] para el tratamiento de sus datos personales, sensibles y biométricos contenidos en esta solicitud. El proceso de Video-Firma capturará la imagen, voz y firma autógrafa digital del cliente para validar la identidad, asegurar el consentimiento expreso de la contratación y prevenir fraudes. Esta grabación será resguardada con estrictas medidas de seguridad de acuerdo a la Ley Federal de Protección de Datos Personales en Posesión de Particulares."
                  </div>
                  <p><strong>5/6.</strong> El promotor/asesor <strong>no está autorizado</strong> a realizar cobros en efectivo por la gestión de este servicio.</p>
                  
                  {/* Declaración Final */}
                  <div className="mt-4 p-3 font-bold text-center border-2 border-black bg-gray-50 text-sm">
                    "Doy por aceptada la información aquí plasmada, aceptando los cargos por servicio y adicionales que suman un total mensual de: <span className="underline">${formatCurrency((form.rentaMensual || 0) + (form.plataformasAdicionales?.reduce((acc, pid) => acc + (PLATAFORMAS_ADICIONALES.find(p => p.id === pid)?.price || 0), 0) || 0))}</span>"
                  </div>
                </div>
              </section>
              
              {/* Firmas */}
              <div className="mt-12 grid grid-cols-2 gap-8 text-center pb-8 border-b-2 border-dashed">
                <div>
                   <div className="border-b border-black w-full mb-1 h-32 relative">
                      {/* Firma Capture inside PDF invisibly layered or explicitly requested? 
                          We will capture the signature from the UI and wait for it. */}
                   </div>
                   <p className="font-bold text-xs">Firma del Cliente</p>
                </div>
                <div>
                   <div className="border-b border-black w-full mb-1 h-32 flex items-end justify-center">
                     <span className="text-gray-300 italic mb-2">Automática SIAC</span>
                   </div>
                   <p className="font-bold text-xs">Firma del Asesor</p>
                </div>
              </div>
            </div>

            {/* INTERFAZ DE CIERRE */}
            <div className="max-w-md mx-auto space-y-4 pb-12">
              {!isVideoFirmaActive ? (
                <button 
                  onClick={startVideoFirma} 
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg hover:scale-[1.02] transition-transform"
                >
                  🎥 INICIAR VIDEO-FIRMA
                </button>
              ) : (
                <div className="bg-slate-900 border border-purple-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                  <div className="text-center mb-4">
                    <p className="text-sm text-purple-300 font-medium">Instrucción para el cliente:</p>
                    <p className="text-white font-bold text-sm bg-purple-900/40 p-3 rounded-lg mt-2 border border-purple-500/30">
                      "Diga su nombre completo y que acepta la contratación mientras firma en pantalla"
                    </p>
                  </div>
                  
                  <div className="relative rounded-lg overflow-hidden bg-black/50 aspect-video mb-4 border border-white/10 flex items-center justify-center">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                       <span className="text-xs font-bold text-white shadow-black drop-shadow-md">REC</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                        {['#000000', '#000080', '#ED1C24'].map(color => (
                          <button
                            key={color}
                            onClick={() => setLineColor(color)}
                            className={cn(
                              "w-8 h-8 rounded-md border-2 transition-all",
                              lineColor === color ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                        {[1, 2, 4, 6].map(width => (
                          <button
                            key={width}
                            onClick={() => setLineWidth(width)}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-md transition-all",
                              lineWidth === width ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-700"
                            )}
                          >
                            <div className="bg-current rounded-full" style={{ width: width + 2, height: width + 2 }} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Zoom Digital:</span>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="3" 
                        step="0.1" 
                        value={canvasScale} 
                        onChange={(e) => setCanvasScale(parseFloat(e.target.value))}
                        className="flex-1 accent-blue-500 h-1.5 bg-slate-900 rounded-lg appearance-none"
                      />
                      <span className="text-[10px] text-blue-400 font-mono w-8 text-right">{Math.round(canvasScale * 100)}%</span>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg overflow-hidden border-2 border-dashed border-gray-400 touch-none mb-4 relative h-[200px]">
                      <div 
                        className="absolute inset-0 flex items-center justify-center transition-transform duration-75 origin-center"
                        style={{ transform: `scale(${canvasScale})` }}
                      >
                        <canvas
                          ref={sigCanvasRef}
                          width={400}
                          height={150}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseOut={stopDrawing}
                          onTouchStart={handleTouchStart}
                          onTouchMove={draw}
                          onTouchEnd={handleTouchEnd}
                          className="cursor-crosshair bg-white"
                        />
                      </div>
                      <div className="absolute top-2 left-2 text-[8px] text-gray-400 pointer-events-none uppercase font-bold">
                        Pellizcar para Zoom / 2 Dedos
                      </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button onClick={clearSignature} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-lg text-sm font-medium">
                      Limpiar Firma
                    </button>
                    <button onClick={stopVideoFirma} className="flex-1 bg-red-600 hover:bg-red-500 text-white p-3 rounded-lg text-sm font-medium">
                      Detener Grabación
                    </button>
                  </div>
                </div>
              )}

              <button 
                onClick={handleSaveAndFinish} 
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg hover:scale-[1.02] transition-transform disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '💾 GUARDAR Y FINALIZAR'}
              </button>
              
              <button
                onClick={() => {
                  const mensaje = `Hola ${form.nombres || 'estimado cliente'} 👋, te comparto el comprobante de tu solicitud de servicio *Heavenly Dreams* (Folio: *${form.folio}*). Paquete: *${form.paqueteNombre || '—'}* | Renta: *$${form.rentaMensual || '—'}*/mes. Por favor consérvalo. ¡Gracias por tu preferencia! 🚀`;
                  const waUrl = chatUrl('whatsappClientes') || chatUrl('whatsappVendedores');
                  const phone = waUrl ? waUrl.replace('https://wa.me/', '') : '';
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`, '_blank');
                  onBack();
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg hover:scale-[1.02] transition-transform"
              >
                <MessageCircle className="w-5 h-5" /> ENVIAR COMPROBANTE POR WHATSAPP
              </button>

              <button onClick={handlePrev} className="w-full bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-medium mt-4">
                Atrás
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// UploadSlot — zona de carga con preview
// Antes de subir: dropzone con icono
// Después: miniatura con botón remove + re-subir
// ─────────────────────────────────────────────
function UploadSlot({
  title,
  image,
  onPick,
  onRemove,
  disabled,
}: {
  title: string;
  image?: string;
  onPick: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  if (image) {
    return (
      <div className="relative group rounded-xl overflow-hidden border border-emerald-500/30 bg-emerald-500/5">
        <img src={image} alt={title} className="w-full h-44 object-contain bg-slate-950" />
        <div className="absolute inset-x-0 top-0 p-2 flex items-start justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            {title}
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            title="Eliminar"
            className="p-1.5 bg-black/60 hover:bg-red-500/80 rounded-md text-white transition-colors disabled:opacity-40"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onPick}
          disabled={disabled}
          className="absolute inset-x-0 bottom-0 p-2 text-[11px] font-medium text-slate-200 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
        >
          Cambiar imagen
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 hover:bg-blue-500/5 rounded-xl p-8 text-center transition-colors flex flex-col items-center justify-center min-h-[176px] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Upload className="w-8 h-8 text-slate-500 mb-3" />
      <p className="text-sm text-slate-300 font-medium">Subir {title}</p>
      <p className="text-xs text-slate-500 mt-1">Escaneo por IA activa</p>
    </button>
  );
}
