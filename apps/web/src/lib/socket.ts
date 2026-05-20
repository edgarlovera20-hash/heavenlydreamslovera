'use client';

import { io, Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';

// ============================================================
// Socket instance (singleton)
// ============================================================
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';

    socket = io(`${wsUrl}/realtime`, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: () => {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('hd_auth');
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as { state?: { token?: string } };
              return { token: parsed?.state?.token ?? '' };
            } catch {
              return { token: '' };
            }
          }
        }
        return { token: '' };
      },
    });
  }
  return socket;
}

export { socket };

// ============================================================
// useSocket hook
// ============================================================
interface UseSocketOptions {
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { autoConnect = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    if (autoConnect && !s.connected) {
      s.connect();
    }

    setIsConnected(s.connected);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, [autoConnect]);

  const emit = (event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  };

  const on = (event: string, callback: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, callback);
    return () => {
      socketRef.current?.off(event, callback);
    };
  };

  return {
    socket: socketRef.current,
    isConnected,
    emit,
    on,
  };
}
