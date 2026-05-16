import React, { useState, useRef } from 'react';
import { Download, Upload, CreditCard, FileText, Banknote, Search, Calendar, TrendingUp, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';

type Tab = 'seguimiento' | 'comprobantes' | 'bancarios' | 'adelantos' | 'gestion';

// --- MOCK DATA FOR API ---
const mockUsers = [
  { id: 'UUID-123', name: 'Edgar Lovera' },
  { id: 'UUID-456', name: 'Ana García' },
];

const mockSalesData = [
  { folio_siac: '9876543', estatus_pisa: 'Terminado', monto_comision: 500 },
  { folio_siac: '9876550', estatus_pisa: 'En Curso', monto_comision: 350 },
];

export default function Payroll() {
  const [activeTab, setActiveTab] = useState<Tab>('seguimiento');
  const isAdmin = true; // Simulating admin role

  const tabs = [
    { id: 'seguimiento', label: 'Mi Seguimiento', icon: TrendingUp },
    { id: 'comprobantes', label: 'Mis Comprobantes', icon: FileText },
    { id: 'bancarios', label: 'Datos Bancarios', icon: CreditCard },
    { id: 'adelantos', label: 'Adelantos', icon: Banknote },
    ...(isAdmin ? [{ id: 'gestion', label: 'Gestión de Nóminas', icon: Download }] : []),
  ];

  return (
    <div className="p-6 w-full space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight">Nóminas y Comisiones</h1>
          <p className="text-slate-400 text-sm">Gestiona tus pagos, comprobantes y datos bancarios.</p>
        </div>
      </div>

      {/* Horizontal Scrollable Tabs */}
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

      {/* Tab Content */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/5 rounded-2xl p-6 min-h-[500px] shadow-xl">
        {activeTab === 'seguimiento' && <SeguimientoTab />}
        {activeTab === 'comprobantes' && <ComprobantesTab />}
        {activeTab === 'bancarios' && <BancariosTab />}
        {activeTab === 'adelantos' && <AdelantosTab />}
        {activeTab === 'gestion' && <GestionTab isAdmin={isAdmin} />}
      </div>
    </div>
  );
}

function SeguimientoTab() {
  const sales = [
    { id: 'VT-1001', client: 'Juan Pérez', package: 'Triple Play', commission: 500, status: 'Pagado' },
    { id: 'VT-1002', client: 'María García', package: 'Doble Play', commission: 350, status: 'Pendiente' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/80 border border-white/5 rounded-xl p-5 shadow-inner">
          <div className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">VENTAS SEMANA</div>
          <div className="text-2xl font-mono font-bold text-slate-100">2</div>
        </div>
        <div className="bg-slate-950/80 border border-white/5 rounded-xl p-5 shadow-inner">
          <div className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">COMISIÓN ACUMULADA</div>
          <div className="text-2xl font-mono font-bold text-emerald-400">{formatCurrency(850)}</div>
        </div>
        <div className="bg-slate-950/80 border border-white/5 rounded-xl p-5 shadow-inner">
          <div className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">SEMANA ACTIVA</div>
          <div className="text-2xl font-mono font-bold text-slate-100">Semana 42</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500 border-b border-white/5">
            <tr>
              <th className="pb-4 font-medium uppercase tracking-wider text-[11px]">Folio VT</th>
              <th className="pb-4 font-medium uppercase tracking-wider text-[11px]">Cliente</th>
              <th className="pb-4 font-medium uppercase tracking-wider text-[11px]">Paquete</th>
              <th className="pb-4 font-medium uppercase tracking-wider text-[11px] text-right">Comisión</th>
              <th className="pb-4 font-medium uppercase tracking-wider text-[11px] text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sales.map(sale => (
              <tr key={sale.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-4 font-mono font-medium text-slate-100">{sale.id}</td>
                <td className="py-4 text-slate-300">{sale.client}</td>
                <td className="py-4 text-slate-300">{sale.package}</td>
                <td className="py-4 text-right text-emerald-400 font-mono font-medium">{formatCurrency(sale.commission)}</td>
                <td className="py-4 text-right">
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider",
                    sale.status === 'Pagado' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  )}>
                    {sale.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComprobantesTab() {
  return (
    <div className="space-y-6">
      <div className="border-2 border-dashed border-slate-700/50 rounded-2xl p-10 text-center hover:bg-slate-800/30 transition-colors cursor-pointer bg-slate-950/20">
        <Upload className="w-10 h-10 text-slate-500 mx-auto mb-4" />
        <h3 className="text-slate-100 font-medium mb-1">Subir Comprobante</h3>
        <p className="text-slate-400 text-sm">Arrastra tu imagen o PDF aquí, o haz clic para seleccionar</p>
      </div>
      
      <h3 className="text-slate-100 font-medium">Historial de Comprobantes</h3>
      <div className="text-center py-10 text-slate-500 text-sm bg-slate-950/85 rounded-xl border border-white/5">
        No hay comprobantes subidos aún.
      </div>
    </div>
  );
}

function BancariosTab() {
  return (
    <div className="max-w-md space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Banco</label>
        <input type="text" className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50" value="BBVA" readOnly />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Titular de la cuenta</label>
        <input type="text" className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50" value="Edgar Lovera" readOnly />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Número de cuenta</label>
        <input type="text" className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50" value="**** **** **** 1234" readOnly />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">CLABE Interbancaria</label>
        <input type="text" className="w-full bg-slate-950/80 border border-white/5 rounded-xl p-3 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50" value="*** *** *** *** **56 7" readOnly />
      </div>
      <button className="bg-slate-800/80 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ring-1 ring-white/5">
        Editar Datos
      </button>
    </div>
  );
}

function AdelantosTab() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-6 max-w-md shadow-inner">
        <h3 className="text-slate-100 font-medium mb-5">Solicitar Adelanto</h3>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Monto Solicitado</label>
            <input type="number" className="w-full bg-slate-900/90 border border-white/5 rounded-xl p-3 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50" placeholder="$0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Motivo</label>
            <textarea className="w-full bg-slate-900/90 border border-white/5 rounded-xl p-3 text-slate-100 resize-none h-24 focus:outline-none focus:ring-1 focus:ring-blue-500/50" placeholder="Razón del adelanto..." />
          </div>
          <button className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20">
            Enviar Solicitud
          </button>
        </div>
      </div>
    </div>
  );
}

function GestionTab({ isAdmin }: { isAdmin: boolean }) {
  type UIState = 'IDLE' | 'LOADING' | 'PREVIEW' | 'SUCCESS';
  
  const [uiState, setUiState] = useState<UIState>('IDLE');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [week, setWeek] = useState('16');
  const [userId, setUserId] = useState(isAdmin ? 'UUID-123' : 'all');
  const [paymentMethod, setPaymentMethod] = useState('Transferencia Bancaria');
  const [receiptData, setReceiptData] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleFetchData = async () => {
    setUiState('LOADING');
    
    // Simulate API Call
    setTimeout(() => {
      const selectedUser = mockUsers.find(u => u.id === userId) || mockUsers[0];
      const sales = userId === 'all' ? [] : mockSalesData; // Empty if 'all' selected for demo
      
      const subtotal = sales.reduce((acc, v) => acc + v.monto_comision, 0);
      const descuentos = 0; // Simulate no advances for now
      const total_neto = subtotal - descuentos;

      setReceiptData({
        header: {
          empresa: "ADHDREAMS SAS DE CV",
          titulo: "Recibo de Pago de Comisiones",
          semana: parseInt(week),
          anio: parseInt(year)
        },
        personal: {
          promotor_id: selectedUser.id,
          nombre_promotor: selectedUser.name,
          gerente_nombre: "Edgar David Lovera Juárez"
        },
        periodo: {
          fecha_pago: new Date().toISOString().split('T')[0],
          ventas_desde: "2026-04-13",
          ventas_hasta: "2026-04-19"
        },
        metodo_pago: paymentMethod,
        detalle_ventas: sales,
        totales: {
          subtotal,
          descuentos,
          total_neto
        }
      });
      
      setUiState('PREVIEW');
    }, 1000);
  };

  const handleSave = () => {
    // Simulate POST request
    // INSERT INTO payroll_history (promotor_id, week, year, amount, metadata_json) VALUES (...)
    setUiState('SUCCESS');
    setTimeout(() => setUiState('IDLE'), 3000);
  };

  const exportToPDF = async () => {
    if (!receiptRef.current || !receiptData) return;

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
      pdf.save(`Nomina_S${receiptData.header.semana}_${receiptData.personal.nombre_promotor.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Error generating PDF", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8 bg-slate-950/85 p-4 rounded-xl border border-white/5">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Asesor</label>
          <select 
            className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={!isAdmin}
          >
            {isAdmin && <option value="all">Seleccionar asesor...</option>}
            {mockUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Semana</label>
          <input 
            type="number" 
            className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50" 
            value={week}
            onChange={(e) => setWeek(e.target.value)}
          />
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Año</label>
          <input 
            type="number" 
            className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50" 
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button 
            onClick={handleFetchData}
            disabled={uiState === 'LOADING' || userId === 'all'}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all h-[42px] flex items-center shadow-lg shadow-blue-500/20"
          >
            {uiState === 'LOADING' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generar Recibo'}
          </button>
        </div>
      </div>

      {/* UI States */}
      {uiState === 'IDLE' && (
        <div className="text-center py-20 text-slate-500 bg-slate-950/20 rounded-2xl border border-white/5 border-dashed">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Selecciona un asesor y haz clic en "Generar Recibo" para ver la nómina.</p>
        </div>
      )}

      {uiState === 'LOADING' && (
        <div className="text-center py-20 text-slate-500 bg-slate-950/20 rounded-2xl border border-white/5">
          <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-blue-500" />
          <p>Consultando base de datos...</p>
        </div>
      )}

      {uiState === 'SUCCESS' && (
        <div className="text-center py-20 text-emerald-500 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-1">¡Nómina Registrada!</h3>
          <p className="text-emerald-400/80 text-sm">El historial ha sido actualizado correctamente.</p>
        </div>
      )}

      {uiState === 'PREVIEW' && receiptData && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Editable Fields outside the receipt for clean PDF */}
          <div className="mb-6 flex items-center gap-4 bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
            <label className="text-sm font-medium text-blue-400 whitespace-nowrap">Método de Pago:</label>
            <input 
              type="text" 
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                setReceiptData({...receiptData, metodo_pago: e.target.value});
              }}
              className="bg-black/40 border border-blue-500/30 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1 max-w-xs"
            />
          </div>

          {/* Receipt Template (Target for PDF) */}
          <div className="bg-white text-slate-900 p-10 rounded-sm max-w-3xl mx-auto shadow-2xl relative" ref={receiptRef}>
            <div className="text-center border-b-2 border-slate-900 pb-5 mb-8">
              <h2 className="font-bold text-2xl tracking-tight">{receiptData.header.empresa}</h2>
              <p className="text-sm text-slate-600 mt-1">Avenida Tláhuac 3632, Interior A301, Colonia Culhuacán CTM Zona VIII, C.P. 09800, Iztapalapa, CDMX</p>
              <h3 className="font-bold mt-4 text-lg">{receiptData.header.titulo}</h3>
              <p className="text-sm font-medium">Semana {receiptData.header.semana} del Año {receiptData.header.anio}</p>
            </div>

            <div className="space-y-5 text-sm text-justify leading-relaxed">
              <p>
                Yo, <strong>{receiptData.personal.nombre_promotor}</strong>, recibo el pago de mis comisiones por mis ventas 
                posteadas de la empresa Heavenly Dreams SAS de CV y del gerente {receiptData.personal.gerente_nombre}, 
                correspondiente a la semana en curso.
              </p>
              <p>
                Recibiendo el pago el día <strong>{receiptData.periodo.fecha_pago}</strong>, que abarca mis ventas posteadas 
                del día <strong>{receiptData.periodo.ventas_desde}</strong> al día <strong>{receiptData.periodo.ventas_hasta}</strong>.
              </p>
              <p>
                Recibiendo y aceptando el esquema de comisiones, recibiendo el pago por un 
                total neto de <strong>{formatCurrency(receiptData.totales.total_neto)}</strong> vía <strong>{receiptData.metodo_pago}</strong>.
              </p>
            </div>

            <div className="mt-10">
              <table className="w-full text-sm border-collapse border border-slate-300">
                <thead className="bg-slate-200/50">
                  <tr>
                    <th className="border border-slate-300 p-3 text-left font-semibold">Folio SIAC</th>
                    <th className="border border-slate-300 p-3 text-left font-semibold">Estatus PISA</th>
                    <th className="border border-slate-300 p-3 text-right font-semibold">Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.detalle_ventas.length > 0 ? (
                    receiptData.detalle_ventas.map((venta: any, idx: number) => (
                      <tr key={idx}>
                        <td className="border border-slate-300 p-3">{venta.folio_siac}</td>
                        <td className="border border-slate-300 p-3">{venta.estatus_pisa}</td>
                        <td className="border border-slate-300 p-3 text-right">{formatCurrency(venta.monto_comision)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="border border-slate-300 p-6 text-center italic text-slate-500 bg-slate-50/50">
                        No hay folios posteados en esta semana
                      </td>
                    </tr>
                  )}
                </tbody>
                {receiptData.detalle_ventas.length > 0 && (
                  <tfoot className="bg-slate-50 font-semibold">
                    <tr>
                      <td colSpan={2} className="border border-slate-300 p-3 text-right">Subtotal:</td>
                      <td className="border border-slate-300 p-3 text-right">{formatCurrency(receiptData.totales.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-slate-300 p-3 text-right text-red-600">Descuentos/Adelantos:</td>
                      <td className="border border-slate-300 p-3 text-right text-red-600">-{formatCurrency(receiptData.totales.descuentos)}</td>
                    </tr>
                    <tr className="bg-slate-200">
                      <td colSpan={2} className="border border-slate-300 p-3 text-right text-lg">Total Neto:</td>
                      <td className="border border-slate-300 p-3 text-right text-lg">{formatCurrency(receiptData.totales.total_neto)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="mt-24 grid grid-cols-2 gap-10 text-center">
              <div>
                <div className="border-b border-slate-900 w-56 mx-auto mb-3"></div>
                <p className="text-sm font-bold">Firma del Promotor/Supervisor</p>
                <p className="text-xs text-slate-600 mt-1">{receiptData.personal.nombre_promotor}</p>
              </div>
              <div>
                <div className="border-b border-slate-900 w-56 mx-auto mb-3"></div>
                <p className="text-sm font-bold">Firma del Gerente</p>
                <p className="text-xs text-slate-600 mt-1">{receiptData.personal.gerente_nombre}</p>
              </div>
            </div>

            <div className="mt-16 text-center text-xs text-slate-500">
              <p>Documento generado el {new Date().toLocaleString()}</p>
              <p className="mt-1">Heavenly Dreams SAS de CV — Todos los derechos reservados.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-8">
            <button 
              onClick={exportToPDF}
              className="bg-slate-800/80 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors h-11 flex items-center ring-1 ring-white/5 gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar PDF
            </button>
            <button 
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all h-11 flex items-center shadow-lg shadow-emerald-500/20 gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Registrar Nómina
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
