import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, FileText, Download, Eye, MoreVertical, X, ArrowLeft, Paperclip, Upload, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { VentasAPI } from '../../services/db';

type ContractStatus = 'Activo' | 'Pendiente' | 'Finalizado' | 'Cancelado';

interface Contract {
  id: string;
  client: string;
  type: string;
  date: string;
  amount: number;
  status: ContractStatus;
  folio?: string;
  telefono?: string;
}

interface Sale {
  id?: string;
  folio?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  telefonoTitular?: string;
  paqueteNombre?: string;
  rentaMensual?: number;
  status?: string;
  fechaSolicitud?: string;
}

function mapStatus(saleStatus?: string): ContractStatus {
  switch ((saleStatus || '').toUpperCase()) {
    case 'APROBADA':
    case 'PROCEDIO':
      return 'Activo';
    case 'PENDIENTE':
      return 'Pendiente';
    case 'RECHAZADA':
      return 'Cancelado';
    case 'FINALIZADO':
      return 'Finalizado';
    default:
      return 'Pendiente';
  }
}

export default function ContractsManager() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [attachmentsByContract, setAttachmentsByContract] = useState<Record<string, File[]>>({});
  const [isVerifyingFile, setIsVerifyingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const sales: Sale[] = await VentasAPI.getAll();
        const list = sales.map<Contract>(s => ({
          id: s.id || s.folio || '',
          folio: s.folio,
          client: [s.nombres, s.apellidoPaterno, s.apellidoMaterno].filter(Boolean).join(' ') || 'Cliente sin nombre',
          type: s.paqueteNombre || 'Sin paquete',
          date: (s.fechaSolicitud || '').split('T')[0] || '—',
          amount: Number(s.rentaMensual) || 0,
          status: mapStatus(s.status),
          telefono: s.telefonoTitular,
        }));
        setContracts(list);
        setLoadError('');
      } catch (err) {
        setContracts([]);
        setLoadError(err instanceof Error ? err.message : 'Backend no disponible');
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const processFiles = (newFiles: File[]) => {
    if (!selectedContract || newFiles.length === 0) return;
    const fileNames = newFiles.map(f => f.name).join(', ');
    setIsVerifyingFile(false);
    setUploadError(null);
    setAttachmentsByContract(prev => ({
      ...prev,
      [selectedContract.id]: [...(prev[selectedContract.id] || []), ...newFiles],
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files));
  };

  const removeAttachment = (indexToRemove: number) => {
    if (!selectedContract) return;
    setAttachmentsByContract(prev => ({
      ...prev,
      [selectedContract.id]: (prev[selectedContract.id] || []).filter((_, index) => index !== indexToRemove),
    }));
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        contract.client.toLowerCase().includes(q) ||
        contract.id.toLowerCase().includes(q) ||
        (contract.folio || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'Todos' || contract.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [contracts, searchTerm, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Activo': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Pendiente': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Finalizado': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'Cancelado': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID Contrato', 'Folio', 'Cliente', 'Tipo', 'Fecha', 'Monto MXN', 'Estado'];
    const csvContent = [
      headers.join(','),
      ...filteredContracts.map(c =>
        `${c.id},"${c.folio || ''}","${c.client}","${c.type}",${c.date},${c.amount},${c.status}`
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'contratos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (selectedContract) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => setSelectedContract(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded-lg px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Contratos
        </button>

        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{selectedContract.id}</h2>
              <p className="text-slate-400">Detalles del contrato</p>
            </div>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(selectedContract.status)}`}>
              {selectedContract.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">Cliente</h3>
                <p className="text-lg text-white">{selectedContract.client}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">Paquete contratado</h3>
                <p className="text-lg text-white">{selectedContract.type}</p>
              </div>
              {selectedContract.telefono && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Teléfono titular</h3>
                  <p className="text-lg text-white">{selectedContract.telefono}</p>
                </div>
              )}
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">Fecha de solicitud</h3>
                <p className="text-lg text-white">{selectedContract.date}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">Renta mensual</h3>
                <p className="text-lg text-white font-semibold">{formatCurrency(selectedContract.amount)}</p>
              </div>
              {selectedContract.folio && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">Folio</h3>
                  <p className="text-lg text-white">{selectedContract.folio}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-slate-400" />
                Archivos Adjuntos
              </h3>
              <label className={`cursor-pointer flex items-center gap-2 px-4 py-2 border border-white/10 text-white rounded-lg transition-colors ${
                isVerifyingFile ? 'bg-sky-600 border-sky-500 cursor-wait' : 'hover:bg-white/5'
              }`}>
                {isVerifyingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="text-sm font-medium">{isVerifyingFile ? 'Analizando con IA…' : 'Subir Archivo'}</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isVerifyingFile}
                  aria-label="Subir archivos adjuntos"
                />
              </label>
            </div>

            {uploadError && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2" role="alert">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{uploadError}</p>
              </div>
            )}

            <div
              className={`transition-all duration-200 mt-2 ${
                isDragging ? 'bg-sky-500/10 border-sky-500 ring-2 ring-sky-500/50 scale-[1.01]' : 'border-transparent'
              } border-2 rounded-xl p-1`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {(attachmentsByContract[selectedContract.id] || []).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(attachmentsByContract[selectedContract.id] || []).map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 border border-white/10 rounded-lg">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm text-white truncate font-medium">{file.name}</p>
                          <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                        aria-label={`Eliminar archivo ${file.name}`}
                        title="Eliminar archivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-white/10 rounded-xl bg-slate-800/20 flex flex-col items-center justify-center gap-3">
                  <div className="p-3 bg-slate-800 rounded-full">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-slate-300 font-medium">Arrastra tus archivos aquí</p>
                    <p className="text-slate-500 text-sm mt-1">o usa el botón superior para seleccionar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestor de Contratos</h2>
          <p className="text-slate-400 text-sm mt-1">Contratos generados a partir de las ventas capturadas en el CRM.</p>
        </div>
      </div>

      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        {loadError && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            No se pudieron cargar contratos reales del servidor: {loadError}
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por folio, ID o cliente…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-all"
              aria-label="Buscar contratos"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-8 text-sm text-white appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-all w-[180px]"
                aria-label="Filtrar por estado"
              >
                <option value="Todos">Todos los estados</option>
                <option value="Activo">Activos</option>
                <option value="Pendiente">Pendientes</option>
                <option value="Finalizado">Finalizados</option>
                <option value="Cancelado">Cancelados</option>
              </select>
            </div>
            <button
              onClick={handleExportCSV}
              className="p-2.5 bg-slate-800/50 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
              title="Exportar a CSV"
              aria-label="Exportar contratos a CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-sm">
                <th className="py-3 px-4 font-medium">Folio</th>
                <th className="py-3 px-4 font-medium">Cliente</th>
                <th className="py-3 px-4 font-medium">Paquete</th>
                <th className="py-3 px-4 font-medium">Fecha</th>
                <th className="py-3 px-4 font-medium">Renta Mensual</th>
                <th className="py-3 px-4 font-medium">Estado</th>
                <th className="py-3 px-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.length > 0 ? (
                filteredContracts.map((contract) => (
                  <tr
                    key={contract.id}
                    onClick={() => setSelectedContract(contract)}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <td className="py-4 px-4 text-sm font-medium text-white">{contract.folio || contract.id}</td>
                    <td className="py-4 px-4 text-sm text-slate-300">{contract.client}</td>
                    <td className="py-4 px-4 text-sm text-slate-400">{contract.type}</td>
                    <td className="py-4 px-4 text-sm text-slate-400">{contract.date}</td>
                    <td className="py-4 px-4 text-sm font-medium text-slate-200">{formatCurrency(contract.amount)}</td>
                    <td className="py-4 px-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(contract.status)}`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedContract(contract); }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                          aria-label={`Ver detalles de ${contract.client}`}
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <FileText className="w-10 h-10 opacity-30" />
                      <p className="text-sm">
                        {contracts.length === 0
                          ? 'Aún no hay contratos. Captura una venta nueva para generar tu primer contrato.'
                          : 'No se encontraron contratos que coincidan con la búsqueda.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
