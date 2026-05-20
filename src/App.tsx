import React, { useState, useEffect, lazy, Suspense } from 'react';
import ShaderBackground from './components/ui/shader-background';
const ManagerView = lazy(() => import('./components/views/ManagerView'));
const MobileUserView = lazy(() => import('./components/views/MobileUserView'));
const RegisterForm = lazy(() => import('./components/views/RegisterForm').then(m => ({ default: m.RegisterForm })));
import Logo from './components/ui/Logo';
import { MatrixInput } from './components/ui/MatrixInput';
import { MatrixText } from './components/ui/matrix-text';
import { LoadingOverlay } from './components/ui/LoadingOverlay';
import { CyberIcon } from './components/ui/CyberIcon';
import { Camera, X, Shield, Smartphone, Lock, Eye, EyeOff, ArrowLeft, Crown, ScanFace, Sun, Moon, UserPlus, Fingerprint, Phone, ChevronLeft } from 'lucide-react';

declare global {
  interface Window { google?: any; msal?: any; }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 23 23" className="w-4 h-4 shrink-0">
      <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
      <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
      <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
      <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
    </svg>
  );
}

export type Role = 'GERENTE' | 'SUPERVISOR' | 'ASESOR';

// Session helpers — server is source of truth; localStorage is only a cache for reloads
const SESSION_KEY = 'hd_session';
function saveSession(user: any) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch {} }
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }
function loadSession(): any | null { try { const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; } catch { return null; } }

const REMEMBER_KEY = 'hd_remember';
function saveRemember(u: string, p: string) { try { localStorage.setItem(REMEMBER_KEY, JSON.stringify({ u, p })); } catch {} }
function clearRemember() { try { localStorage.removeItem(REMEMBER_KEY); } catch {} }
function loadRemember(): { u: string; p: string } | null { try { const s = localStorage.getItem(REMEMBER_KEY); return s ? JSON.parse(s) : null; } catch { return null; } }

