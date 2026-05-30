import { useState, useEffect, useCallback } from 'react';

export interface OfflineQueueItem {
  id: string;
  type: 'sale';
  data: unknown;
  queuedAt: string;
}

const QUEUE_KEY = 'hd_offline_queue';

function getQueue(): OfflineQueueItem[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function saveQueue(q: OfflineQueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

function addClientMutationId(type: 'sale', data: unknown, queueId: string) {
  if (type !== 'sale' || !data || typeof data !== 'object' || Array.isArray(data)) return data;
  const payload = data as Record<string, any>;
  return {
    ...payload,
    clientMutationId: payload.clientMutationId || queueId,
  };
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getQueue().length);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = () => setPendingCount(getQueue().length);

  const enqueue = useCallback((type: 'sale', data: unknown) => {
    const q = getQueue();
    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    q.push({ id, type, data: addClientMutationId(type, data, id), queuedAt: new Date().toISOString() });
    saveQueue(q);
    setPendingCount(q.length);
  }, []);

  const syncNow = useCallback(async () => {
    const q = getQueue();
    if (!q.length || !navigator.onLine) return;
    setSyncing(true);
    const remaining: OfflineQueueItem[] = [];
    for (const item of q) {
      try {
        const endpoint = item.type === 'sale' ? '/api/mobile/capturas' : '/api/mobile/capturas';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data),
        });
        if (!res.ok) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }
    saveQueue(remaining);
    setPendingCount(remaining.length);
    setSyncing(false);
  }, []);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); syncNow(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [syncNow]);

  // Refresh count periodically
  useEffect(() => {
    const t = setInterval(refreshCount, 3000);
    return () => clearInterval(t);
  }, []);

  return { isOnline, pendingCount, syncing, enqueue, syncNow };
}
