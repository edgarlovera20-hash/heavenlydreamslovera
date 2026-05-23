import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileSpreadsheet, Upload, Search, Filter, Download,
  RefreshCw, CheckCircle2, Clock, AlertTriangle, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { parseSIACCsv, saveSIAC, loadSIAC, SIACRecord } from '../../lib/siacParser';
import { exportToCSV } from '../../lib/exportUtils';
import { logAudit } from '../../lib/auditLog';
import { auth } from '../../lib/firebase';
import { SiacAPI } from '../../services/db';
import { toast } from 'sonner';

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ABIERTA:  { label: 'Abierta',  color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',   icon: <Clock className="w-3 h-3" /> },
  POSTEADA: { label: 'Posteada', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
};

const PAGE_SIZE = 50;

function serverToSIACRecord(row: any): SIACRecord {
  const paquete = row.paquete || '';
  return {
    id: row.id || `siac-${row.folio_siac}`,
    estatus: row.estatus_siac || '',
    fechaCaptura: row.fecha_captura || '',
    folioSiac: row.folio_siac || '',
    elaboracion: row.estatus_pisa || row.estatus_etapa || '',
    paquete,
    precio: 0,
    tipoCliente: row.linea_contratada || row.tipo_servicio || '',
    area: row.area || row.zona || '',
    estrategia: row.estrategia || '',
    nombrePromotor: row.promotor || '',
    usuarioPromotor: row.promotor || '',
    ordenServicio: row.os_alta || '',
    numPortar: row.telefono_portado || row.telefono_referencia || '',
    telefonoAsignado: row.telefono_asignado || '',
    fechaPosteo: row.fecha_os_alta || row.fecha_cambio_estatus || '',
    tienda: row.tienda || '',
    etapa: row.estatus_etapa || row.estatus_pisa || '',
    error: [row.motivo_rechazo, row.respuesta_telmex, row.observaciones].filter(Boolean).join(' · '),
    osPago: row.observaciones?.startsWith('OS DE PAGO:') ? row.observaciones.replace('OS DE PAGO:', '').trim() : '',
    telTelmex: row.telefono_referencia || row.telefono_portado || '',
    tipoLinea: row.tipo_cliente || row.tipo_linea || '',
    zona: row.zona || '',
    email: row.correo || '',
    numCelular: row.telefono_referencia || '',
  };
}

function siacRecordToServerRow(record: SIACRecord) {
  return {
    folio_siac: record.folioSiac,
    fecha_captura: record.fechaCaptura,
    estrategia: record.estrategia,
    promotor: record.nombrePromotor || record.usuarioPromotor,
    estatus_siac: record.estatus,
    tipo_linea: record.tipoCliente,
    linea_contratada: record.tipoCliente,
    area: record.area || record.zona,
    tienda: record.tienda,
    paquete: record.paquete,
    observaciones: record.osPago ? `OS DE PAGO: ${record.osPago}` : record.error,
    telefono_asignado: record.telefonoAsignado || record.telTelmex,
    telefono_portado: record.numPortar || record.numCelular,
    os_alta: record.ordenServicio || record.osPago,
    fecha_os_alta: record.fechaPosteo,
    estatus_pisa: record.elaboracion,
    fecha_cambio_estatus: record.fechaPosteo,
    tipo_cliente: record.tipoLinea,
    correo: record.email,
    estatus_etapa: record.etapa,
    telefono_referencia: record.numCelular || record.numPortar,
    zona: record.zona,
  };
}

async function uploadSIACRecords(records: SIACRecord[]) {
  await SiacAPI.deleteAll();
  const chunkSize = 500;
  for (let i = 0; i < records.length; i += chunkSize) {
    await SiacAPI.bulkCreate(records.slice(i, i + chunkSize).map(siacRecordToServerRow));
  }
}

export default function SIACView() {
  const [records, setRecords] = useState<SIACRecord[]>(() => loadSIAC());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterZona, setFilterZona] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadServerRecords = async (showToast = false) => {
    setLoading(true);
    try {
      const rows = await SiacAPI.getAll();
      const mapped = Array.isArray(rows) ? rows.map(serverToSIACRecord) : [];
      setRecords(mapped);
      saveSIAC(mapped);
      if (showToast) toast.success(`${mapped.length} registros SIAC cargados desde la base de datos.`);
    } catch (err) {
      if (showToast) toast.error(err instanceof Error ? err.message : 'No se pudo cargar SIAC desde la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadServerRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zonas = useMemo(() => [...new Set(records.map(r => r.zona).filter(Boolean))].sort(), [records]);
  const tipos = useMemo(() => [...new Set(records.map(r => r.tipoLinea).filter(Boolean))].sort(), [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r => {
      if (filterStatus && r.estatus !== filterStatus) return false;
      if (filterZona && r.zona !== filterZona) return false;
      if (filterTipo && r.tipoLinea !== filterTipo) return false;
      if (q) {
        const haystack = [r.folioSiac, r.ordenServicio, r.paquete, r.zona, r.tienda,
          r.nombrePromotor, r.usuarioPromotor, r.telefonoAsignado, r.telTelmex,
          r.numCelular, r.etapa, r.error].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [records, search, filterStatus, filterZona, filterTipo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Stats
  const stats = useMemo(() => {
    const abiertas = records.filter(r => r.estatus === 'ABIERTA').length;
    const posteadas = records.filter(r => r.estatus === 'POSTEADA').length;
    const revenue = records.reduce((s, r) => s + r.precio, 0);
    const byZona: Record<string, number> = {};
    records.forEach(r => { if (r.zona) byZona[r.zona] = (byZona[r.zona] || 0) + 1; });
    const topZona = Object.entries(byZona).sort((a, b) => b[1] - a[1])[0];
    return { abiertas, posteadas, revenue, topZona };
  }, [records]);

  // Import CSV
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const parsed = parseSIACCsv(text);
      if (parsed.length === 0) { toast.error('No se encontraron registros válidos en el CSV.'); return; }
      await uploadSIACRecords(parsed);
      saveSIAC(parsed);
      setRecords(parsed);
      setPage(0);
      logAudit('EXPORTACION', auth.currentUser?.uid || '', auth.currentUser?.displayName || '',
        { details: `SIAC importado: ${parsed.length} registros` });
      toast.success(`${parsed.length} registros SIAC importados y guardados en la base de datos.`);
    } catch (err) {
      toast.error('Error al leer el archivo: ' + String(err));
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleExport = () => {
    exportToCSV(filtered.map(r => ({
      Estatus: r.estatus,
      'Fecha Captura': r.fechaCaptura,
      'Folio SIAC': r.folioSiac,
      Elaboracion: r.elaboracion,
      Paquete: r.paquete,
      Precio: r.precio,
      'Tipo Cliente': r.tipoCliente,
      Area: r.area,
      Promotor: r.nombrePromotor || r.usuarioPromotor,
      'Orden Servicio': r.ordenServicio,
      'Tel Asignado': r.telefonoAsignado,
      'Fecha Posteo': r.fechaPosteo,
      Tienda: r.tienda,
      Etapa: r.etapa,
      Error: r.error,
      'Tipo Línea': r.tipoLinea,
      Zona: r.zona,
      Email: r.email,
      Celular: r.numCelular,
    })), 'siac_export');
    logAudit('EXPORTACION', auth.currentUser?.uid || '', auth.currentUser?.displayName || '',
      { details: `SIAC exportado: ${filtered.length} registros` });
  };

  const resetFilters = () => {
    setSearch(''); setFilterStatus(''); setFilterZona(''); setFilterTipo(''); setPage(0);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-400" />
            Base SIAC
          </h1>
          <p className="text-slate-400 text-sm">{records.length} registros cargados · filtra, busca y exporta.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
          <button onClick={() => loadServerRecords(true)} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Recargar DB
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition-colors disabled:opacity-50">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Importar CSV
          </button>
          <button onClick={handleExport} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> Exportar ({filtered.length})
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        /* Empty state */
        <div className="bg-slate-900/90 border border-dashed border-white/10 rounded-2xl p-16 text-center space-y-4">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-600" />
          <p className="text-slate-400 font-bold">No hay datos SIAC cargados</p>
          <p className="text-slate-600 text-sm">Importa el archivo SIAC.csv para empezar</p>
          <button onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-bold hover:bg-blue-500/20 transition-colors">
            <Upload className="w-4 h-4" /> Seleccionar SIAC.csv
          </button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4">
              <p className="text-2xl font-black text-amber-400">{stats.abiertas}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Abiertas</p>
            </div>
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4">
              <p className="text-2xl font-black text-emerald-400">{stats.posteadas}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Posteadas</p>
            </div>
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4">
              <p className="text-2xl font-black text-cyan-400">{formatCurrency(stats.revenue)}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Renta mensual total</p>
            </div>
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4">
              <p className="text-lg font-black text-purple-400 truncate">{stats.topZona?.[0] || '—'}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">
                Zona top · {stats.topZona?.[1] || 0} registros
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder="Folio, OS, paquete, zona, tienda, teléfono…"
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none" />
            </div>

            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
              className="bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none [color-scheme:dark]">
              <option value="">Todos los estatus</option>
              <option value="ABIERTA">Abierta</option>
              <option value="POSTEADA">Posteada</option>
            </select>

            <select value={filterZona} onChange={e => { setFilterZona(e.target.value); setPage(0); }}
              className="bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none [color-scheme:dark]">
              <option value="">Todas las zonas</option>
              {zonas.map(z => <option key={z} value={z}>{z}</option>)}
            </select>

            <select value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setPage(0); }}
              className="bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none [color-scheme:dark]">
              <option value="">Todos los tipos</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {(search || filterStatus || filterZona || filterTipo) && (
              <button onClick={resetFilters} className="flex items-center gap-1 px-3 py-2.5 border border-white/10 text-slate-400 rounded-xl text-xs font-bold hover:bg-white/5 transition-colors">
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-950/85">
                  <tr>
                    {['Estatus','Fecha','Folio SIAC','Paquete','Tipo','OS','Tel Asignado','Tienda','Zona','Etapa','Error',''].map(h => (
                      <th key={h} className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pageItems.length === 0 ? (
                    <tr><td colSpan={12} className="px-4 py-12 text-center text-slate-500">Sin registros con el filtro aplicado.</td></tr>
                  ) : pageItems.map(r => {
                    const cfg = STATUS_CFG[r.estatus] || { label: r.estatus, color: 'bg-slate-700/30 text-slate-400 border-slate-600/30', icon: null };
                    const isExp = expanded === r.id;
                    return (
                      <React.Fragment key={r.id}>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="px-3 py-2.5">
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border', cfg.color)}>
                              {cfg.icon}{cfg.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-400 whitespace-nowrap">{r.fechaCaptura}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-white font-mono">{r.folioSiac}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-300 whitespace-nowrap max-w-[160px] truncate" title={r.paquete}>
                            {r.paquete}
                            {r.precio > 0 && <span className="ml-1.5 text-emerald-400 font-bold">${r.precio}</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={cn('text-[10px] font-bold', r.tipoLinea === 'COMERCIAL' ? 'text-purple-400' : 'text-cyan-400')}>
                              {r.tipoLinea}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-300 font-mono">{r.ordenServicio}</td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-300 font-mono">
                            {r.telefonoAsignado !== '0000000000' ? r.telefonoAsignado : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-400 whitespace-nowrap">{r.tienda}</td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-400 whitespace-nowrap max-w-[120px] truncate">{r.zona}</td>
                          <td className="px-3 py-2.5 text-[11px] text-slate-300">{r.etapa}</td>
                          <td className="px-3 py-2.5 text-[11px] max-w-[120px] truncate">
                            {r.error ? <span className="text-amber-400 italic" title={r.error}>{r.error}</span> : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <button onClick={() => setExpanded(isExp ? null : r.id)}
                              className="p-1 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                              {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                        {isExp && (
                          <tr>
                            <td colSpan={12} className="px-4 py-4 bg-slate-950/85 border-t border-white/5">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-xs">
                                {[
                                  ['Elaboración', r.elaboracion],
                                  ['Tipo cliente', r.tipoCliente],
                                  ['Área', r.area],
                                  ['Estrategia', r.estrategia],
                                  ['Promotor', r.nombrePromotor || r.usuarioPromotor || '—'],
                                  ['Núm. a portar', r.numPortar || '—'],
                                  ['Tel Telmex', r.telTelmex !== '0000000000' ? r.telTelmex : '—'],
                                  ['OS Pago', r.osPago || '—'],
                                  ['Fecha posteo', r.fechaPosteo || '—'],
                                  ['Email', r.email || '—'],
                                  ['Celular', r.numCelular || '—'],
                                  ['Folio SIAC', r.folioSiac],
                                ].map(([label, val]) => (
                                  <div key={label}>
                                    <span className="text-slate-500 uppercase text-[9px] tracking-wider">{label}</span>
                                    <p className="text-slate-200 font-mono mt-0.5 truncate">{val}</p>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Pág. {page + 1} de {totalPages} · {filtered.length} registros</span>
                <div className="flex gap-2">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 border border-white/10 text-xs text-slate-300 rounded-lg disabled:opacity-30 hover:bg-white/5 transition-colors">← Anterior</button>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 border border-white/10 text-xs text-slate-300 rounded-lg disabled:opacity-30 hover:bg-white/5 transition-colors">Siguiente →</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
