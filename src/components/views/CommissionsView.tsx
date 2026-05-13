import React, { useState, useMemo } from 'react';
import { DollarSign, Download, Settings, Save, RefreshCw, Award, CheckCircle2, X } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { calculateCommissions, getCommissionRules, saveCommissionRules, CommissionRule } from '../../lib/commissions';
import { exportToCSV } from '../../lib/exportUtils';
import { logAudit } from '../../lib/auditLog';
import { auth } from '../../lib/firebase';
import { toast } from 'sonner';

export default function CommissionsView() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState<CommissionRule[]>(getCommissionRules());
  const results = useMemo(() => calculateCommissions(period), [period]);

  const totals = useMemo(() => ({
    base: results.reduce((a, r) => a + r.baseCommission, 0),
    bonus: results.reduce((a, r) => a + r.goalBonus, 0),
    referral: results.reduce((a, r) => a + r.referralBonus, 0),
    total: results.reduce((a, r) => a + r.total, 0),
  }), [results]);

  const saveRules = () => {
    saveCommissionRules(rules);
    setShowRules(false);
    logAudit('COMISION_CALCULADA', auth.currentUser?.uid||'', auth.currentUser?.displayName||'', { details: 'Reglas de comisión actualizadas' });
    toast.success('Reglas de comisión guardadas.');
  };

  const handleExport = () => {
    exportToCSV(results.map(r => ({
      Asesor: r.userName,
      Período: r.period,
      'Ventas Aprobadas': r.salesApproved,
      'Ventas Total': r.salesTotal,
      'Comisión Base': r.baseCommission,
      'Bono Meta': r.goalBonus,
      'Bono Referidos': r.referralBonus,
      'Total a Pagar': r.total,
      'Meta Cumplida': r.quotaMet ? 'Sí' : 'No',
    })), `comisiones_${period}`);
    logAudit('EXPORTACION', auth.currentUser?.uid||'', auth.currentUser?.displayName||'', { details: `Comisiones ${period}` });
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-yellow-400" />
            Comisiones del Equipo
          </h1>
          <p className="text-slate-400 text-sm">Cálculo automático basado en ventas aprobadas, metas y referidos.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]" />
          <button onClick={() => setShowRules(true)} className="flex items-center gap-2 px-3 py-2 border border-white/10 text-slate-300 rounded-xl text-xs font-bold hover:bg-white/5 transition-colors">
            <Settings className="w-3.5 h-3.5" /> Reglas
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-colors">
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Comisión base total', value: formatCurrency(totals.base), color: 'text-white' },
          { label: 'Bonos por meta', value: formatCurrency(totals.bonus), color: 'text-emerald-400' },
          { label: 'Bonos referidos', value: formatCurrency(totals.referral), color: 'text-purple-400' },
          { label: 'Total a pagar', value: formatCurrency(totals.total), color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/90 border border-white/10 rounded-2xl p-5">
            <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950/80">
              <tr>
                {['Asesor','Ventas aprob.','Ventas total','Conv.','Comisión base','Bono meta','Bono referidos','Total','Estado'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {results.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Sin datos para el período seleccionado.</td></tr>
              ) : results.map((r, i) => {
                const conv = r.salesTotal ? Math.round((r.salesApproved / r.salesTotal) * 100) : 0;
                return (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-white whitespace-nowrap">{r.userName}</td>
                    <td className="px-4 py-3 text-sm text-emerald-400 font-bold">{r.salesApproved}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{r.salesTotal}</td>
                    <td className="px-4 py-3 text-sm text-cyan-400">{conv}%</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{formatCurrency(r.baseCommission)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-400">{formatCurrency(r.goalBonus)}</td>
                    <td className="px-4 py-3 text-sm text-purple-400">{formatCurrency(r.referralBonus)}</td>
                    <td className="px-4 py-3 text-sm font-black text-yellow-400">{formatCurrency(r.total)}</td>
                    <td className="px-4 py-3">
                      {r.quotaMet
                        ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Meta cumplida</span>
                        : <span className="text-[10px] text-slate-500">{r.salesApproved} / meta</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rules modal */}
      {showRules && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-yellow-500/30 rounded-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Reglas de comisión</h3>
              <button onClick={() => setShowRules(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-400">Define la tasa por venta aprobada y el bono por meta según el número de ventas del mes.</p>
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-end">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase">Desde</label>
                    <input type="number" value={rule.minSales} onChange={e => setRules(r => r.map((x,j) => j===i ? {...x,minSales:+e.target.value} : x))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase">Hasta (vacío=∞)</label>
                    <input type="number" value={rule.maxSales ?? ''} onChange={e => setRules(r => r.map((x,j) => j===i ? {...x,maxSales:e.target.value==='' ? null : +e.target.value} : x))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase">$/venta</label>
                    <input type="number" value={rule.ratePerSale} onChange={e => setRules(r => r.map((x,j) => j===i ? {...x,ratePerSale:+e.target.value} : x))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase">Bono meta $</label>
                    <input type="number" value={rule.bonusOnGoal} onChange={e => setRules(r => r.map((x,j) => j===i ? {...x,bonusOnGoal:+e.target.value} : x))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowRules(false)} className="flex-1 px-4 py-2.5 border border-white/10 text-slate-300 rounded-xl text-sm font-bold hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={saveRules} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-xl text-sm font-bold hover:bg-yellow-500/30 transition-colors">
                <Save className="w-4 h-4" /> Guardar reglas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
