/**
 * SiacValidator — el vendedor sube la captura de confirmación SIAC
 * y se compara contra los datos capturados en el contrato.
 */
import React, { useState } from 'react';
import { Upload, Phone, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

interface ContractData {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  telefonoTitular?: string;
  correo?: string;
}

interface SiacFields {
  folioSiac?: string;
  servicio?: string;
  nombreCompleto?: string;
  celular?: string;
  correo?: string;
  gastosInstalacion?: string;
}

interface MatchRow {
  label: string;
  contract: string;
  siac: string;
  match: boolean;
}

interface Props {
  contract: ContractData;
  onValidated?: (data: { folioSiac: string; servicio?: string; image: string }) => void;
}

function normalize(s: string = ''): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function phoneOnly(s: string = ''): string {
  return s.replace(/\D/g, '').slice(-10);
}

export function SiacValidator({ contract, onValidated }: Props) {
  const [image, setImage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [siac, setSiac] = useState<SiacFields | null>(null);
  const [rows, setRows] = useState<MatchRow[]>([]);

  const nombreContrato = [contract.nombres, contract.apellidoPaterno, contract.apellidoMaterno]
    .filter(Boolean).join(' ');

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setImage(base64);
      setLoading(true);
      setSiac(null);
      setRows([]);
      try {
        const res = await fetch('/api/vision/siac', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });
        if (!res.ok) throw new Error(`OCR error (${res.status})`);
        const data = await res.json();
        const f: SiacFields = data.fields || {};
        setSiac(f);

        const checks: MatchRow[] = [
          {
            label: 'Nombre completo',
            contract: nombreContrato,
            siac: f.nombreCompleto || '',
            match: normalize(nombreContrato) === normalize(f.nombreCompleto || ''),
          },
          {
            label: 'Celular',
            contract: contract.telefonoTitular || '',
            siac: f.celular || '',
            match: phoneOnly(contract.telefonoTitular) === phoneOnly(f.celular),
          },
          {
            label: 'Correo',
            contract: contract.correo || '',
            siac: f.correo || '',
            match: normalize(contract.correo) === normalize(f.correo),
          },
        ];
        setRows(checks);

        const matched = checks.filter(r => r.match).length;
        const total = checks.filter(r => r.siac || r.contract).length;
        if (matched === total && f.folioSiac) {
          toast.success(`✓ Todos los datos coinciden. Folio SIAC: ${f.folioSiac}`);
          onValidated?.({ folioSiac: f.folioSiac, servicio: f.servicio, image: base64 });
        } else if (f.folioSiac) {
          toast.warning(`${matched}/${total} datos coinciden. Folio SIAC ${f.folioSiac} guardado igual.`, { duration: 6000 });
          onValidated?.({ folioSiac: f.folioSiac, servicio: f.servicio, image: base64 });
        } else {
          toast.warning(`${matched}/${total} datos coinciden. Revisa las diferencias.`, { duration: 6000 });
        }
      } catch (err: any) {
        toast.error(err?.message || 'Error al procesar la captura.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const reset = () => { setImage(''); setSiac(null); setRows([]); };

  return (
    <div className="bg-slate-950/80 border border-purple-500/30 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-purple-400" />
          Validación SIAC
        </h3>
        {image && (
          <button onClick={reset} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
            <X className="w-3 h-3" /> Reiniciar
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Sube la captura de confirmación SIAC. Se comparará automáticamente contra los datos del contrato firmado.
      </p>

      {!image ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="border-2 border-dashed border-purple-500/40 bg-purple-500/10 rounded-xl p-5 text-center hover:bg-purple-500/20 transition-colors cursor-pointer flex flex-col items-center gap-2">
            <input type="file" accept="image/*" className="hidden"
              onChange={e => handleUpload(e.target.files?.[0])} />
            <Upload className="w-6 h-6 text-purple-400" />
            <p className="text-xs text-purple-300 font-bold uppercase tracking-wide">Subir captura</p>
            <p className="text-[10px] text-purple-400/60">PNG, JPG</p>
          </label>
          <label className="border-2 border-dashed border-blue-500/40 bg-blue-500/10 rounded-xl p-5 text-center hover:bg-blue-500/20 transition-colors cursor-pointer flex flex-col items-center gap-2">
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleUpload(e.target.files?.[0])} />
            <Phone className="w-6 h-6 text-blue-400" />
            <p className="text-xs text-blue-300 font-bold uppercase tracking-wide">Tomar foto</p>
            <p className="text-[10px] text-blue-400/60">Pantalla SIAC</p>
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative rounded-xl overflow-hidden border border-purple-500/40 bg-black">
            <img src={image} alt="Captura SIAC" className="w-full max-h-80 object-contain" />
            {loading && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-xs text-purple-300">Escaneando captura…</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {siac?.folioSiac && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                <p className="text-[10px] uppercase text-purple-400 tracking-wider">Folio SIAC</p>
                <p className="text-xl font-bold text-white font-mono">{siac.folioSiac}</p>
                {siac.servicio && <p className="text-xs text-slate-400 mt-1">Servicio: <span className="text-blue-300 font-mono">{siac.servicio}</span></p>}
              </div>
            )}

            {rows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-400">Comparación contra contrato</p>
                {rows.map((r, i) => (
                  <div key={i} className={`rounded-lg p-3 border ${r.match ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/40'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {r.match
                        ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                      <p className={`text-xs font-semibold uppercase tracking-wide ${r.match ? 'text-green-300' : 'text-red-300'}`}>
                        {r.label}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>
                        <p className="text-slate-500">Contrato</p>
                        <p className="text-white truncate" title={r.contract}>{r.contract || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">SIAC</p>
                        <p className={`truncate ${r.match ? 'text-white' : 'text-red-300'}`} title={r.siac}>{r.siac || '—'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {siac?.gastosInstalacion && (
              <div className="bg-slate-900 border border-white/10 rounded-lg p-3">
                <p className="text-[10px] uppercase text-slate-400 tracking-wider">Gastos de instalación (SIAC)</p>
                <p className="text-sm text-white">{siac.gastosInstalacion}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
