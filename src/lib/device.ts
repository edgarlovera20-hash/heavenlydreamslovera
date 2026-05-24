export function isLikelyMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const mobileUa = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const narrowViewport = Math.min(window.innerWidth || 0, window.screen?.width || 0) <= 820;

  return mobileUa || iPadOS || (coarsePointer && narrowViewport);
}

export function routeToDeviceVersion() {
  const isMobile = isLikelyMobileDevice();
  const path = window.location.pathname;
  const target = isMobile ? '/m/' : '/';

  if (isMobile && !path.startsWith('/m')) {
    window.location.replace(target);
    return true;
  }

  if (!isMobile && path.startsWith('/m')) {
    window.location.replace(target);
    return true;
  }

  return false;
}
