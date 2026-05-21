import { useEffect, useRef } from 'react';

const NOTIFIED_KEY = 'adhdreams_notified_followups';

function getNotified(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]')); } catch { return new Set(); }
}
function markNotified(id: string) {
  const s = getNotified(); s.add(id);
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...s]));
}

export function useFollowUpReminders() {
  const permissionAsked = useRef(false);

  useEffect(() => {
    const requestAndCheck = async () => {
      if (!('Notification' in window)) return;

      // Ask once
      if (!permissionAsked.current && Notification.permission === 'default') {
        permissionAsked.current = true;
        await Notification.requestPermission();
      }
      if (Notification.permission !== 'granted') return;

      const check = () => {
        try {
          const sales: any[] = JSON.parse(localStorage.getItem('adhdreams_sales') || '[]');
          const notified = getNotified();
          const now = Date.now();

          sales.forEach(s => {
            const id = s.id || s.folio;
            if (!id || notified.has(id)) return;
            if (s.status !== 'PENDIENTE') return;

            const created = new Date(s.fechaSolicitud || 0).getTime();
            const hoursOld = (now - created) / (1000 * 60 * 60);

            // Remind at 24h and 48h
            if (hoursOld >= 24) {
              const name = [s.nombres, s.apellidoPaterno].filter(Boolean).join(' ') || 'Cliente';
              new Notification('⏰ Seguimiento pendiente', {
                body: `${name} — Folio ${s.folio || id} lleva ${Math.round(hoursOld)} horas en PENDIENTE. ¡Da seguimiento!`,
                icon: '/icon-192.png',
                tag: `followup-${id}`,
              });
              markNotified(id);
            }
          });
        } catch { /* ignore */ }
      };

      check();
      const t = setInterval(check, 60 * 60 * 1000); // every hour
      return () => clearInterval(t);
    };

    requestAndCheck();
  }, []);
}
