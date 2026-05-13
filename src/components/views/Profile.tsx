import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Camera, Crown, Flame, Trophy, Target, TrendingUp,
  Award, Star, Zap, ChevronRight, Medal, Clock,
  BarChart2, Shield, Sparkles, DollarSign
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { auth } from '../../lib/firebase';

interface Sale {
  id?: string;
  asesorId?: string;
  status?: string;
  fechaSolicitud?: string;
  rentaMensual?: number;
  nombres?: string;
  folio?: string;
}

interface UserRecord {
  uid: string;
  email: string;
  displayName?: string;
  nombre?: string;
  role?: string;
}

interface TimelineEntry {
  id: string;
  title: string;
  time: string;
  icon: any;
  color: string;
}

function formatRelative(iso?: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '—';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace instantes';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
}

export default function Profile() {
  const session = auth.currentUser;
  const [avatar, setAvatar] = useState<string | null>(
    session?.uid ? localStorage.getItem(`adhdreams_avatar_${session.uid}`) : null
  );
  const [lbFilter, setLbFilter] = useState<'weekly' | 'monthly' | 'all-time'>('weekly');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sales, setSales] = useState<Sale[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);

  useEffect(() => {
    const load = () => {
      try {
        setSales(JSON.parse(localStorage.getItem('adhdreams_sales') || '[]'));
        setUsers(JSON.parse(localStorage.getItem('adhdreams_users') || '[]'));
      } catch {
        setSales([]);
        setUsers([]);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const userName = session?.displayName || session?.email?.split('@')[0] || 'Usuario';
  const userRoleRaw = (session?.role || 'ASESOR').toLowerCase();
  const userRoleLabel = userRoleRaw === 'gerente'
    ? 'gerente'
    : userRoleRaw === 'supervisor' ? 'supervisor' : 'asesor';

  // Per-user stats
  const mySales = useMemo(
    () => sales.filter(s => s.asesorId === session?.uid),
    [sales, session?.uid]
  );
  const ventasPagadas = useMemo(
    () => mySales.filter(s => s.status === 'APROBADA' || s.status === 'PROCEDIO').length,
    [mySales]
  );
  const foliosTotales = mySales.length;
  const successRate = foliosTotales > 0
    ? ((ventasPagadas / foliosTotales) * 100).toFixed(1)
    : '0';

  // Streak: consecutive days with at least one sale, counting back from today
  const streakDays = useMemo(() => {
    if (mySales.length === 0) return 0;
    const dates = new Set(
      mySales
        .map(s => (s.fechaSolicitud || '').split('T')[0])
        .filter(Boolean)
    );
    let streak = 0;
    const day = new Date();
    while (true) {
      const key = day.toISOString().split('T')[0];
      if (dates.has(key)) {
        streak += 1;
        day.setDate(day.getDate() - 1);
      } else if (streak === 0) {
        // Allow today to be empty, count from yesterday
        day.setDate(day.getDate() - 1);
        if (!dates.has(day.toISOString().split('T')[0])) break;
      } else {
        break;
      }
      if (streak > 365) break;
    }
    return streak;
  }, [mySales]);

  const points = (foliosTotales * 10) + (ventasPagadas * 25);
  const xp = points; // Use points as XP equivalent
  const level = Math.floor(xp / 100);
  const xpNextLevel = (level + 1) * 100;
  const xpCurrentLevel = xp % 100;
  const progressPercent = xpCurrentLevel; // already 0-100
  const missingXP = xpNextLevel - xp;

  // Leaderboard built from all users + their sales
  const leaderboard = useMemo(() => {
    const board = users.map(u => {
      const userSales = sales.filter(s => s.asesorId === u.uid);
      const aprobadas = userSales.filter(s => s.status === 'APROBADA' || s.status === 'PROCEDIO').length;
      const pts = (userSales.length * 10) + (aprobadas * 25);
      return {
        id: u.uid,
        name: u.displayName || u.nombre || u.email,
        points: pts,
        folios: userSales.length,
        level: Math.floor(pts / 100),
      };
    });
    // Include current session user if not in users list (e.g., built-in admin)
    if (session?.uid && !users.find(u => u.uid === session.uid)) {
      board.push({
        id: session.uid,
        name: session.displayName || session.email,
        points,
        folios: foliosTotales,
        level,
      });
    }
    return board
      .sort((a, b) => b.points - a.points)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }, [users, sales, session, points, foliosTotales, level]);

  const myRank = leaderboard.find(e => e.id === session?.uid)?.rank || leaderboard.length + 1;
  const isManager = userRoleRaw === 'gerente';
  const hasFireStreak = streakDays >= 7;
  const isTop3 = myRank <= 3;

  // Medals derived from real progress
  const medals = [
    { id: 1, name: 'Primera Venta', icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-400/10', unlocked: foliosTotales >= 1 },
    { id: 2, name: 'Vendedor Activo', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-400/10', unlocked: foliosTotales >= 5 },
    { id: 3, name: 'En Racha', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-400/10', unlocked: streakDays >= 7 },
    { id: 4, name: 'Nivel 5', icon: Shield, color: 'text-purple-400', bg: 'bg-purple-400/10', unlocked: level >= 5 },
    { id: 5, name: 'Top 3 Semanal', icon: Crown, color: 'text-yellow-300', bg: 'bg-yellow-300/10', unlocked: isTop3 && foliosTotales > 0 },
  ];
  const unlockedCount = medals.filter(m => m.unlocked).length;

  // Timeline from the 3 most recent sales
  const timeline: TimelineEntry[] = useMemo(() => {
    const recent = [...mySales]
      .sort((a, b) => (b.fechaSolicitud || '').localeCompare(a.fechaSolicitud || ''))
      .slice(0, 4);
    return recent.map((s, idx) => {
      const isApproved = s.status === 'APROBADA' || s.status === 'PROCEDIO';
      return {
        id: s.id || `t-${idx}`,
        title: isApproved
          ? `Venta APROBADA · ${s.nombres || s.folio || 'Cliente'} (+25 XP)`
          : `Captura registrada · ${s.nombres || s.folio || 'Cliente'} (+10 XP)`,
        time: formatRelative(s.fechaSolicitud),
        icon: isApproved ? DollarSign : Zap,
        color: isApproved ? 'text-emerald-400' : 'text-blue-400',
      };
    });
  }, [mySales]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = reader.result as string;
      setAvatar(url);
      if (session?.uid) {
        try { localStorage.setItem(`adhdreams_avatar_${session.uid}`, url); } catch { /* quota */ }
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full space-y-6 pb-12">

      {/* AI MOTIVATIONAL BANNER */}
      <div className="bg-gradient-to-r from-sky-600/20 to-cyan-600/20 border border-sky-500/30 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_20px_rgba(14,165,233,0.15)]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500/20 rounded-lg">
            <Sparkles className="w-5 h-5 text-sky-400 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sky-100 font-medium text-sm">IA Motivacional</h4>
            <p className="text-sky-300/80 text-xs mt-0.5">
              {foliosTotales === 0
                ? <>Aún no tienes capturas registradas. ¡Empieza tu primera venta y desbloquea XP!</>
                : <>Llevas <strong className="text-white">{foliosTotales} folios</strong>. Te faltan <strong className="text-white">{missingXP} XP</strong> para alcanzar el Nivel {level + 1}.</>
              }
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN: PROFILE CARD & METRICS */}
        <div className="lg:col-span-1 space-y-6">

          {/* PROFILE CARD */}
          <div className={cn(
            "glass-panel rounded-3xl p-6 relative overflow-hidden transition-all duration-500",
            isTop3 ? "ring-2 ring-yellow-400/50 shadow-[0_0_30px_rgba(250,204,21,0.15)]" : ""
          )}>
            {isTop3 && (
              <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400/0 via-yellow-400/10 to-yellow-400/0 animate-spin-slow pointer-events-none" />
            )}

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="relative mb-4 group">
                <div className={cn(
                  "w-28 h-28 rounded-full bg-slate-800 border-4 flex items-center justify-center overflow-hidden transition-all duration-300",
                  isTop3 ? "border-yellow-400/80" : "border-slate-700",
                  hasFireStreak && "shadow-[0_0_25px_rgba(249,115,22,0.5)]"
                )}>
                  {avatar ? (
                    <img src={avatar} alt={`Avatar de ${userName}`} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-bold text-slate-500">{userName.charAt(0).toUpperCase()}</span>
                  )}

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    aria-label="Subir avatar"
                  />
                </div>

                {isManager && (
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-tr from-yellow-500 to-yellow-300 rounded-full flex items-center justify-center shadow-lg border-2 border-[#020617]" title="Gerente">
                    <Crown className="w-4 h-4 text-yellow-950" />
                  </div>
                )}
                {hasFireStreak && (
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-tr from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.8)] border-2 border-[#020617]" title={`${streakDays} días en racha`}>
                    <Flame className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-bold text-white tracking-tight">{userName}</h2>
              <p className="text-sm text-slate-400 uppercase tracking-widest font-medium mt-1">{userRoleLabel}</p>

              <div className="w-full mt-6 bg-slate-900/90 rounded-2xl p-4 border border-white/5">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Nivel Actual</p>
                    <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-400">
                      LVL {level}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-medium">Siguiente: LVL {level + 1}</p>
                    <p className="text-sm font-bold text-slate-300">{xp} / {xpNextLevel} XP</p>
                  </div>
                </div>
                <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* METRICS GRID */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-panel rounded-2xl p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium uppercase tracking-wider">Success Rate</span>
              </div>
              <p className="text-2xl font-bold text-white">{successRate}%</p>
              <p className="text-xs text-slate-500 mt-1">{ventasPagadas} de {foliosTotales} folios</p>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-medium uppercase tracking-wider">Puntos Totales</span>
              </div>
              <p className="text-2xl font-bold text-white">{points}</p>
              <p className="text-xs text-slate-500 mt-1">Ranking: #{myRank}</p>
            </div>
          </div>

          {/* NEXT TARGET ENGINE */}
          <div className="glass-panel bg-gradient-to-br from-transparent to-black/20 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-sky-400" /> Próximo Objetivo
            </h3>
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-300">Subir a LVL {level + 1}</span>
                <span className="text-xs font-bold text-sky-400">Faltan {missingXP} XP</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-6">

          {/* MEDALS SYSTEM */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Medal className="w-5 h-5 text-yellow-400" /> Vitrina de Medallas
              </h3>
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                {unlockedCount} / {medals.length} Desbloqueadas
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {medals.map(medal => (
                <div
                  key={medal.id}
                  className={cn(
                    "flex flex-col items-center text-center p-3 rounded-xl border transition-all",
                    medal.unlocked
                      ? "bg-slate-800/50 border-white/10 hover:bg-slate-800"
                      : "bg-slate-900/20 border-transparent opacity-40 grayscale"
                  )}
                >
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mb-2", medal.bg)}>
                    <medal.icon className={cn("w-6 h-6", medal.color)} />
                  </div>
                  <span className="text-xs font-medium text-slate-300 leading-tight">{medal.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* LEADERBOARD & TIMELINE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* LEADERBOARD */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" /> Leaderboard
                </h3>
              </div>

              <div className="flex bg-slate-800/50 rounded-lg p-1 mb-4" role="tablist">
                {(['weekly', 'monthly', 'all-time'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setLbFilter(filter)}
                    role="tab"
                    aria-selected={lbFilter === filter}
                    className={cn(
                      "flex-1 text-xs font-medium py-1.5 rounded-md transition-all capitalize",
                      lbFilter === filter
                        ? "bg-slate-700 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {filter === 'weekly' ? 'Semana' : filter === 'monthly' ? 'Mes' : 'Global'}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-2">
                {leaderboard.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Aún no hay personal registrado en el sistema.
                  </div>
                ) : leaderboard.slice(0, 5).map((user) => (
                  <div
                    key={user.id}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-xl transition-colors",
                      user.id === session?.uid ? "bg-sky-500/10 border border-sky-500/20" : "hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      user.rank === 1 ? "bg-yellow-400/20 text-yellow-400" :
                      user.rank === 2 ? "bg-slate-300/20 text-slate-300" :
                      user.rank === 3 ? "bg-orange-400/20 text-orange-400" : "bg-slate-800 text-slate-500"
                    )}>
                      {user.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", user.id === session?.uid ? "text-sky-400" : "text-slate-200")}>
                        {user.name}
                      </p>
                      <p className="text-[10px] text-slate-500">LVL {user.level} · {user.folios} folios</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{user.points}</p>
                      <p className="text-[10px] text-slate-500">PTS</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TIMELINE */}
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-sky-400" /> Historial de Logros
              </h3>

              {timeline.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Tu historial aparecerá aquí cuando registres tu primera venta.</p>
                </div>
              ) : (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-white/10 before:to-transparent">
                  {timeline.map((item) => (
                    <div key={item.id} className="relative flex items-center gap-4 group">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#020617] bg-slate-800 text-slate-500 shadow shrink-0 z-10">
                        <item.icon className={cn("w-4 h-4", item.color)} />
                      </div>
                      <div className="flex-1 bg-slate-800/50 p-4 rounded-xl border border-white/5 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-slate-200 text-sm">{item.title}</h4>
                        </div>
                        <time className="text-xs font-medium text-slate-500">{item.time}</time>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
