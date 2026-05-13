import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Plus, CheckCircle2, Clock, XCircle, MessageCircle, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getReferrals, addReferral, updateReferralStatus, getReferralStats, Referral } from '../../lib/referrals';
import { auth } from '../../lib/firebase';
import { chatUrl } from '../../lib/channels';
import { toast } from 'sonner';

function StatusBadge({ estado }: { estado: Referral['estado'] }) {
  const map = {
    pendiente:   'bg-amber-500/20 text-amber-400 border-amber-500/30',
    convertido:  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    cancelado:   'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const labels = { pendiente: 'Pendiente', convertido: 'Convertido ✅', cancelado: 'Cancelado' };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border', map[estado])}>
      {labels[estado]}
    </span>
  );
}

export default function ReferralsView() {
  const [refs, setRefs] = useState<Referral[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ referidoPor: '', telefonoReferidor: '', nombreProspecto: '', telefonoProspecto: '' });
  const asesorId = auth.currentUser?.uid || 'anonymous';

  const load = () => setRefs(getReferrals());
  useEffect(load, []);

  const stats = getReferralStats(asesorId);

  const handleAdd = () => {
    if (!form.referidoPor || !form.nombreProspecto || !form.telefonoProspecto) {
      toast.error('Completa los campos obligatorios.');
      return;
    }
    addReferral({ ...form, asesorId });
    setForm({ referidoPor: '', telefonoReferidor: '', nombreProspecto: '', telefonoProspecto: '' });
    setShowForm(false);
    load();
    toast.success('Referido registrado. ¡Commisión pendiente de $150 MXN!');
  };

  const handleConvert = (id: string) => {
    updateReferralStatus(id, 'convertido');
    load();
    toast.success('¡Referido convertido! Comisión de $150 MXN acreditada.');
  };

  const handleCancel = (id: string) => {
    updateReferralStatus(id, 'cancelado');
    load();
  };

  const sendInvite = (ref: Referral) => {
    const texto = `Hola ${ref.nombreProspecto} 👋, te contacto de parte de *${ref.referidoPor}* y de *Heavenly Dreams*.\n\nTe tengo una oferta especial de internet de alta velocidad. ¿Tienes unos minutos para platicar? 😊`;
    const wa = chatUrl('whatsappClientes') || chatUrl('whatsappVendedores');
    const phone = ref.telefonoProspecto.replace(/[^\d]/g, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`
      : (wa ? `${wa}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`);
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            Programa de Referidos
          </h1>
          <p className="text-slate-400 text-sm">Gana $150 MXN por cada referido que se convierta en cliente.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Nuevo referido
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total referidos', value: stats.total, color: 'text-white' },
          { label: 'Pendientes', value: stats.pendientes, color: 'text-amber-400' },
          { label: 'Convertidos', value: stats.convertidos, color: 'text-emerald-400' },
          { label: 'Comisión ganada', value: `$${stats.comisionTotal.toLocaleString('es-MX')}`, color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/90 border border-white/10 rounded-xl p-4">
            <p className={cn('text-xl font-black', s.color)}>{s.value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Commission info */}
      <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl text-sm text-yellow-400">
        <DollarSign className="w-4 h-4 shrink-0" />
        <span>Cada referido convertido genera <strong>$150 MXN</strong> de comisión automáticamente. Se acumula con tus ventas directas.</span>
      </div>

      {/* New referral form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Registrar nuevo referido</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>
            {[
              { key: 'referidoPor', label: 'Cliente que refiere *', placeholder: 'Nombre del cliente referidor' },
              { key: 'telefonoReferidor', label: 'Teléfono referidor', placeholder: '+52 55 …' },
              { key: 'nombreProspecto', label: 'Nombre del prospecto *', placeholder: 'Nombre del nuevo posible cliente' },
              { key: 'telefonoProspecto', label: 'Teléfono prospecto *', placeholder: '+52 55 …' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{f.label}</label>
                <input
                  type="text"
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-white/10 text-slate-300 rounded-xl text-sm font-bold hover:bg-white/5 transition-colors">
                Cancelar
              </button>
              <button onClick={handleAdd} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors">
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {refs.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No hay referidos registrados aún. ¡Empieza a ganar comisiones!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {refs.slice().reverse().map(r => (
            <div key={r.id} className="bg-slate-900/90 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-white text-sm">{r.nombreProspecto}</p>
                  <StatusBadge estado={r.estado} />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Referido por <strong className="text-slate-300">{r.referidoPor}</strong> · {r.telefonoProspecto}
                  {r.folioVenta && ` · Folio: ${r.folioVenta}`}
                </p>
                <p className="text-[10px] text-slate-500">{new Date(r.fechaRegistro).toLocaleString('es-MX')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => sendInvite(r)} title="Contactar por WhatsApp"
                  className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/20 transition-colors">
                  <MessageCircle className="w-4 h-4" />
                </button>
                {r.estado === 'pendiente' && (
                  <>
                    <button onClick={() => handleConvert(r.id)} title="Marcar como convertido"
                      className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/20 transition-colors">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleCancel(r.id)} title="Cancelar"
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
