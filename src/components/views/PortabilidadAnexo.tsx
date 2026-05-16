/**
 * Anexo Único — Formato de Solicitud de Portabilidad de Número(s) Telefónico(s)
 * Se auto-llena con los datos del cliente y puede imprimirse / exportarse a PDF.
 */
import React, { useRef, useState } from 'react';
import { Download, Printer, X, Phone } from 'lucide-react';

interface AnexoData {
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombres?: string;
  numeroAPortar?: string;
  companiaActual?: string;
  nip?: string;
  fechaSolicitud?: string;
  folio?: string;
}

interface Props {
  data: AnexoData;
  onClose?: () => void;
}

const PROVEEDORES_DONANTES = [
  { nombre: 'AXTEL S.A.B. DE C.V.', codigo: '155' },
  { nombre: 'MAXCOM TELECOMUNICACIONES S.A. DE C.V.', codigo: '144' },
  { nombre: 'MARCATEL COM S.A. DE C.V.', codigo: '177' },
  { nombre: 'ALESTRA S. DE R.L. DE C.V.', codigo: '189' },
];

const COMPANIA_CODIGOS: Record<string, string> = {
  'Axtel': '155', 'Maxcom': '144', 'Marcatel': '177', 'Alestra': '189',
};

function Cell({ w = 1, h = 1, children, className = '' }: { w?: number; h?: number; children?: React.ReactNode; className?: string; [key: string]: any }) {
  return (
    <div
      className={`border border-black flex items-center justify-center text-[9px] font-mono ${className}`}
      style={{ width: w * 16, height: h * 16 }}
    >
      {children}
    </div>
  );
}

function BoxRow({ count, value = '' }: { count: number; value?: string }) {
  const chars = value.split('');
  return (
    <div className="flex">
      {Array.from({ length: count }).map((_, i) => (
        <Cell key={i}>{chars[i] || ''}</Cell>
      ))}
    </div>
  );
}

