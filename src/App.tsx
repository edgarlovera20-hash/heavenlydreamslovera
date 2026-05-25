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
import { Camera, X, Shield, Smartphone, Lock, Eye, EyeOff, ArrowLeft, Crown, ScanFace, Sun, Moon, UserPlus, Fingerprint } from 'lucide-react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { clearSession as clearApiSession, forgetRememberedUsername, loadRememberedUsername, persistSession, rememberUsername } from './lib/apiClient';

export type Role = 'GERENTE' | 'ADMINISTRACION' | 'SUPERVISOR' | 'ASESOR';

// Session helpers — server is source of truth; localStorage is only a cache for reloads
const SESSION_KEY = 'hd_session';
function saveSession(user: any) { return persistSession(user); }
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }
function loadSession(): any | null { try { const s = localStorage.getItem(SESSION_KEY); return s ? persistSession(JSON.parse(s)) : null; } catch { return null; } }

function passkeyUnavailableMessage() {
  return 'Este navegador no soporta passkeys. Abre la app en Chrome o Edge. En produccion usa HTTPS y un dominio, no IP directa.';
}

function friendlyPasskeyError(err: any) {
  const raw = String(err?.message || err || '');
  if (/not allowed|timed out|privacy-considerations|cancel/i.test(raw)) {
    return 'El navegador cancelo la passkey o no permite WebAuthn aqui. Intenta en Chrome/Edge, con HTTPS y dominio valido.';
  }
  if (/secure|https|domain|IP directa|WEBAUTHN/i.test(raw)) return raw;
  return raw || 'No se pudo completar la passkey.';
}

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
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [googleOAuthAvailable, setGoogleOAuthAvailable] = useState(false);
  const [continuingWithoutPasskey, setContinuingWithoutPasskey] = useState(false);
  const [passkeyUserId, setPasskeyUserId] = useState<string | null>(null);
  const [passkeyEnrollmentRequired, setPasskeyEnrollmentRequired] = useState(false);

  const [showProfileWidget, setShowProfileWidget] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const session = loadSession();
    if (session?.uid && session?.role) {
      setCurrentUser(session);
      setRole(session.role as Role);
      setPasskeyEnrollmentRequired(false);
      const av = localStorage.getItem(`hd_avatar_${session.uid}`);
      if (av) setAvatarUrl(av);
    } else {
      try { localStorage.removeItem('hd_remember'); localStorage.removeItem('adhdreams_remember'); } catch {}
      const rem = loadRememberedUsername();
      if (rem) { setUsername(rem.username); setRememberMe(true); }
    }
    const supportsWebAuthn = typeof window !== 'undefined' && Boolean(window.PublicKeyCredential) && window.isSecureContext;
    setPasskeySupported(false);
    if (supportsWebAuthn) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => {
          setBiometricAvailable(available);
          setPasskeySupported(available);
        })
        .catch(() => {
          setBiometricAvailable(false);
          setPasskeySupported(false);
        });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    h(); window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/oauth/status')
      .then(r => r.ok ? r.json() : null)
      .then(status => {
        if (!cancelled) setGoogleOAuthAvailable(Boolean(status?.google));
      })
      .catch(() => {
        if (!cancelled) setGoogleOAuthAvailable(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLightMode);
  }, [isLightMode]);

  const applyLogin = (user: any) => {
    const session = saveSession(user);
    setCurrentUser(session);
    setRole(session.role as Role);
    const av = localStorage.getItem(`hd_avatar_${session.uid}`);
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
      if (data.requiresWebAuthn) {
        setPasskeyUserId(data.webAuthnUserId);
        await handleBiometricLogin(data.webAuthnUserId);
        return;
      }
      if (rememberMe) rememberUsername(username); else forgetRememberedUsername();
      applyLogin(data);
      setPasskeyEnrollmentRequired(false);
    } catch {
      setError('No se pudo conectar al servidor.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleBiometricLogin = async (userIdOverride?: string) => {
    setError('');
    if (!passkeySupported) { setError(passkeyUnavailableMessage()); return; }
    const targetUserId = userIdOverride || passkeyUserId || currentUser?.uid;
    if (!targetUserId && !username) { setError('Ingresa tu usuario para usar passkey.'); return; }
    try {
      const optionsRes = await fetch('/api/webauthn/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId, username }),
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) { setError(options.error || 'No hay passkey registrada.'); return; }
      const verifiedUserId = options.userId || targetUserId;
      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch('/api/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: verifiedUserId, response: assertion }),
      });
      const user = await verifyRes.json();
      if (!verifyRes.ok) { setError(user.error || 'Falló la autenticación biométrica.'); return; }
      if (rememberMe && username) rememberUsername(username); else if (!rememberMe) forgetRememberedUsername();
      applyLogin({ ...user, displayName: user.nombre });
      setPasskeyUserId(null);
      setPasskeyEnrollmentRequired(false);
    } catch (err: any) {
      setError(friendlyPasskeyError(err));
    }
  };

  const handleRegisterPasskey = async () => {
    setError('');
    if (!passkeySupported) { setError(passkeyUnavailableMessage()); return; }
    try {
      const optionsRes = await fetch('/api/webauthn/register/options', { method: 'POST' });
      const options = await optionsRes.json();
      if (!optionsRes.ok) { setError(options.error || 'No se pudo iniciar el registro biométrico.'); return; }
      const credential = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: credential }),
      });
      const result = await verifyRes.json();
      if (!verifyRes.ok || !result.verified) { setError(result.error || 'No se pudo verificar la passkey.'); return; }
      const verifiedSession = {
        ...currentUser,
        ...result,
        displayName: result.nombre || currentUser?.displayName,
        webAuthnVerified: true,
        webAuthnEnrollmentRequired: false,
      };
      const session = saveSession(verifiedSession);
      setCurrentUser(session);
      setRole(session.role as Role);
      setPasskeyEnrollmentRequired(false);
    } catch (err: any) {
      setError(friendlyPasskeyError(err));
    }
  };

  const handleContinueWithoutPasskey = async () => {
    setError('');
    setContinuingWithoutPasskey(true);
    try {
      const res = await fetch('/api/auth/passkey/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const next = await res.json();
      if (!res.ok) { setError(next.error || 'No se pudo continuar sin passkey.'); return; }
      applyLogin({ ...next, displayName: next.nombre });
      setPasskeyUserId(null);
      setPasskeyEnrollmentRequired(false);
    } catch {
      setError('No se pudo conectar al servidor.');
    } finally {
      setContinuingWithoutPasskey(false);
    }
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {});
    clearSession(); clearApiSession();
    setCurrentUser(null);
    setRole(null);
    setAvatarUrl(null);
    setPendingRole(null);
    const rem = loadRememberedUsername();
    if (rem) { setUsername(rem.username); setPassword(''); setRememberMe(true); }
    else { setUsername(''); setPassword(''); setRememberMe(false); }
  };

  const startOAuthLogin = async (provider: 'google') => {
    const providerLabel = 'Google';
    setError('');
    try {
      const statusRes = await fetch('/api/auth/oauth/status');
      const status = await statusRes.json();
      if (!statusRes.ok || !status?.[provider]) {
        setError('');
        return;
      }
    } catch {
      setError('No se pudo validar OAuth con el servidor. Reinicia la app y revisa que /api/auth/oauth/status responda JSON.');
      return;
    }
    const params = new URLSearchParams({
      mode: 'login',
      role: pendingRole || 'ASESOR',
    });
    window.location.href = `/api/auth/oauth/${provider}/start?${params.toString()}`;
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

  const cancelLogin = () => { setPendingRole(null); setIsRegistering(false); setUsername(''); setPassword(''); setError(''); };

  return (
    <div className="hd-screen flex flex-col h-[100dvh] overflow-hidden bg-cyber-black text-[var(--theme-text-main)] font-sans relative transition-colors duration-500">
      <LoadingOverlay visible={isLoading} text="Conectando..." />

      {!role && (
        <button onClick={() => setIsLightMode(!isLightMode)}
          className="absolute top-6 right-6 z-50 p-3 rounded-full hover:bg-cyber-electric/10 border border-cyber-electric/30 text-cyber-electric transition-all glass-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50">
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
            <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-center mb-6 relative">
                <div className="absolute inset-0 bg-cyber-electric/15 blur-3xl rounded-full" />
                <Logo className="w-24 h-24 md:w-32 md:h-32 relative z-10 drop-shadow-[0_0_12px_rgba(0,229,255,0.35)]" />
              </div>
              <h1 className="mb-4 drop-shadow-md px-4">
                <MatrixText text="Heavenly Dreams" className="text-2xl sm:text-3xl md:text-5xl font-semibold font-sans tracking-[0.08em] sm:tracking-[0.1em] flex-nowrap" />
              </h1>
              <p className="text-cyber-electric/75 max-w-md mx-auto font-medium tracking-[0.1em] text-xs sm:text-sm px-4">
                TU DREAM TEAM COMIENZA AQUI
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700 px-4 sm:px-0">
              <RoleButton title="Gerencia / Admin" desc="Acceso Total Enterprise" icon={Crown} color="yellow" onClick={() => setPendingRole('GERENTE')} />
              <RoleButton title="Supervisor" desc="Control & Monitoreo IA" icon={Shield} color="purple" onClick={() => setPendingRole('SUPERVISOR')} />
              <RoleButton title="Asesor Comercial" desc="Operativa & Ventas IA" icon={ScanFace} color="pink" onClick={() => setPendingRole('ASESOR')} />
            </div>
            <div className="mt-8 sm:mt-12 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
              <button onClick={() => setIsRegistering(true)}
                className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl border border-cyber-electric/30 text-cyber-electric hover:bg-cyber-matrix/15 hover:border-cyber-matrix hover:text-white transition-all font-semibold text-xs sm:text-sm flex items-center gap-3 backdrop-blur-md group">
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
          <div className="w-full max-w-md glass-panel-neon rounded-3xl p-6 sm:p-8 animate-in zoom-in-95 duration-300 relative overflow-hidden my-auto shrink-0">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-electric/12 blur-3xl rounded-full" />
            <div className="absolute -left-2 top-10 w-1 h-12 bg-cyber-neon/80 rounded-r-md" />
            <div className="flex justify-center mb-4 sm:mb-6 relative z-10">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center border bg-cyber-electric/10 border-cyber-neon/40 text-cyber-neon">
                {pendingRole === 'GERENTE' ? <Shield className="w-6 h-6 sm:w-8 sm:h-8" /> : <Smartphone className="w-6 h-6 sm:w-8 sm:h-8" />}
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-center text-white mb-1 sm:mb-2 tracking-tight">Bienvenido al sistema</h2>
            <p className="text-cyber-electric/85 text-xs text-center mb-6 sm:mb-8 tracking-[0.06em]">
              Protocolo: <strong className="text-white">{pendingRole === 'GERENTE' ? 'Gerencia / Admin' : pendingRole === 'SUPERVISOR' ? 'Supervisor' : 'Asesor'}</strong>
            </p>
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 relative z-10">
              <div className="space-y-1">
                <label className="hd-label pl-1">Usuario</label>
                <MatrixInput type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario o email" />
              </div>
              <div className="space-y-1">
                <label className="hd-label pl-1">Contraseña</label>
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
                  <span className="text-xs text-cyber-electric/80 group-hover:text-cyber-neon font-semibold transition-colors">Recordar usuario</span>
                </label>
                <button type="button" onClick={() => setError('Contacta al administrador para restablecer tu contraseña.')}
                  className="text-xs text-cyber-electric/70 hover:text-cyber-neon font-semibold transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <button type="submit" disabled={loggingIn}
                className="w-full mt-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 bg-cyber-electric hover:bg-cyber-neon text-cyber-black text-sm">
                {loggingIn
                  ? <div className="w-5 h-5 border-2 border-cyber-black/30 border-t-cyber-black rounded-full animate-spin" />
                  : <><Lock className="w-4 h-4" /> Entrar</>}
              </button>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-cyber-electric/20" />
                <span className="text-[11px] tracking-[0.08em] text-cyber-electric/60 font-semibold">o entra con</span>
                <div className="flex-1 h-px bg-cyber-electric/20" />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  disabled={!googleOAuthAvailable}
                  onClick={() => startOAuthLogin('google')}
                  className="py-3 rounded-xl border border-cyber-electric/30 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/5"
                  title={googleOAuthAvailable ? 'Entrar con cuenta Google' : 'Faltan credenciales OAuth de Google en el servidor'}
                >
                  <span className="w-5 h-5 rounded-full bg-white text-slate-900 flex items-center justify-center font-black">G</span>
                  Cuenta Google
                </button>
                {!googleOAuthAvailable && (
                  <p className="text-center text-[10px] text-cyber-electric/50 font-bold uppercase tracking-widest">
                    Google pendiente de configurar
                  </p>
                )}
              </div>
              {biometricAvailable && (
                <>
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-cyber-electric/20" />
                    <span className="text-[9px] uppercase tracking-widest text-cyber-electric/60 font-bold">o</span>
                    <div className="flex-1 h-px bg-cyber-electric/20" />
                  </div>
                  <button type="button" onClick={() => handleBiometricLogin()}
                    className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] bg-cyber-dark/50 hover:bg-cyber-neon/10 text-cyber-neon border border-cyber-neon/40 text-sm">
                    <Fingerprint className="w-4 h-4" /> Entrar con huella digital
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Required passkey enrollment for managers */}
      {['GERENTE', 'ADMINISTRACION'].includes(role || '') && passkeyEnrollmentRequired && (
        <div className="absolute inset-0 z-[80] bg-cyber-black/95 backdrop-blur-xl flex items-center justify-center px-6">
          <div className="w-full max-w-md glass-panel-neon rounded-3xl p-8 text-center border border-yellow-400/30">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 bg-yellow-400/10 border border-yellow-400/40 flex items-center justify-center text-yellow-300">
              <Fingerprint className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest mb-3">Passkey requerida</h2>
            <p className="text-sm text-slate-300 mb-6">
              Las cuentas de gerencia o administración deben registrar biometría/passkey verificada por el servidor antes de entrar al CRM.
            </p>
            {!passkeySupported && (
              <p className="text-xs text-yellow-200 border border-yellow-400/30 bg-yellow-400/10 rounded-lg p-3 mb-4">
                Este navegador no soporta passkeys. Abre esta misma URL en Chrome o Edge. En servidor real usa HTTPS y dominio configurado.
              </p>
            )}
            {error && <p className="text-xs text-red-300 border border-red-500/30 bg-red-500/10 rounded-lg p-3 mb-4">{error}</p>}
            <button
              onClick={handleContinueWithoutPasskey}
              disabled={continuingWithoutPasskey}
              className="w-full mb-3 py-4 rounded-xl bg-cyber-electric text-cyber-black font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
            >
              {continuingWithoutPasskey
                ? <div className="w-5 h-5 border-2 border-cyber-black/30 border-t-cyber-black rounded-full animate-spin" />
                : <><Lock className="w-4 h-4" /> Continuar al CRM</>}
            </button>
            {passkeySupported && currentUser?.uid && (
              <button
                onClick={() => handleBiometricLogin(currentUser.uid)}
                className="w-full mb-3 py-3 rounded-xl border border-yellow-400/50 text-yellow-200 font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Fingerprint className="w-4 h-4" /> Usar passkey existente
              </button>
            )}
            <button
              onClick={handleRegisterPasskey}
              disabled={!passkeySupported}
              className="w-full py-4 rounded-xl bg-yellow-400 text-black font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Fingerprint className="w-4 h-4" /> {passkeySupported ? 'Registrar passkey' : 'Passkey no disponible'}
            </button>
            <button
              onClick={handleLogout}
              className="mt-3 w-full py-3 rounded-xl border border-slate-700 text-slate-300 font-bold uppercase tracking-widest text-xs"
            >
              Cerrar sesión
            </button>
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
      {role && !passkeyEnrollmentRequired && (
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
      className="group glass-panel rounded-2xl p-5 sm:p-7 flex flex-col items-center text-center transition-all duration-300 hover:bg-cyber-electric/10 hover:-translate-y-1 border-cyber-electric/20 hover:border-cyber-neon/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyber-electric/0 to-cyber-electric/5 group-hover:to-cyber-neon/10 transition-colors" />
      <div className="mb-4 sm:mb-6">
        <div className="sm:hidden"><CyberIcon icon={Icon} color={color} size="lg" glowOpacity={0.6} /></div>
        <div className="hidden sm:block"><CyberIcon icon={Icon} color={color} size="xl" glowOpacity={0.6} /></div>
      </div>
      <h2 className="text-lg sm:text-2xl font-semibold text-[var(--theme-text-main)] mb-1 sm:mb-2 tracking-tight group-hover:text-cyber-neon transition-colors">{title}</h2>
      <p className="text-xs sm:text-sm font-medium text-cyber-electric/70 tracking-[0.06em] leading-tight">{desc}</p>
    </button>
  );
});
