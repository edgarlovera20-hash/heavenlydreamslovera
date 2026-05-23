import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bot, Boxes, CheckCircle2, GitBranch, Play, RefreshCw, ShieldCheck, Zap } from 'lucide-react';

const SESSION_KEY = 'hd_session';

function authHeaders(): HeadersInit {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    return session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
  } catch {
    return {};
  }
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="border border-slate-800 bg-[#0a0d14]/80 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-cyan-300" />
        <h3 className="text-xs font-black uppercase tracking-widest text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function EnterpriseOpsView() {
  const [health, setHealth] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState('No puedo pagar hoy, pero el viernes liquido el atraso.');
  const [aiResult, setAiResult] = useState<any>(null);

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', ...authHeaders() }), []);

  const load = async () => {
    setLoading(true);
    try {
      const [healthRes, readinessRes, metricsRes, inventoryRes, rulesRes, jobsRes] = await Promise.all([
        fetch('/api/enterprise/health'),
        fetch('/api/enterprise/readiness', { headers }),
        fetch('/api/enterprise/metrics', { headers }),
        fetch('/api/inventory'),
        fetch('/api/automation/rules', { headers }),
        fetch('/api/ai/jobs', { headers }),
      ]);
      if (healthRes.ok) setHealth(await healthRes.json());
      if (readinessRes.ok) setReadiness(await readinessRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (inventoryRes.ok) setInventory(await inventoryRes.json());
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (jobsRes.ok) setJobs(await jobsRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const classify = async () => {
    const res = await fetch('/api/ai/morosity/classify', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: aiText }),
    });
    setAiResult(await res.json());
  };

  const processJob = async () => {
    await fetch('/api/ai/jobs/process-next', { method: 'POST', headers });
    load();
  };

  const status = (value: string) => (
    <span className="px-2 py-1 rounded border border-cyan-400/20 text-cyan-200 bg-cyan-400/5 text-[10px] font-bold uppercase">
      {value}
    </span>
  );

  const gateStyle = (gateStatus: string) => {
    if (gateStatus === 'ok') return 'border-emerald-400/20 bg-emerald-400/5 text-emerald-200';
    if (gateStatus === 'critical') return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
    return 'border-amber-400/25 bg-amber-400/5 text-amber-200';
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest text-white">Arquitectura Empresarial</h2>
          <p className="text-xs text-slate-400 mt-1">RBAC, IA, automatización, inventario, métricas y cola operativa.</p>
        </div>
        <button
          onClick={load}
          className="h-9 px-3 rounded-lg border border-cyan-400/30 text-cyan-200 hover:bg-cyan-400/10 flex items-center gap-2 text-xs font-bold uppercase"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Infraestructura" icon={ShieldCheck}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {status(health?.database || 'cargando')}
            {status(health?.eventBus || 'cargando')}
            {status(health?.queues || 'cargando')}
            {status(health?.mode || 'desarrollo')}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {Object.entries(health?.ai || {}).map(([name, data]: any) => (
              <div key={name} className="border border-slate-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase font-bold">{name}</p>
                <p className={data.configured ? 'text-emerald-300 text-xs' : 'text-amber-300 text-xs'}>
                  {data.configured ? 'Configurado' : 'Pendiente'}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Readiness 1000" icon={readiness?.critical ? AlertTriangle : CheckCircle2}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-3xl font-black text-white">{readiness?.score ?? '—'}%</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                {readiness?.ok || 0} ok · {readiness?.warning || 0} avisos · {readiness?.critical || 0} críticos
              </p>
            </div>
            {status(readiness?.connections?.postgres ? 'postgres ok' : health?.database || 'sqlite')}
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
            {(readiness?.gates || []).slice(0, 15).map((gate: any) => (
              <div key={gate.id} className={`rounded-lg border p-2 ${gateStyle(gate.status)}`}>
                <p className="text-[11px] font-black uppercase tracking-wider">{gate.label}</p>
                <p className="text-[10px] opacity-80 mt-0.5">{gate.detail}</p>
              </div>
            ))}
            {!readiness && <p className="text-xs text-slate-500">Cargando checklist empresarial.</p>}
          </div>
        </Panel>

        <Panel title="Inventario" icon={Boxes}>
          <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
            {inventory.slice(0, 8).map(item => (
              <div key={item.id} className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <p className="text-sm text-white font-semibold">{item.nombre}</p>
                  <p className="text-[10px] text-slate-500 uppercase">{item.tipo} · {item.serial || item.sku || 'sin serie'}</p>
                </div>
                {status(item.estado)}
              </div>
            ))}
            {inventory.length === 0 && <p className="text-xs text-slate-500">Sin activos registrados.</p>}
          </div>
        </Panel>

        <Panel title="Automatizaciones" icon={GitBranch}>
          <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
            {rules.slice(0, 8).map(rule => (
              <div key={rule.id} className="border border-slate-800 rounded-lg p-3">
                <p className="text-sm text-white font-semibold">{rule.name}</p>
                <p className="text-[10px] text-cyan-300 uppercase mt-1">{rule.event}</p>
              </div>
            ))}
            {rules.length === 0 && <p className="text-xs text-slate-500">Sin reglas creadas.</p>}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="IA de Morosidad" icon={Bot}>
          <textarea
            value={aiText}
            onChange={e => setAiText(e.target.value)}
            className="w-full h-24 rounded-lg bg-black/30 border border-slate-800 p-3 text-sm text-white outline-none focus:border-cyan-400/50"
          />
          <button onClick={classify} className="mt-3 h-9 px-3 rounded-lg bg-cyan-500 text-black text-xs font-black uppercase flex items-center gap-2">
            <Zap className="w-4 h-4" /> Clasificar respuesta
          </button>
          {aiResult && (
            <pre className="mt-3 text-[11px] text-slate-300 bg-black/30 border border-slate-800 rounded-lg p-3 overflow-auto max-h-48">
              {JSON.stringify(aiResult.parsed || aiResult, null, 2)}
            </pre>
          )}
        </Panel>

        <Panel title="Workers y Métricas" icon={Activity}>
          <div className="flex gap-2 mb-3">
            <button onClick={processJob} className="h-9 px-3 rounded-lg border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase flex items-center gap-2">
              <Play className="w-4 h-4" /> Procesar job
            </button>
            {status(`${jobs.filter(j => j.status === 'queued').length} en cola`)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {metrics.slice(0, 8).map(metric => (
              <div key={metric.id} className="border border-slate-800 rounded-lg p-3">
                <p className="text-xs text-white font-semibold">{metric.name}</p>
                <p className="text-[10px] text-slate-500 mt-1">{metric.value} · {metric.created_at}</p>
              </div>
            ))}
            {metrics.length === 0 && <p className="text-xs text-slate-500">Sin métricas recientes.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