export function PortabilidadAnexo({ data, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);

  const hoy = data.fechaSolicitud || new Date().toISOString().split('T')[0];
  const [yy, mm, dd] = hoy.split('-');
  const fecha = `${yy.slice(2)}${mm}${dd}`;
  const hora = new Date().toTimeString().slice(0, 5).replace(':', '');
  const codigoDonante = COMPANIA_CODIGOS[data.companiaActual || ''] || '';
  const esOtro = data.companiaActual && !COMPANIA_CODIGOS[data.companiaActual];

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) return;
    setPrinting(true);
    w.document.write(`
      <html><head><title>Anexo Portabilidad</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 9pt; }
        .border { border: 1px solid black; }
        @media print { body { margin: 5mm; } }
      </style></head>
      <body>${el.innerHTML}</body></html>
    `);
    w.document.close();
    setTimeout(() => { w.print(); setPrinting(false); }, 500);
  };

  const handlePDF = async () => {
    if (!printRef.current) return;
    setPrinting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'), import('jspdf'),
      ]);
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#fff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, w, h);
      pdf.save(`Anexo_Portabilidad_${nombreCompleto || 'cliente'}.pdf`);
    } finally {
      setPrinting(false);
    }
  };

  const nombreCompleto = [data.apellidoPaterno, data.apellidoMaterno, data.nombres].filter(Boolean).join(' ');

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center overflow-y-auto py-6 px-4">
      {/* Toolbar */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-blue-400" />
          <span className="text-white font-semibold">Anexo de Portabilidad — Telmex</span>
          <span className="text-slate-400 text-sm">(auto-llenado)</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} disabled={printing}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors disabled:opacity-50">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button onClick={handlePDF} disabled={printing}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" /> Descargar PDF
          </button>
          {onClose && (
            <button onClick={onClose} className="bg-slate-800 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Formulario imprimible */}
      <div ref={printRef} className="bg-white w-full max-w-4xl p-8 rounded shadow-xl text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt' }}>

        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-blue-700 font-bold text-lg">ANEXO ÚNICO</p>
            <p className="font-bold text-sm">FORMATO DE SOLICITUD DE PORTABILIDAD DE NÚMERO(S) TELEFÓNICO(S)</p>
          </div>
          <div className="text-right">
            <p className="text-blue-700 font-black text-2xl tracking-tight">TELMEX<span className="text-sm align-super">®</span></p>
            <p className="text-blue-700 text-xs">está contigo</p>
          </div>
        </div>

        {/* Folio / Fecha / Hora */}
        <div className="flex items-center gap-6 mb-3 border border-black p-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs">FOLIO:</span>
            <BoxRow count={12} value={data.folio || ''} />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="font-bold text-xs">FECHA</span>
            <div>
              <div className="flex gap-1 text-[7px] text-center">
                <span style={{width:32}}>a a</span>
                <span style={{width:16}}>m m</span>
                <span style={{width:16}}>d d</span>
              </div>
              <BoxRow count={6} value={fecha} />
            </div>
            <span className="font-bold text-xs ml-2">HORA</span>
            <div>
              <div className="flex gap-1 text-[7px] text-center">
                <span style={{width:16}}>h h</span>
                <span style={{width:16}}>m m</span>
              </div>
              <BoxRow count={4} value={hora} />
            </div>
          </div>
        </div>

        {/* Datos del Usuario */}
        <div className="border border-black p-2 mb-3">
          <div className="flex items-center gap-6 mb-2">
            <span className="font-bold text-xs">DATOS DEL USUARIO</span>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 border border-black flex items-center justify-center">✓</div>
              <span>PERSONA FÍSICA</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 border border-black" />
              <span>PERSONA MORAL</span>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="font-bold text-xs whitespace-nowrap">NOMBRE DEL SUSCRIPTOR:</span>
            <div className="flex-1 border-b border-black pb-0.5 text-xs font-semibold">
              {nombreCompleto || '_____________________________'}
            </div>
          </div>
          <div className="flex justify-end gap-8 text-[8px] text-gray-500 mt-0.5 pr-4">
            <span>Apellido Paterno</span>
            <span>/</span>
            <span>Apellido Materno</span>
            <span>/</span>
            <span>Nombre(s)</span>
          </div>
        </div>

        {/* Tipo de servicio */}
        <p className="font-bold text-xs mb-1">ELIJA EL TIPO DE SERVICIO EN EL QUE DESEA REALIZAR LA PORTABILIDAD:</p>
        <div className="border border-black p-2 mb-3 space-y-1 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-gray-500">A</span>
            <div className="w-14 border border-black px-1 py-0.5 text-[9px]">FIJO:</div>
            <div className="flex-1 border-b border-black" />
            <div className="w-4 h-4 border border-black" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500">B</span>
            <div className="w-14 border border-black px-1 py-0.5 text-[9px]">MÓVIL:</div>
            <span className="text-[9px]">EL QUE RECIBE PAGA (MPP)</span>
            <div className="w-4 h-4 border border-black" />
            <span className="text-[9px] ml-8">EL QUE LLAMA PAGA (CPP)</span>
            <div className="w-4 h-4 border border-black" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500">C</span>
            <div className="border border-black px-1 py-0.5 text-[9px]">NÚMERO NO GEOGRÁFICO:</div>
            <span className="text-[9px] ml-auto">01 800 + 7 DÍGITOS, 01 900 + 7 DÍGITOS, etc.</span>
            <div className="w-4 h-4 border border-black" />
          </div>
        </div>

        {/* Datos de proveedores */}
        <div className="border border-black mb-3">
          <div className="text-center font-bold text-xs bg-gray-100 border-b border-black p-1">
            DATOS DEL PROVEEDOR DE SERVICIOS DE TELECOMUNICACIONES
          </div>
          <div className="grid grid-cols-2 divide-x divide-black text-xs">
            {/* Donante */}
            <div className="p-2">
              <p className="font-bold text-[9px] mb-2">NOMBRE DE LA EMPRESA PRESTADORA DEL SERVICIO ACTUAL (PROVEEDOR DONANTE):</p>
              {PROVEEDORES_DONANTES.map(p => (
                <div key={p.codigo} className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full border border-black flex items-center justify-center text-[7px] ${codigoDonante === p.codigo ? 'bg-black text-white' : ''}`}>
                    {codigoDonante === p.codigo ? '●' : ''}
                  </div>
                  <span className="text-[8px] flex-1">{p.nombre}</span>
                  <div className="flex border border-black">
                    {p.codigo.split('').map((c, i) => <div key={i} className="w-4 h-4 border-r last:border-r-0 border-black flex items-center justify-center text-[8px]">{c}</div>)}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-3 h-3 rounded-full border border-black flex items-center justify-center text-[7px] ${esOtro ? 'bg-black text-white' : ''}`}>{esOtro ? '●' : ''}</div>
                <span className="text-[8px]">OTRO</span>
                <div className="flex-1 border-b border-black text-[8px] pl-1">{esOtro ? data.companiaActual : ''}</div>
                <div className="flex border border-black">
                  {[0,1].map(i => <div key={i} className="w-4 h-4 border-r last:border-r-0 border-black" />)}
                </div>
              </div>
            </div>
            {/* Receptor */}
            <div className="p-2">
              <p className="font-bold text-[9px] mb-2">NOMBRE DE LA NUEVA EMPRESA PRESTADORA DEL SERVICIO (PROVEEDOR RECEPTOR):</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full border border-black flex items-center justify-center text-[7px] bg-black text-white">●</div>
                <span className="text-[8px] flex-1">TELÉFONOS DE MÉXICO S.A.B. DE C.V.<br/>Local (Geográfica)</span>
                <div className="flex border border-black">
                  {['1','2','5'].map((c, i) => <div key={i} className="w-4 h-4 border-r last:border-r-0 border-black flex items-center justify-center text-[8px]">{c}</div>)}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full border border-black" />
                <span className="text-[8px] flex-1">TELÉFONOS DE MÉXICO S.A.B. DE C.V.<br/>NÚMERO 800, 900 (No. Geográfico)</span>
                <div className="flex border border-black">
                  {['1','2','3'].map((c, i) => <div key={i} className="w-4 h-4 border-r last:border-r-0 border-black flex items-center justify-center text-[8px]">{c}</div>)}
                </div>
              </div>
              <p className="text-[8px] font-bold mb-1">FECHA EN LA QUE SE SOLICITA SE EJECUTE</p>
              <BoxRow count={6} />
              <p className="text-[7px] text-gray-400">a a m m d d</p>
            </div>
          </div>
        </div>

        {/* Números a portar */}
        <p className="font-bold text-xs mb-1">ANOTAR EL O LO(S) NÚMERO(S) TELEFÓNICO(S) A SER PORTADO(S):</p>
        <div className="border border-black mb-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center border-b last:border-b-0 border-black">
              <div className="w-6 border-r border-black flex items-center justify-center text-xs py-0.5">{i + 1}</div>
              <div className="flex-1 flex px-2 py-0.5 gap-0.5">
                <BoxRow count={10} value={i === 0 ? (data.numeroAPortar || '') : ''} />
              </div>
              <div className="border-l border-black px-2 flex items-center gap-1">
                <span className="text-xs font-bold">NIP</span>
                <BoxRow count={4} value={i === 0 ? (data.nip || '') : ''} />
              </div>
            </div>
          ))}
        </div>

        {/* Intervalo */}
        <div className="text-center mb-3">
          <p className="font-bold text-xs mb-2">O EL INTERVALO DE NÚMERO(S) TELEFÓNICO(S) A SER PORTADO(S):</p>
          <div className="flex flex-col items-center gap-1">
            <BoxRow count={10} />
            <span className="font-bold text-xs">AL</span>
            <BoxRow count={10} />
          </div>
        </div>

        {/* Página 2 / notas */}
        <div className="border-t-2 border-black mt-6 pt-4">
          <div className="flex justify-end mb-4">
            <p className="text-[8px] text-gray-500 text-right">ANOTAR EL TOTAL DE NÚMEROS SOLICITADOS (Incluyendo Anexos): <span className="border border-black px-3">&nbsp;&nbsp;&nbsp;</span> SE ANEXAN <span className="border border-black px-2">&nbsp;</span> HOJAS AL PRESENTE FORMATO</p>
          </div>

          <p className="font-bold text-xs mb-2">NOTAS</p>
          <ol className="text-[8px] space-y-1 list-decimal pl-4">
            <li>"El Usuario acepta que con la firma de la presente Solicitud de Portabilidad manifiesta su consentimiento de terminar la relación contractual con su actual proveedor de servicios, únicamente en lo que respecta a los servicios de telecomunicaciones cuya prestación requiere de los números telefónicos a ser portados, a partir de la fecha efectiva en que se realice la portabilidad de los mismos".</li>
            <li>"El Usuario acepta que el portar su(s) número(s), no lo exime del cumplimiento de las obligaciones que haya contraído por la relación contractual con su actual proveedor de servicios..."</li>
            <li>"El Usuario reconoce que la Portabilidad del(os) número(s) solicitada está sujeta al cumplimiento de todos los requisitos establecidos de las Reglas de Portabilidad".</li>
            <li>"El firmante declara bajo protesta de decir la verdad que los datos asentados en la presente solicitud y, en su caso, los documentos que la acompañan son verdaderos".</li>
            <li>"El Usuario reconoce que la Portabilidad se aplica únicamente del Servicio Fijo al Servicio Fijo; del Servicio Móvil al Servicio Móvil bajo la misma Modalidad de Contratación..."</li>
            <li>"El horario para que el Usuario solicite el trámite de Portabilidad presentando al efecto el Formato de Solicitud de Portabilidad respectivo, será de las 11:00 horas a las 17:00 horas, de lunes a sábado..."</li>
            <li>"Los Datos Personales del Usuario contenidos o que acompañen el Formato de Solicitud de Portabilidad, serán tratados con base en los dispuesto por la Ley de Protección de Datos Personales en Posesión de Particulares..."</li>
            <li>"El consentimiento que en su caso hubiere otorgado previamente el Usuario al Proveedor Donador u Concesionario Donador, para la recepción de llamadas de promoción de servicios o paquetes... se tendrá por revocado con la presentación de esta solicitud".</li>
          </ol>
          <p className="text-[8px] mt-2">Para mayor información sobre la Portabilidad Numérica ingrese a la página http://www.ift.org.mx/ o marque al número 01 800 200 0120.</p>

          {/* Firma */}
          <div className="flex justify-between mt-12 pt-4 border-t border-black">
            <div className="text-center w-64">
              <div className="border-b border-black mb-1 pb-6">
                <span className="text-[8px] font-mono italic">{nombreCompleto}</span>
              </div>
              <p className="text-[8px]">Nombre del Usuario / Representante Legal</p>
            </div>
            <div className="text-center w-64">
              <div className="border-b border-black mb-1 pb-6" />
              <p className="text-[8px]">Firma</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
