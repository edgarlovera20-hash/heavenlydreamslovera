import { useState, useEffect, useCallback } from 'react';

export interface OfflineQueueItem {
  id: string;
  type: 'sale';
  data: unknown;
  queuedAt: string;
}

const QUEUE_KEY = 'adhdreams_offline_queue';

function getQueue(): OfflineQueueItem[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function saveQueue(q: OfflineQueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getQueue().length);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = () => setPendingCount(getQueue().length);

  const enqueue = useCallback((type: 'sale', data: unknown) => {
    const q = getQueue();
    q.push({ id: `q-${Date.now()}`, type, data, queuedAt: new Date().toISOString() });
    saveQueue(q);
    setPendingCount(q.length);
  }, []);

  // Simulated sync: moves all queued items into adhdreams_sales and clears the queue.
  // In production this would POST to Firebase / backend.
  const syncNow = useCallback(async () => {
    const q = getQueue();
    if (!q.length || !navigator.onLine) return;
    setSyncing(true);
    await new Promise(r => setTimeout(r, 800)); // simulate network latency
    const sales: unknown[] = JSON.parse(localStorage.getItem('adhdreams_sales') || '[]');
    q.forEach(item => { if (item.type === 'sale') sales.push(item.data); });
    localStorage.setItem('adhdreams_sales', JSON.stringify(sales));
    saveQueue([]);
    setPendingCount(0);
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
