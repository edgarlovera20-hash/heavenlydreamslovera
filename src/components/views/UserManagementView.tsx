import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle, XCircle, Trash2, RefreshCw, Search, Shield, UserCheck, UserX, Clock, Phone, Mail, MapPin, Plus, KeyRound } from 'lucide-react';

interface AppUser {
  uid: string;
  username: string;
  email: string;
  displayName?: string;
  nombre?: string;
  apellidoPaterno?: string;
  role: string;
  activo: number; // 0=rechazado 1=activo 2=pendiente
  puesto?: string;
  telefono?: string;
  zonaOperativa?: string;
  created_at?: string;
}

const ROLE_LABELS: Record<string, string> = {
  GERENTE: 'Gerente',
  ADMINISTRACION: 'Administración',
  SUPERVISOR: 'Supervisor',
  ASESOR: 'Asesor',
};

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Rechazado', color: 'text-rose-400 bg-rose-400/10 border-rose-400/30' },
  1: { label: 'Activo', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  2: { label: 'Pendiente', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
};

const emptyUserForm = {
  nombre: '',
  email: '',
  username: '',
  password: '',
  role: 'ASESOR',
  puesto: 'Asesor',
  zona: '',
  activo: '1',
};

export default function UserManagementView() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('all');
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar usuarios.');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setUsers([]);
      setLoadError(err?.message || 'No se pudieron cargar usuarios.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const notify = (text: string, ok: boolean) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const updateUserForm = (field: keyof typeof emptyUserForm, value: string) => {
    setUserForm(current => ({ ...current, [field]: value }));
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userForm.nombre.trim() || !userForm.email.trim() || !userForm.username.trim() || !userForm.password.trim()) {
      notify('Completa nombre, correo, usuario y contraseña.', false);
      return;
    }
    if (userForm.password.length < 8) {
      notify('La contraseña debe tener al menos 8 caracteres.', false);
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: userForm.nombre.trim(),
          email: userForm.email.trim(),
          username: userForm.username.trim(),
          password: userForm.password,
          role: userForm.role,
          puesto: userForm.puesto.trim() || null,
          zona: userForm.zona.trim() || null,
          activo: Number(userForm.activo),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear el usuario.');
      notify(Number(userForm.activo) === 1 ? 'Usuario creado y activo.' : 'Usuario creado como pendiente.', true);
      setUserForm(emptyUserForm);
      setShowCreateForm(false);
      loadUsers();
    } catch (err: any) {
      notify(err?.message || 'No se pudo crear el usuario.', false);
    } finally {
      setCreating(false);
    }
  };

  const approveUser = async (uid: string) => {
    const res = await fetch(`/api/users/${uid}/approve`, { method: 'POST' });
    if (res.ok) { notify('Usuario aprobado correctamente.', true); loadUsers(); }
    else notify('Error al aprobar usuario.', false);
  };

  const rejectUser = async (uid: string) => {
    const res = await fetch(`/api/users/${uid}/reject`, { method: 'POST' });
    if (res.ok) { notify('Usuario rechazado.', true); loadUsers(); }
    else notify('Error al rechazar usuario.', false);
  };

  const deleteUser = async (uid: string, name: string) => {
    if (!confirm(`¿Eliminar permanentemente a "${name}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/users/${uid}`, { method: 'DELETE' });
    if (res.ok) { notify('Usuario eliminado.', true); loadUsers(); }
    else notify('Error al eliminar usuario.', false);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q);
    const matchFilter =
      filter === 'all' ? true :
      filter === 'pending' ? u.activo === 2 :
      filter === 'active' ? u.activo === 1 :
      u.activo === 0;
    return matchSearch && matchFilter;
  });

  const pending = users.filter(u => u.activo === 2).length;
  const active  = users.filter(u => u.activo === 1).length;
  const rejected = users.filter(u => u.activo === 0).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-cyan-400" /> Gestión de Usuarios
          </h2>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest">Administra cuentas · aprueba o rechaza solicitudes</p>
        </div>
        <button onClick={loadUsers} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors" title="Recargar">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="rounded-2xl border border-cyan-400/20 bg-[#0a0d14] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-cyan-100">
              <Plus className="h-4 w-4 text-cyan-300" /> Crear usuario
            </h3>
            <p className="mt-1 text-xs text-slate-500">Alta manual desde la app. Puedes dejarlo activo o pendiente de aprobación.</p>
          </div>
          <button
            onClick={() => setShowCreateForm(value => !value)}
            className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-cyan-100 hover:bg-cyan-400/20"
          >
            {showCreateForm ? 'Cerrar formulario' : 'Nuevo usuario'}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={createUser} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nombre</span>
              <input value={userForm.nombre} onChange={e => updateUserForm('nombre', e.target.value)} className="w-full rounded-xl border border-slate-800 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="Edgar Lovera" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Correo</span>
              <input value={userForm.email} onChange={e => updateUserForm('email', e.target.value)} type="email" className="w-full rounded-xl border border-slate-800 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="usuario@correo.com" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Usuario</span>
              <input value={userForm.username} onChange={e => updateUserForm('username', e.target.value)} className="w-full rounded-xl border border-slate-800 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="usuario" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contraseña temporal</span>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={userForm.password} onChange={e => updateUserForm('password', e.target.value)} type="password" className="w-full rounded-xl border border-slate-800 bg-black/30 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="Mínimo 8 caracteres" />
              </div>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rol</span>
              <select value={userForm.role} onChange={e => updateUserForm('role', e.target.value)} className="w-full rounded-xl border border-slate-800 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50">
                {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value} className="bg-slate-950">{label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Puesto</span>
              <input value={userForm.puesto} onChange={e => updateUserForm('puesto', e.target.value)} className="w-full rounded-xl border border-slate-800 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="Asesor" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Zona</span>
              <input value={userForm.zona} onChange={e => updateUserForm('zona', e.target.value)} className="w-full rounded-xl border border-slate-800 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="CDMX / zona 1" />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Estado inicial</span>
              <select value={userForm.activo} onChange={e => updateUserForm('activo', e.target.value)} className="w-full rounded-xl border border-slate-800 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50">
                <option value="1" className="bg-slate-950">Activo, puede entrar</option>
                <option value="2" className="bg-slate-950">Pendiente de aprobar</option>
              </select>
            </label>
            <div className="md:col-span-2 xl:col-span-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setUserForm(emptyUserForm); setShowCreateForm(false); }} className="rounded-xl border border-slate-800 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white">Cancelar</button>
              <button disabled={creating} className="rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-950 disabled:opacity-60">
                {creating ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <button onClick={() => setFilter('pending')} className={`bg-[#0a0d14] border rounded-[14px] p-4 text-left transition-all hover:border-yellow-400/50 ${filter === 'pending' ? 'border-yellow-400/60' : 'border-slate-800/80'}`}>
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-yellow-400" /><span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Pendientes</span></div>
          <p className="text-3xl font-bold text-yellow-400">{pending}</p>
        </button>
        <button onClick={() => setFilter('active')} className={`bg-[#0a0d14] border rounded-[14px] p-4 text-left transition-all hover:border-emerald-400/50 ${filter === 'active' ? 'border-emerald-400/60' : 'border-slate-800/80'}`}>
          <div className="flex items-center gap-2 mb-1"><UserCheck className="w-4 h-4 text-emerald-400" /><span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Activos</span></div>
          <p className="text-3xl font-bold text-emerald-400">{active}</p>
        </button>
        <button onClick={() => setFilter('rejected')} className={`bg-[#0a0d14] border rounded-[14px] p-4 text-left transition-all hover:border-rose-400/50 ${filter === 'rejected' ? 'border-rose-400/60' : 'border-slate-800/80'}`}>
          <div className="flex items-center gap-2 mb-1"><UserX className="w-4 h-4 text-rose-400" /><span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Rechazados</span></div>
          <p className="text-3xl font-bold text-rose-400">{rejected}</p>
        </button>
      </div>

      {actionMsg && (
        <div className={`px-4 py-3 rounded-xl border text-sm font-bold ${actionMsg.ok ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' : 'bg-rose-400/10 border-rose-400/30 text-rose-400'}`}>
          {actionMsg.text}
        </div>
      )}

      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
        Toda cuenta nueva queda bloqueada como pendiente. Solo gerencia puede aprobarla; mientras no esté aprobada, el usuario no puede iniciar sesión ni usar la app.
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-300">
          {loadError}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, usuario o email..."
            className="w-full pl-9 pr-4 py-2.5 bg-[#0a0d14] border border-slate-800/80 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>
        {(['all', 'pending', 'active', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[10px] uppercase font-bold tracking-widest px-3 py-2 rounded-lg border transition-colors ${filter === f ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'}`}>
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'active' ? 'Activos' : 'Rechazados'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-500 text-sm">Cargando usuarios...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-slate-500">
          <Users className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No se encontraron usuarios</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const statusCfg = STATUS_LABELS[u.activo] ?? STATUS_LABELS[0];
            const name = u.displayName || `${u.nombre || ''} ${u.apellidoPaterno || ''}`.trim() || u.username;
            return (
              <div key={u.uid} className="bg-[#0a0d14] border border-slate-800/80 rounded-[14px] p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400 font-bold text-sm shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-bold text-white text-sm truncate">{name}</p>
                    <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border ${statusCfg.color}`}>{statusCfg.label}</span>
                    <span className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border border-slate-700 text-slate-400">{ROLE_LABELS[u.role] || u.role}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" />@{u.username}</span>
                    {u.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</span>}
                    {u.telefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.telefono}</span>}
                    {u.zonaOperativa && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Zona {u.zonaOperativa}</span>}
                    {u.puesto && <span className="capitalize">{u.puesto}</span>}
                    {u.created_at && <span>Registrado: {new Date(u.created_at).toLocaleDateString('es-MX')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {u.activo === 2 && (
                    <>
                      <button onClick={() => approveUser(u.uid)}
                        className="flex items-center gap-1 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg uppercase tracking-wider transition-colors"
                        title="Aprobar cuenta">
                        <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                      </button>
                      <button onClick={() => rejectUser(u.uid)}
                        className="flex items-center gap-1 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-lg uppercase tracking-wider transition-colors"
                        title="Rechazar cuenta">
                        <XCircle className="w-3.5 h-3.5" /> Rechazar
                      </button>
                    </>
                  )}
                  {u.activo === 0 && (
                    <button onClick={() => approveUser(u.uid)}
                      className="flex items-center gap-1 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg uppercase tracking-wider transition-colors"
                      title="Reactivar cuenta">
                      <CheckCircle className="w-3.5 h-3.5" /> Reactivar
                    </button>
                  )}
                  {u.activo === 1 && (
                    <button onClick={() => rejectUser(u.uid)}
                      className="flex items-center gap-1 px-3 py-2 bg-slate-700/50 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 text-xs font-bold rounded-lg uppercase tracking-wider transition-colors"
                      title="Desactivar cuenta">
                      <XCircle className="w-3.5 h-3.5" /> Desactivar
                    </button>
                  )}
                  <button onClick={() => deleteUser(u.uid, name)}
                    className="p-2 bg-slate-800/80 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                    title="Eliminar usuario">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
