'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Star, Zap, Target } from 'lucide-react';
import { clsx } from 'clsx';
import { get } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface LeaderboardEntry {
  userId: string;
  nombre: string;
  puntos: number;
  ventas: number;
  nivel: number;
  rango: number;
}

const NIVELES = [
  { nombre: 'Novato', min: 0, color: 'text-gray-400', bg: 'bg-gray-800' },
  { nombre: 'Bronce', min: 100, color: 'text-orange-400', bg: 'bg-orange-900/20' },
  { nombre: 'Plata', min: 500, color: 'text-gray-300', bg: 'bg-gray-700/40' },
  { nombre: 'Oro', min: 1000, color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
  { nombre: 'Diamante', min: 5000, color: 'text-blue-400', bg: 'bg-blue-900/20' },
];

function getNivel(puntos: number) {
  return [...NIVELES].reverse().find((n) => puntos >= n.min) ?? NIVELES[0];
}

export default function GamePage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userPoints, setUserPoints] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const stats = await get<{ totalAprobadas: number }>('/sales/stats');
        const pts = (stats.totalAprobadas ?? 0) * 50;
        setUserPoints(pts);
      } catch { /* ignore */ }
      try {
        const data = await get<LeaderboardEntry[]>('/gamification/leaderboard');
        setLeaderboard(data);
      } catch {
        // Show mock data if endpoint not ready
        setLeaderboard([
          { userId: '1', nombre: 'Carlos Hdz', puntos: 2400, ventas: 48, nivel: 3, rango: 1 },
          { userId: '2', nombre: 'María G.', puntos: 1850, ventas: 37, nivel: 3, rango: 2 },
          { userId: '3', nombre: 'Luis M.', puntos: 1200, ventas: 24, nivel: 2, rango: 3 },
        ]);
      }
    };
    load();
  }, []);

  const nivel = getNivel(userPoints);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Centro de Logros</h2>
        <p className="text-sm text-gray-400 mt-1">Tu progreso y ranking de ventas</p>
      </div>

      {/* User stats card */}
      <div className={clsx('rounded-xl border border-gray-800 p-6', nivel.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600/30 text-2xl">
              {user?.nombre?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="font-semibold text-white text-lg">{user?.nombre ?? 'Usuario'}</p>
              <p className={clsx('text-sm font-bold', nivel.color)}>{nivel.nombre}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{userPoints.toLocaleString()}</p>
            <p className="text-xs text-gray-400">puntos</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{nivel.nombre}</span>
            <span>{NIVELES[NIVELES.indexOf(nivel) + 1]?.nombre ?? 'Máximo'}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-indigo-600 transition-all"
              style={{ width: `${Math.min(100, (userPoints / (NIVELES[NIVELES.indexOf(nivel) + 1]?.min ?? userPoints)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Star, label: 'Puntos', value: userPoints.toLocaleString(), color: 'text-yellow-400 bg-yellow-900/20' },
          { icon: Target, label: 'Nivel', value: nivel.nombre, color: 'text-indigo-400 bg-indigo-900/20' },
          { icon: Zap, label: 'Rango', value: leaderboard.findIndex((l) => l.userId === user?.id) >= 0 ? `#${leaderboard.findIndex((l) => l.userId === user?.id) + 1}` : '—', color: 'text-green-400 bg-green-900/20' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className={clsx('flex h-10 w-10 items-center justify-center rounded-lg mb-3', color.split(' ')[1])}>
              <Icon className={clsx('h-5 w-5', color.split(' ')[0])} />
            </div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <h3 className="text-sm font-semibold text-white">Tabla de Líderes</h3>
        </div>
        <div className="divide-y divide-gray-800">
          {leaderboard.map((entry, idx) => (
            <div key={entry.userId} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800/30 transition-colors">
              <span className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold',
                idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                'bg-gray-800 text-gray-500',
              )}>
                {idx + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200">{entry.nombre}</p>
                <p className="text-xs text-gray-500">{entry.ventas} ventas</p>
              </div>
              <span className="text-sm font-bold text-indigo-400">{entry.puntos.toLocaleString()} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
