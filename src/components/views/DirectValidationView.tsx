import React, { useState } from 'react';
import { ArrowLeft, Zap, CheckCircle2, Search, Clock } from 'lucide-react';

// Use same mock data structure as the CRM for consistency
import { ClientData } from './MyClientsView';

const PENDING_CLIENTS: ClientData[] = [
  { id: 'C-1003', name: 'Pedro López', phone: '5599887766', package: 'Paquete 3', status: 'Pendiente', notes: 'Pendiente de validación', date: '2023-10-26' },
  { id: 'C-1005', name: 'Laura Gómez', phone: '5544332211', package: 'Paquete 2', status: 'Pendiente', notes: 'Requiere validación manual', date: '2023-10-27' },
  { id: 'C-1006', name: 'Carlos Díaz', phone: '5500112233', package: 'Paquete 1', status: 'Pendiente', notes: 'Recuperado de "No responde"', date: '2023-10-28' },
];

export default function DirectValidationView({ onBack }: { onBack: () => void }) {
  const [clients, setClients] = useState<ClientData[]>(PENDING_CLIENTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRequestValidation = (id: string) => {
    setRequestingId(id);
    // Simulate network request
    setTimeout(() => {
      setClients(clients.filter(c => c.id !== id));
      setRequestingId(null);
      alert(`¡Validación directa solicitada exitosamente para el folio ${id}! El área correspondiente ya fue notificada.`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">Pedir Validación Directa</h2>
          <p className="text-slate-400 text-sm">Solicita validación inmediata a la mesa de control de clientes pendientes.</p>
        </div>
      </div>

      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 p-6">
        <div className="relative max-w-md mb-6">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o folio..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/80 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => (
            <div key={client.id} className="bg-slate-800/40 border border-white/5 rounded-xl p-5 hover:border-purple-500/30 transition-colors group">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                    {client.id}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-2">{client.name}</h3>
                </div>
                <Clock className="w-5 h-5 text-slate-500" />
              </div>
              
              <div className="space-y-1 text-sm text-slate-400 mb-6">
                <p>📞 {client.phone}</p>
                <p>📦 {client.package}</p>
                <p className="italic text-xs text-slate-500">Nota: {client.notes}</p>
              </div>

              <button 
                onClick={() => handleRequestValidation(client.id)}
                disabled={requestingId !== null}
                className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                  requestingId === client.id 
                    ? 'bg-purple-500/50 text-white cursor-wait' 
                    : requestingId !== null 
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40'
                }`}
              >
                {requestingId === client.id ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Enviando alerta...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> Solicitar Validación
                  </>
                )}
              </button>
            </div>
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-bold text-white mb-1">¡Todo al día!</h3>
              <p className="text-slate-400 text-sm">No hay clientes pendientes de validación.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
