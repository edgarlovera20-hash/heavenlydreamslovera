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

  const cancelLogin = () => { setPendingRole(null); setIsRegistering(false); setUsername(''); setPassword(''); setError(''); };

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
              {biometricAvailable && (
                <>
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-cyber-electric/20" />
                    <span className="text-[9px] uppercase tracking-widest text-cyber-electric/60 font-bold">o</span>
                    <div className="flex-1 h-px bg-cyber-electric/20" />
                  </div>
                  <button type="button" onClick={handleBiometricLogin}
                    className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] bg-cyber-dark/50 hover:bg-cyber-neon/10 text-cyber-neon border border-cyber-neon/40 uppercase tracking-wider text-sm">
                    <Fingerprint className="w-4 h-4" /> Entrar con huella digital
                  </button>
                </>
              )}
            </form>
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
