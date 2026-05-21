import { toast } from 'sonner';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn("This browser does not support desktop notification");
    return;
  }
  
  if (Notification.permission === 'granted') {
    return;
  }
  
  if (Notification.permission !== 'denied') {
    await Notification.requestPermission();
  }
};

export const sendPushNotification = (title: string, options?: NotificationOptions & { useToast?: boolean, type?: 'info' | 'success' | 'warning' | 'error' }) => {
  // 1. Show in-app Toast
  if (options?.useToast !== false) {
    const toastMessage = options?.body ? options.body : title;
    switch (options?.type) {
      case 'success': toast.success(title, { description: options?.body }); break;
      case 'warning': toast.warning(title, { description: options?.body }); break;
      case 'error': toast.error(title, { description: options?.body }); break;
      default: toast.info(title, { description: options?.body }); break;
    }
  }

  // 2. Show native Push Notification if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/vite.svg',
      ...options
    });
  }
};