export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'microsoft' | null>(null);
  const [authMode, setAuthMode] = useState<'password' | 'phone'>('password');
  const [phoneStep, setPhoneStep] = useState<'enter' | 'verify'>('enter');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);

  const [showProfileWidget, setShowProfileWidget] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const session = loadSession();
    if (session?.uid && session?.role) {
      setCurrentUser(session);
      setRole(session.role as Role);
      const av = localStorage.getItem(`hd_avatar_${session.uid}`);
      if (av) setAvatarUrl(av);
    } else {
      const rem = loadRemember();
      if (rem) { setUsername(rem.u); setPassword(rem.p); setRememberMe(true); }
    }
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(setBiometricAvailable).catch(() => {});
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    h(); window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLightMode);
  }, [isLightMode]);

  const applyLogin = (user: any) => {
    saveSession(user);
    setCurrentUser(user);
    setRole(user.role as Role);
    const av = localStorage.getItem(`hd_avatar_${user.uid}`);
    if (av) setAvatarUrl(av);
    setUsername(''); setPassword('');
    setPendingRole(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Completa usuario y contraseña.'); return; }
    setError(''); setLoggingIn(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Error al iniciar sesión.'); return; }
      if (rememberMe) saveRemember(username, password); else clearRemember();
      applyLogin(data);
    } catch {
      setError('No se pudo conectar al servidor.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError('');
    if (!window.PublicKeyCredential) { setError('Tu navegador no soporta biométrico.'); return; }
    try {
      // Buscar credenciales biométricas guardadas localmente
      const stored = localStorage.getItem('hd_biometric_creds');
      if (!stored) { setError('No hay cuentas con biométrico en este dispositivo.'); return; }
      const creds: Array<{ uid: string; email: string; credId: string }> = JSON.parse(stored);
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: creds.map(c => ({
            type: 'public-key' as const,
            id: Uint8Array.from(atob(c.credId.replace(/-/g,'+').replace(/_/g,'/')), x => x.charCodeAt(0)),
          })),
        },
      }) as PublicKeyCredential | null;
      if (!assertion) { setError('Autenticación cancelada.'); return; }
      const rawId = new Uint8Array(assertion.rawId);
      const idB64 = btoa(String.fromCharCode(...rawId)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const matched = creds.find(c => c.credId === idB64);
      if (!matched) { setError('Credencial no reconocida.'); return; }
      // Verificar que el usuario sigue activo en el servidor
      const r = await fetch(`/api/users/${matched.uid}`).catch(() => null);
      if (!r?.ok) { setError('No se pudo verificar la cuenta.'); return; }
      const user = await r.json();
      if (user.activo === 2) { setError('Cuenta pendiente de aprobación.'); return; }
      if (user.activo === 0) { setError('Cuenta desactivada.'); return; }
      applyLogin({ ...user, displayName: user.nombre });
    } catch (err: any) {
      setError(err.message || 'Falló la autenticación biométrica.');
    }
  };

  const loadScript = (src: string, test: () => boolean): Promise<void> =>
    new Promise((res, rej) => {
      if (test()) return res();
      const s = document.createElement('script');
      s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error(`No se pudo cargar: ${src}`));
      document.head.appendChild(s);
    });

  const handleGoogleLogin = async () => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) { setError('Google OAuth no está configurado. Agrega VITE_GOOGLE_CLIENT_ID al .env'); return; }
    setOauthLoading('google'); setError('');
    try {
      await loadScript('https://accounts.google.com/gsi/client', () => !!window.google?.accounts);
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          try {
            const r = await fetch('/api/auth/oauth', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ provider: 'google', idToken: response.credential }),
            });
            const data = await r.json();
            if (!r.ok) { setError(data.error || 'Error al iniciar con Google.'); return; }
            applyLogin(data);
          } catch { setError('Error de conexión con Google.'); }
          finally { setOauthLoading(null); }
        },
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) setOauthLoading(null);
      });
    } catch (err: any) { setError(err.message || 'Error al cargar Google OAuth.'); setOauthLoading(null); }
  };

  const handleMicrosoftLogin = async () => {
    const clientId = (import.meta as any).env?.VITE_MICROSOFT_CLIENT_ID;
    if (!clientId) { setError('Microsoft OAuth no está configurado. Agrega VITE_MICROSOFT_CLIENT_ID al .env'); return; }
    setOauthLoading('microsoft'); setError('');
    try {
      await loadScript('https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js', () => !!window.msal);
      const msalInstance = new window.msal.PublicClientApplication({
        auth: { clientId, redirectUri: window.location.origin },
        cache: { cacheLocation: 'localStorage' },
      });
      await msalInstance.initialize();
      const result = await msalInstance.loginPopup({ scopes: ['openid', 'profile', 'email', 'User.Read'] });
      const r = await fetch('/api/auth/oauth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'microsoft', idToken: result.idToken, email: result.account?.username, name: result.account?.name }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Error al iniciar con Microsoft.'); return; }
      applyLogin(data);
    } catch (err: any) {
      if (err?.errorCode !== 'user_cancelled') setError(err.message || 'Error al iniciar con Microsoft.');
    } finally { setOauthLoading(null); }
  };

  const handlePhoneSend = async () => {
    if (!phoneNumber) { setError('Ingresa tu número de teléfono.'); return; }
    setPhoneSending(true); setError('');
    try {
      const r = await fetch('/api/auth/phone/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Error al enviar el código.'); return; }
      setPhoneStep('verify');
    } catch { setError('No se pudo enviar el código. Verifica tu conexión.'); }
    finally { setPhoneSending(false); }
  };

  const handlePhoneVerify = async () => {
    if (!otpCode) { setError('Ingresa el código de verificación.'); return; }
    setPhoneVerifying(true); setError('');
    try {
      const r = await fetch('/api/auth/phone/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, code: otpCode }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Código incorrecto.'); return; }
      applyLogin(data);
    } catch { setError('No se pudo verificar el código.'); }
    finally { setPhoneVerifying(false); }
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setRole(null);
    setAvatarUrl(null);
    setPendingRole(null);
    const rem = loadRemember();
    if (rem) { setUsername(rem.u); setPassword(rem.p); setRememberMe(true); }
    else { setUsername(''); setPassword(''); setRememberMe(false); }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setAvatarUrl(url);
      if (currentUser?.uid) try { localStorage.setItem(`hd_avatar_${currentUser.uid}`, url); } catch {}
      setAvatarUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const cancelLogin = () => { setPendingRole(null); setIsRegistering(false); setUsername(''); setPassword(''); setError(''); setAuthMode('password'); setPhoneStep('enter'); setPhoneNumber(''); setOtpCode(''); };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-cyber-black text-[var(--theme-text-main)] font-sans relative transition-colors duration-500">
      <LoadingOverlay visible={isLoading} text="Conectando..." />

      {!role && (
        <button onClick={() => setIsLightMode(!isLightMode)}
          className="absolute top-6 right-6 z-50 p-3 rounded-full hover:bg-cyber-electric/10 border border-cyber-electric/30 text-cyber-electric transition-all glass-panel focus:outline-none">
          {isLightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      )}

      {/* Avatar widget */}
      {role && (
        <div className="absolute top-6 right-6 z-50">
          <button onClick={() => setShowProfileWidget(!showProfileWidget)}
            className="w-11 h-11 rounded-full border border-cyber-electric/50 overflow-hidden shadow-[0_0_15px_rgba(3,154,220,0.3)] hover:shadow-cyan-400/50 transition-all focus:outline-none">
            {avatarUrl
              ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-cyber-dark flex items-center justify-center text-cyber-neon font-bold text-sm">
                  {(currentUser?.nombre || currentUser?.email || 'U')[0].toUpperCase()}
                </div>}
          </button>
          {showProfileWidget && (
            <div className="absolute right-0 mt-3 w-64 glass-panel rounded-2xl p-4 shadow-2xl border border-cyber-electric/30 animate-in fade-in slide-in-from-top-4">
              <button onClick={() => setShowProfileWidget(false)} className="absolute top-2 right-2 p-1 text-cyber-electric/50 hover:text-white"><X className="w-4 h-4" /></button>
              <div className="flex flex-col items-center mt-2 group relative">
                <div className="w-20 h-20 rounded-full border-2 border-cyber-electric overflow-hidden mb-3 relative">
                  {avatarUrl
                    ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-cyber-dark flex items-center justify-center text-cyber-neon font-bold text-2xl">
                        {(currentUser?.nombre || currentUser?.email || 'U')[0].toUpperCase()}
                      </div>}
                  <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    {avatarUploading
                      ? <div className="w-5 h-5 border-2 border-cyber-electric/30 border-t-cyber-electric rounded-full animate-spin" />
                      : <Camera className="w-6 h-6 text-white" />}
                    <input type="file" accept="image/*" className="hidden" disabled={avatarUploading} onChange={handleAvatarUpload} />
                  </label>
                </div>
                <h4 className="text-white font-bold text-sm truncate w-full text-center">{currentUser?.nombre || currentUser?.email}</h4>
                <p className="text-cyber-electric/70 text-xs font-mono mb-4">{role}</p>
                <button onClick={() => { setShowProfileWidget(false); handleLogout(); }}
                  className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm font-bold border border-red-500/30 transition-colors">
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-0 z-0 pointer-events-none opacity-60">
        <ShaderBackground isLightMode={isLightMode} />
      </div>

      {/* Role Selector */}
      {role === null && pendingRole === null && !isRegistering && (
        <div className="relative z-10 flex flex-col items-center h-full px-6 overflow-y-auto py-12">
          <div className="w-full flex flex-col items-center my-auto shrink-0">
            <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-center mb-6 relative">
                <div className="absolute inset-0 bg-cyber-electric/20 blur-3xl rounded-full" />
                <Logo className="w-24 h-24 md:w-36 md:h-36 relative z-10 drop-shadow-[0_0_15px_rgba(0,229,255,0.5)]" />
              </div>
              <h1 className="mb-4 drop-shadow-md px-4">
                <MatrixText text="Heavenly Dreams" className="text-2xl sm:text-3xl md:text-5xl font-bold font-sans uppercase tracking-[0.1em] sm:tracking-[0.15em] flex-nowrap" />
              </h1>
              <p className="text-cyber-electric/80 max-w-md mx-auto font-medium uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[10px] sm:text-sm px-4">
                Heavenly Dreams Sas De Cv
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700 px-4 sm:px-0">
              <RoleButton title="Gerencia / Admin" desc="Acceso Total Enterprise" icon={Crown} color="yellow" onClick={() => setPendingRole('GERENTE')} />
              <RoleButton title="Supervisor" desc="Control & Monitoreo IA" icon={Shield} color="purple" onClick={() => setPendingRole('SUPERVISOR')} />
              <RoleButton title="Asesor Comercial" desc="Operativa & Ventas IA" icon={ScanFace} color="pink" onClick={() => setPendingRole('ASESOR')} />
            </div>
            <div className="mt-8 sm:mt-12 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
              <button onClick={() => setIsRegistering(true)}
                className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl border border-cyber-electric/30 text-cyber-electric hover:bg-cyber-matrix/20 hover:border-cyber-matrix hover:text-white hover:shadow-[0_0_15px_rgba(0,255,136,0.5)] transition-all font-bold uppercase tracking-widest text-[10px] sm:text-sm flex items-center gap-3 backdrop-blur-md group">
                <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" /> Iniciar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Screen */}
      {role === null && pendingRole !== null && !isRegistering && (
        <div className="relative z-10 flex flex-col items-center h-[100dvh] px-4 sm:px-6 overflow-y-auto py-8 sm:py-12">
          <button onClick={cancelLogin}
            className="absolute top-6 left-6 sm:top-8 sm:left-8 p-2 sm:p-3 rounded-full hover:bg-cyber-electric/10 border border-cyber-electric/30 text-cyber-electric hover:text-white transition-all backdrop-blur-md group z-50">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="w-full max-w-md glass-panel-neon rounded-3xl p-6 sm:p-8 animate-in zoom-in-95 duration-300 relative overflow-hidden my-auto shrink-0 shadow-2xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-electric/20 blur-3xl rounded-full" />
            <div className="absolute -left-2 top-10 w-1 h-12 bg-cyber-neon rounded-r-md" />
            <div className="absolute -right-2 bottom-10 w-1 h-12 bg-cyber-electric rounded-l-md" />
            <div className="flex justify-center mb-4 sm:mb-6 relative z-10">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center border bg-cyber-electric/10 border-cyber-neon/50 text-cyber-neon shadow-[0_0_20px_rgba(0,229,255,0.3)]">
                {pendingRole === 'GERENTE' ? <Shield className="w-6 h-6 sm:w-8 sm:h-8" /> : <Smartphone className="w-6 h-6 sm:w-8 sm:h-8" />}
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-center text-white mb-1 sm:mb-2 uppercase tracking-wide">Bienvenido al Sistema</h2>
            <p className="text-cyber-electric text-[10px] sm:text-xs text-center mb-6 sm:mb-8 uppercase tracking-[0.1em]">
              Protocolo: <strong className="text-white">{pendingRole === 'GERENTE' ? 'Gerencia / Admin' : pendingRole === 'SUPERVISOR' ? 'Supervisor' : 'Asesor'}</strong>
            </p>
            {authMode === 'password' ? (
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 relative z-10">
              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Usuario</label>
                <MatrixInput type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario o email" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Contraseña</label>
                <div className="relative group">
                  <MatrixInput type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-cyber-electric/50 hover:text-cyber-neon transition-colors">
                    {showPassword ? <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="p-2 sm:p-3 rounded-xl bg-red-900/30 border border-red-500/50 text-red-400 text-xs flex items-center gap-2 animate-in slide-in-from-top-2">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium tracking-wide text-[10px] sm:text-xs">{error}</span>
                </div>
              )}
              <div className="flex items-center justify-between w-full gap-3">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="w-3.5 h-3.5 accent-cyber-neon cursor-pointer" />
                  <span className="text-[10px] text-cyber-electric/80 group-hover:text-cyber-neon uppercase tracking-widest font-bold transition-colors">Recordarme</span>
                </label>
                <button type="button" onClick={() => setError('Contacta al administrador para restablecer tu contraseña.')}
                  className="text-[10px] text-cyber-electric/70 hover:text-cyber-neon uppercase tracking-widest font-bold transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <button type="submit" disabled={loggingIn}
                className="w-full mt-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 bg-cyber-electric hover:bg-cyber-neon text-cyber-black shadow-[0_0_20px_rgba(3,154,220,0.5)] uppercase tracking-wider text-sm">
                {loggingIn
                  ? <div className="w-5 h-5 border-2 border-cyber-black/30 border-t-cyber-black rounded-full animate-spin" />
                  : <><Lock className="w-4 h-4" /> Entrar</>}
              </button>

              {/* Alternative auth methods */}
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 h-px bg-cyber-electric/20" />
                <span className="text-[9px] uppercase tracking-widest text-cyber-electric/60 font-bold">o accede con</span>
                <div className="flex-1 h-px bg-cyber-electric/20" />
              </div>

              <div className="grid grid-cols-1 gap-2">
                {biometricAvailable && (
                  <button type="button" onClick={handleBiometricLogin}
                    className="w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] bg-cyber-dark/50 hover:bg-cyber-neon/10 text-cyber-neon border border-cyber-neon/40 uppercase tracking-wider text-xs">
                    <Fingerprint className="w-4 h-4" /> Huella digital / Face ID
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={handleGoogleLogin} disabled={!!oauthLoading}
                    className="py-2.5 rounded-xl flex items-center justify-center gap-2 border border-cyber-electric/30 text-white hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-wide disabled:opacity-50">
                    {oauthLoading === 'google'
                      ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      : <GoogleIcon />}
                    Google
                  </button>
                  <button type="button" onClick={handleMicrosoftLogin} disabled={!!oauthLoading}
                    className="py-2.5 rounded-xl flex items-center justify-center gap-2 border border-cyber-electric/30 text-white hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-wide disabled:opacity-50">
                    {oauthLoading === 'microsoft'
                      ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      : <MicrosoftIcon />}
                    Microsoft
                  </button>
                </div>
                <button type="button" onClick={() => { setAuthMode('phone'); setError(''); setPhoneStep('enter'); setOtpCode(''); }}
                  className="w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] bg-cyber-dark/50 hover:bg-cyber-electric/10 text-cyber-electric border border-cyber-electric/40 uppercase tracking-wider text-xs">
                  <Phone className="w-4 h-4" /> Número celular
                </button>
              </div>
            </form>
            ) : (
            /* ── Phone OTP form ── */
            <div className="space-y-4 sm:space-y-5 relative z-10">
              <button type="button" onClick={() => { setAuthMode('password'); setPhoneStep('enter'); setError(''); }}
                className="flex items-center gap-1.5 text-cyber-electric/70 hover:text-cyber-neon text-xs font-bold uppercase tracking-widest transition-colors group">
                <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> Volver
              </button>

              {phoneStep === 'enter' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Número de Teléfono</label>
                    <MatrixInput
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="55 1234 5678"
                    />
                    <p className="text-[9px] text-cyber-electric/50 pl-1">Recibirás un código de 6 dígitos por SMS o WhatsApp.</p>
                  </div>
                  {error && (
                    <div className="p-2 sm:p-3 rounded-xl bg-red-900/30 border border-red-500/50 text-red-400 text-xs flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[10px] sm:text-xs">{error}</span>
                    </div>
                  )}
                  <button type="button" onClick={handlePhoneSend} disabled={phoneSending}
                    className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-70 bg-cyber-electric hover:bg-cyber-neon text-cyber-black shadow-[0_0_20px_rgba(3,154,220,0.5)] uppercase tracking-wider text-sm">
                    {phoneSending
                      ? <div className="w-5 h-5 border-2 border-cyber-black/30 border-t-cyber-black rounded-full animate-spin" />
                      : <><Phone className="w-4 h-4" /> Enviar Código</>}
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center py-2">
                    <p className="text-cyber-electric/70 text-xs">Código enviado a</p>
                    <p className="text-white font-bold text-sm mt-1">{phoneNumber}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Código de Verificación</label>
                    <MatrixInput
                      type="text"
                      inputMode="numeric"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="_ _ _ _ _ _"
                    />
                  </div>
                  {error && (
                    <div className="p-2 sm:p-3 rounded-xl bg-red-900/30 border border-red-500/50 text-red-400 text-xs flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[10px] sm:text-xs">{error}</span>
                    </div>
                  )}
                  <button type="button" onClick={handlePhoneVerify} disabled={phoneVerifying}
                    className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-70 bg-cyber-electric hover:bg-cyber-neon text-cyber-black shadow-[0_0_20px_rgba(3,154,220,0.5)] uppercase tracking-wider text-sm">
                    {phoneVerifying
                      ? <div className="w-5 h-5 border-2 border-cyber-black/30 border-t-cyber-black rounded-full animate-spin" />
                      : <><Shield className="w-4 h-4" /> Verificar y Entrar</>}
                  </button>
                  <button type="button" onClick={() => { setPhoneStep('enter'); setOtpCode(''); setError(''); }}
                    className="w-full py-2 text-[10px] text-cyber-electric/60 hover:text-cyber-neon uppercase tracking-widest font-bold transition-colors">
                    ¿No llegó el código? Reenviar
                  </button>
                </>
              )}
            </div>
            )}
          </div>
        </div>
      )}

      {/* Register */}
      {role === null && isRegistering && (
        <div className="relative z-10 flex flex-col items-center h-full px-6 overflow-y-auto py-12">
          <Suspense fallback={<LoadingOverlay visible text="Cargando…" />}>
            <RegisterForm onBack={() => setIsRegistering(false)} pendingRole={pendingRole} />
          </Suspense>
        </div>
      )}

      {/* Main App */}
      {role && (
        <div className="h-full flex flex-col relative w-full">
          <div className="flex-1 overflow-hidden">
            <Suspense fallback={<LoadingOverlay visible text="Cargando…" />}>
              {isMobile
                ? <MobileUserView role={role} onBack={handleLogout} currentUser={currentUser} isLightMode={isLightMode} onToggleTheme={() => setIsLightMode(!isLightMode)} />
                : <ManagerView role={role} onBack={handleLogout} currentUser={currentUser} isLightMode={isLightMode} onToggleTheme={() => setIsLightMode(!isLightMode)} />}
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}

const RoleButton = React.memo(function RoleButton({ title, desc, icon: Icon, color = 'cyan', onClick }: any) {
  return (
    <button onClick={onClick}
      className="group glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-8 flex flex-col items-center text-center transition-all duration-300 hover:bg-cyber-electric/10 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(3,154,220,0.2)] border-cyber-electric/20 hover:border-cyber-neon/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyber-electric/0 to-cyber-electric/5 group-hover:to-cyber-neon/10 transition-colors" />
      <div className="mb-4 sm:mb-8">
        <div className="sm:hidden"><CyberIcon icon={Icon} color={color} size="lg" glowOpacity={0.6} /></div>
        <div className="hidden sm:block"><CyberIcon icon={Icon} color={color} size="xl" glowOpacity={0.6} /></div>
      </div>
      <h2 className="text-lg sm:text-2xl font-bold text-[var(--theme-text-main)] mb-1 sm:mb-2 uppercase tracking-wide group-hover:text-cyber-neon transition-colors">{title}</h2>
      <p className="text-[10px] sm:text-sm font-medium text-cyber-electric/70 uppercase tracking-widest leading-tight">{desc}</p>
    </button>
  );
});
