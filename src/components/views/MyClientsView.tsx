import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Search, Filter, Download, Upload, MoreVertical, Edit, FileText, Database, ShieldAlert, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export interface ClientData {
  id: string;
  name: string;
  phone: string;
  package: string;
  status: string;
  notes: string;
  date: string;
}


export default function MyClientsView({ onBack }: { onBack: () => void }) {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Note editing state
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [noteText, setNoteText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sales: any[] = JSON.parse(localStorage.getItem('adhdreams_sales') || '[]');
    setClients(sales.map((s: any) => ({
      id: s.id || s.folio || `C-${Math.random().toString(36).slice(2, 7)}`,
      name: `${s.nombres || ''} ${s.apellidoPaterno || ''}`.trim() || 'Sin nombre',
      phone: s.telefonoTitular || '',
      package: s.paqueteNombre || '',
      status: s.status || 'PENDIENTE',
      notes: s.notes || '',
      date: s.fechaSolicitud?.split('T')[0] || '',
    })));
    setLoading(false);
  }, []);

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          client.phone.includes(searchTerm) || 
                          client.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || client.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const downloadClientCSV = (client: ClientData) => {
    const headers = ['ID', 'Nombre', 'Teléfono', 'Paquete', 'Estatus', 'Notas', 'Fecha'];
    const row = [
      client.id, 
      `"${client.name}"`, 
      client.phone, 
      `"${client.package}"`, 
      client.status, 
      `"${client.notes.replace(/"/g, '""')}"`, 
      client.date
    ];
    
    const csvContent = [headers.join(','), row.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `client_${client.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Nombre', 'Teléfono', 'Paquete', 'Estatus', 'Notas', 'Fecha'];
    const rows = clients.map(c => [
      c.id, 
      `"${c.name}"`, 
      c.phone, 
      `"${c.package}"`, 
      c.status, 
      `"${c.notes.replace(/"/g, '""')}"`, 
      c.date
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'neural_crm_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const lines = text.split('\n');
        if (lines.length > 1) {
          const newClients: ClientData[] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
            const values = line.split(regex).map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
            
            if (values.length >= 7) {
              newClients.push({
                id: values[0],
                name: values[1],
                phone: values[2],
                package: values[3],
                status: values[4] as ('Procedió' | 'No responde' | 'Pendiente' | 'Rechazado'),
                notes: values[5],
                date: values[6]
              });
            }
          }
          setClients(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const toAdd = newClients.filter(nc => !existingIds.has(nc.id));
            return [...prev, ...toAdd];
          });
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openNoteEditor = (client: ClientData) => {
    setEditingClient(client);
    setNoteText(client.notes);
  };

  const saveNote = () => {
    if (editingClient) {
      setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, notes: noteText } : c));
      toast.success('Nota actualizada.');
      setEditingClient(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Procedió': return <span className="px-2.5 py-1 bg-cyber-matrix/20 text-cyber-matrix text-[10px] uppercase font-bold tracking-widest rounded-sm border border-cyber-matrix/30 shadow-[0_0_8px_rgba(0,255,136,0.2)]">PROCESSED</span>;
      case 'No responde': return <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 text-[10px] uppercase font-bold tracking-widest rounded-sm border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]">M.I.A.</span>;
      case 'Pendiente': return <span className="px-2.5 py-1 bg-cyber-neon/20 text-cyber-neon text-[10px] uppercase font-bold tracking-widest rounded-sm border border-cyber-neon/30 shadow-[0_0_8px_rgba(0,229,255,0.2)]">PENDING</span>;
      case 'Rechazado': return <span className="px-2.5 py-1 bg-red-500/20 text-red-500 text-[10px] uppercase font-bold tracking-widest rounded-sm border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]">REJECTED</span>;
      default: return <span className="px-2.5 py-1 bg-cyber-electric/10 text-cyber-electric/70 text-[10px] uppercase font-bold tracking-widest rounded-sm border border-cyber-electric/30">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-cyber-neon/10 rounded-xl transition-colors border border-transparent hover:border-cyber-neon/30 text-cyber-electric/70 hover:text-cyber-neon"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
            <Database className="w-8 h-8 text-cyber-electric" />
            Neural CRM Core
          </h2>
          <p className="text-cyber-electric/70 text-sm font-medium uppercase tracking-widest pl-11">Dynamic Lead Management & Validation Pipeline</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border-cyber-electric/30 p-6 flex flex-col h-[75vh] shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
        {/* Subtle background tech grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(3,154,220,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(3,154,220,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyber-matrix via-cyber-neon to-cyber-electric z-10" />

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 relative z-10">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64 group">
              <Search className="w-4 h-4 text-cyber-electric/50 group-hover:text-cyber-neon absolute left-3 top-1/2 -translate-y-1/2 transition-colors" />
              <input 
                type="text" 
                placeholder="INPUT QUERY..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-cyber-black/60 border border-cyber-electric/20 rounded-xl py-2 pl-10 pr-4 text-sm font-mono text-white placeholder:text-cyber-electric/30 focus:outline-none focus:border-cyber-neon focus:ring-1 focus:ring-cyber-neon/50 transition-all uppercase"
              />
            </div>
            <div className="relative group">
              <Filter className="w-4 h-4 text-cyber-electric/50 group-hover:text-cyber-neon absolute left-3 top-1/2 -translate-y-1/2 transition-colors" />
              <select 
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-cyber-black/60 border border-cyber-electric/20 rounded-xl py-2 pl-10 pr-8 text-xs font-bold tracking-widest text-cyber-electric uppercase focus:outline-none focus:border-cyber-neon focus:ring-1 focus:ring-cyber-neon/50 transition-all appearance-none"
              >
                <option value="all" className="bg-cyber-dark text-white">ALL NODES</option>
                <option value="Procedió" className="bg-cyber-dark text-white">PROCESSED</option>
                <option value="No responde" className="bg-cyber-dark text-white">M.I.A.</option>
                <option value="Pendiente" className="bg-cyber-dark text-white">PENDING</option>
                <option value="Rechazado" className="bg-cyber-dark text-white">REJECTED</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImportCSV}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 border border-cyber-electric/30 hover:border-cyber-electric bg-cyber-black/50 hover:bg-cyber-electric/10 text-cyber-electric rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 border border-cyber-neon/50 hover:border-cyber-neon bg-cyber-neon/10 hover:bg-cyber-neon/20 text-cyber-neon rounded-lg text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(0,229,255,0.1)] hover:shadow-[0_0_20px_rgba(0,229,255,0.3)]"
            >
              <Download className="w-4 h-4" /> Export DB
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto border border-cyber-electric/20 rounded-xl relative z-10 custom-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-cyber-electric animate-spin" />
            </div>
          ) : (
            <table className="w-full text-left text-sm text-cyber-electric/90">
              <thead className="text-[10px] font-bold tracking-widest text-cyber-neon uppercase bg-cyber-black/80 sticky top-0 z-20 backdrop-blur-md">
                <tr>
                  <th className="px-4 py-4 font-bold border-b border-cyber-electric/20">UIN</th>
                  <th className="px-4 py-4 font-bold border-b border-cyber-electric/20">Subject Name</th>
                  <th className="px-4 py-4 font-bold border-b border-cyber-electric/20">Com-Link</th>
                  <th className="px-4 py-4 font-bold border-b border-cyber-electric/20">Sub-Tier</th>
                  <th className="px-4 py-4 font-bold border-b border-cyber-electric/20">Protocol</th>
                  <th className="px-4 py-4 font-bold border-b border-cyber-electric/20">Sys-Logs</th>
                  <th className="px-4 py-4 font-bold text-center border-b border-cyber-electric/20">I/O</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-electric/10 bg-cyber-dark/40">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-cyber-neon/5 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-cyber-matrix/80">{client.id}</td>
                    <td className="px-4 py-3 font-bold text-white group-hover:text-cyber-neon transition-colors">{client.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{client.phone}</td>
                    <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-300">{client.package}</td>
                    <td className="px-4 py-3">{getStatusBadge(client.status)}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-xs" title={client.notes}>
                      {client.notes ? <span className="text-slate-300 font-mono">{client.notes}</span> : <span className="text-cyber-electric/40 italic text-xs">NO DATA...</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center items-center gap-2">
                        <button 
                          onClick={() => downloadClientCSV(client)}
                          className="p-2 text-cyber-electric/60 hover:text-cyber-neon hover:bg-cyber-neon/10 rounded-lg transition-colors border border-transparent hover:border-cyber-neon/30"
                          title="Download Data"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openNoteEditor(client)}
                          className="p-2 text-cyber-electric/60 hover:text-cyber-neon hover:bg-cyber-neon/10 rounded-lg transition-colors border border-transparent hover:border-cyber-neon/30"
                          title="Override Log"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-cyber-electric/50">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <ShieldAlert className="w-10 h-10 text-cyber-electric/30" />
                        <p className="uppercase tracking-widest font-bold text-xs">No records matched active search criteria.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Note Editor Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cyber-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel-neon border-cyber-neon/50 rounded-2xl p-8 w-full max-w-lg shadow-[0_0_50px_rgba(0,229,255,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-cyber-neon"></div>
            
            <div className="flex items-center gap-3 mb-2">
               <Cpu className="w-6 h-6 text-cyber-neon" />
               <h3 className="text-xl font-bold text-white uppercase tracking-wider">Log Override: <span className="text-cyber-neon">{editingClient.name}</span></h3>
            </div>
            
            <div className="flex items-center gap-2 mb-6">
               <span className="text-xs text-cyber-electric/70 uppercase tracking-widest font-bold">Current State:</span>
               {getStatusBadge(editingClient.status)}
            </div>
            
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="ENTER SYSTEM NOTES OR RECOVERY PROCEDURES..."
              className="w-full h-32 bg-cyber-black/70 border border-cyber-electric/30 rounded-xl p-4 text-sm font-mono text-cyber-neon placeholder:text-cyber-electric/30 focus:outline-none focus:border-cyber-neon focus:ring-1 focus:ring-cyber-neon/50 transition-all resize-none mb-6"
            />
            
            <div className="flex justify-end gap-3 font-mono">
              <button 
                onClick={() => setEditingClient(null)}
                className="px-5 py-2 hover:bg-white/5 border border-transparent hover:border-slate-500/30 text-slate-300 rounded-lg text-xs uppercase tracking-widest font-bold transition-all"
              >
                Abort
              </button>
              <button 
                onClick={saveNote}
                className="px-5 py-2 bg-cyber-electric hover:bg-cyber-neon text-cyber-black rounded-lg text-xs uppercase tracking-widest font-bold transition-all shadow-[0_0_15px_rgba(3,154,220,0.4)] hover:shadow-[0_0_20px_rgba(0,229,255,0.6)]"
              >
                Commit Write
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
