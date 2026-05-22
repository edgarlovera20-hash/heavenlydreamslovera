const SESSION_KEY = 'hd_session';
const REMEMBER_USER_KEY = 'hd_remember_user';

const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/validate/email',
  '/api/enterprise/health',
];

function readSession(): any {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') || {}; } catch { return {}; }
}

function writeSession(session: any) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function rememberUsername(username: string, email?: string) {
  try { localStorage.setItem(REMEMBER_USER_KEY, JSON.stringify({ username, email })); } catch {}
}

export function forgetRememberedUsername() {
  try { localStorage.removeItem(REMEMBER_USER_KEY); } catch {}
}

export function loadRememberedUsername(): { username: string; email?: string } | null {
  try {
    const value = localStorage.getItem(REMEMBER_USER_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function isApiRequest(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function pathOf(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  return new URL(url, window.location.origin).pathname;
}

function isPublicApi(input: RequestInfo | URL, init?: RequestInit) {
  const path = pathOf(input);
  if (path === '/api/users' && (init?.method || 'GET').toUpperCase() === 'POST') {
    try {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      return body?.fromRegistration === true;
    } catch {
      return false;
    }
  }
  return PUBLIC_API_PATHS.includes(path);
}

async function refreshSession(originalFetch: typeof fetch) {
  const session = readSession();
  if (!session.refreshToken) return null;
  const res = await originalFetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!res.ok) {
    clearSession();
    return null;
  }
  const next = await res.json();
  writeSession(next);
  return next;
}

export function installApiFetch() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!isApiRequest(input)) return originalFetch(input, init);

    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
    const session = readSession();
    if (session.accessToken && !isPublicApi(input, init)) {
      headers.set('Authorization', `Bearer ${session.accessToken}`);
    }

    const first = await originalFetch(input, { ...init, headers });
    if (first.status !== 401 || isPublicApi(input, init) || pathOf(input) === '/api/auth/refresh') return first;

    const refreshed = await refreshSession(originalFetch);
    if (!refreshed?.accessToken) return first;
    const retryHeaders = new Headers(init.headers || {});
    if (!retryHeaders.has('Content-Type') && init.body) retryHeaders.set('Content-Type', 'application/json');
    retryHeaders.set('Authorization', `Bearer ${refreshed.accessToken}`);
    return originalFetch(input, { ...init, headers: retryHeaders });
  };
}
