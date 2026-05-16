import React, { useState, useEffect, lazy, Suspense } from 'react';
import ShaderBackground from './components/ui/shader-background';
const ManagerView = lazy(() => import('./components/views/ManagerView'));
const MobileUserView = lazy(() => import('./components/views/MobileUserView'));
import { RegisterForm } from './components/views/RegisterForm';
import { CyberIcon, CyberColor } from './components/ui/CyberIcon';
import Logo from './components/ui/Logo';
import { MatrixInput } from './components/ui/MatrixInput';
import { MatrixText } from './components/ui/matrix-text';
import { LoadingOverlay } from './components/ui/LoadingOverlay';
import { cn } from './lib/utils';
import { Camera, X, Shield, Smartphone, Lock, Eye, EyeOff, ArrowLeft, Crown, ScanFace, Sun, Moon, UserPlus, Fingerprint } from 'lucide-react';

import { requestNotificationPermission, sendPushNotification } from './lib/notifications';

import { auth, verifyPassword } from './lib/firebase';

export type Role = 'GERENTE' | 'SUPERVISOR' | 'ASESOR';

export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [showProfileWidget, setShowProfileWidget] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const session = auth.currentUser;
    if (session) {
      setCurrentUser(session);
      const users: any[] = JSON.parse(localStorage.getItem('adhdreams_users') || '[]');
      const found = users.find((u: any) => u.uid === session.uid);
      if (found) {
        setRole(found.role as Role);
      } else if (session.email === 'edgarlovera20@gmail.com') {
        setRole('GERENTE');
      }
      const savedAvatar = localStorage.getItem(`adhdreams_avatar_${session.uid}`);
      if (savedAvatar) setAvatarUrl(savedAvatar);
    } else {
      // No session — prefill remembered credentials
      try {
        const remembered = JSON.parse(localStorage.getItem('adhdreams_remember') || 'null');
        if (remembered?.username) {
          setUsername(remembered.username);
          if (remembered.password) setPassword(remembered.password);
          setRememberMe(true);
        }
      } catch { /* ignore */ }
    }
    // Detect biometric platform authenticator
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(setBiometricAvailable)
        .catch(() => setBiometricAvailable(false));
    }
    setIsLoading(false);
  }, []);


  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768); // Use md breakpoint for mobile mode
    handleResize(); // Check initially
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [isLightMode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setError('');
    setResetMessage('');

    const email = username.includes('@') ? username : `${username}@adhdreams.local`;

    // Built-in admin
    if (email === 'edgarlovera20@gmail.com' && password === 'admin123') {
      const user = { uid: 'admin-001', email, displayName: 'Edgar Lovera', role: 'GERENTE' };
      auth.currentUser = user;
      localStorage.setItem('adhdreams_session', JSON.stringify(user));
      setCurrentUser(user);
      setRole('GERENTE');
      const savedAvatar = localStorage.getItem(`adhdreams_avatar_${user.uid}`);
      if (savedAvatar) setAvatarUrl(savedAvatar);
      setUsername('');
      setPassword('');
      setPendingRole(null);
      return;
    }

    const users: any[] = JSON.parse(localStorage.getItem('adhdreams_users') || '[]');
    const candidate = users.find((u: any) => u.email === email);
    if (candidate && await verifyPassword(password, candidate.password)) {
      const user = {
        uid: candidate.uid,
        email: candidate.email,
        displayName: candidate.displayName || candidate.nombre,
        role: candidate.role,
      };
      auth.currentUser = user;
      localStorage.setItem('adhdreams_session', JSON.stringify(user));
      if (rememberMe) {
        localStorage.setItem('adhdreams_remember', JSON.stringify({ username, email, password }));
      } else {
        localStorage.removeItem('adhdreams_remember');
      }
      setCurrentUser(user);
      setRole(candidate.role as Role);
      const savedAvatar = localStorage.getItem(`adhdreams_avatar_${user.uid}`);
      if (savedAvatar) setAvatarUrl(savedAvatar);
      if (!rememberMe) { setUsername(''); setPassword(''); }
      setPendingRole(null);
    } else {
      setError('Usuario o contraseña incorrectos.');
    }
  };

  const handleBiometricLogin = async () => {
    setError('');
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setError('Tu navegador no soporta autenticación biométrica.');
      return;
    }
    try {
      const users: any[] = JSON.parse(localStorage.getItem('adhdreams_users') || '[]');
      const withBio = users.filter((u: any) => u.biometricCredId);
      if (withBio.length === 0) {
        setError('No hay cuentas con biométrico registrado en este dispositivo.');
        return;
      }
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const allowCredentials = withBio.map((u: any) => ({
        type: 'public-key' as const,
        id: Uint8Array.from(atob(u.biometricCredId.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
      }));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          allowCredentials,
        },
      }) as PublicKeyCredential | null;
      if (!assertion) {
        setError('Autenticación biométrica cancelada.');
        return;
      }
      const rawId = new Uint8Array(assertion.rawId);
      let str = '';
      for (let i = 0; i < rawId.length; i++) str += String.fromCharCode(rawId[i]);
      const idB64 = btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const matched = withBio.find((u: any) => u.biometricCredId === idB64);
      if (!matched) {
        setError('Credencial biométrica no reconocida.');
        return;
      }
      const user = {
        uid: matched.uid,
        email: matched.email,
        displayName: matched.displayName || matched.nombre,
        role: matched.role,
      };
      auth.currentUser = user;
      localStorage.setItem('adhdreams_session', JSON.stringify(user));
      setCurrentUser(user);
      setRole(matched.role as Role);
      const savedAvatar = localStorage.getItem(`adhdreams_avatar_${user.uid}`);
      if (savedAvatar) setAvatarUrl(savedAvatar);
      setPendingRole(null);
    } catch (err: any) {
      setError(err.message || 'Falló la autenticación biométrica.');
    }
  };

  const handleForgotPassword = () => {
    setResetMessage('Contacta al administrador para restablecer tu contraseña.');
    setError('');
  };

  const cancelLogin = () => {
    setPendingRole(null);
    setIsRegistering(false);
    setUsername('');
    setPassword('');
    setError('');
    setResetMessage('');
  };

  const handleLogout = () => {
    localStorage.removeItem('adhdreams_session');
    auth.currentUser = null;
    setCurrentUser(null);
    setRole(null);
    setAvatarUrl(null);
    // Re-read remembered creds for next login prefill
    try {
      const remembered = JSON.parse(localStorage.getItem('adhdreams_remember') || 'null');
      if (remembered?.username) {
        setUsername(remembered.username);
        if (remembered.password) setPassword(remembered.password);
        setRememberMe(true);
      } else {
        setUsername(''); setPassword(''); setRememberMe(false);
      }
    } catch { /* ignore */ }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);
      if (currentUser?.uid) {
        try {
          localStorage.setItem(`adhdreams_avatar_${currentUser.uid}`, dataUrl);
        } catch {
          // localStorage quota — ignore silently
        }
      }
      setAvatarUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const mockUser = {
     email: currentUser?.email || username || 'admin@adhdreams.local',
     displayName: currentUser?.displayName || 'Demo User'
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-cyber-black text-[var(--theme-text-main)] font-sans relative transition-colors duration-500">
      <LoadingOverlay visible={isLoading} text="Conectando..." />
      {/* Theme Toggle — shown only when no user is logged in (in-app toggle lives in sidebar) */}
      {!role && (
        <button
          onClick={() => setIsLightMode(!isLightMode)}
          aria-label={isLightMode ? 'Activar modo oscuro' : 'Activar modo claro'}
          className="absolute top-6 right-6 z-50 p-3 rounded-full hover:bg-cyber-electric/10 border border-cyber-electric/30 text-cyber-electric hover:text-[var(--theme-text-main)] transition-all glass-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
          title="Cambiar Tema"
        >
          {isLightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      )}

      {/* Global Profile Widget */}
      {role && (
        <div className="absolute top-6 right-6 z-50">
          <button
            onClick={() => setShowProfileWidget(!showProfileWidget)}
            className="w-11 h-11 rounded-full border border-cyber-electric/50 overflow-hidden shadow-[0_0_15px_rgba(3,154,220,0.3)] hover:shadow-cyan-400/50 transition-all focus:outline-none"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-cyber-dark flex items-center justify-center text-cyber-neon font-bold text-sm">
                {mockUser.email[0].toUpperCase()}
              </div>
            )}
          </button>
          
          {showProfileWidget && (
            <div className="absolute right-0 mt-3 w-64 glass-panel rounded-2xl p-4 shadow-2xl border border-cyber-electric/30 animate-in fade-in slide-in-from-top-4">
              <button 
                onClick={() => setShowProfileWidget(false)}
                className="absolute top-2 right-2 p-1 text-cyber-electric/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex flex-col items-center mt-2 group relative">
                <div className="w-20 h-20 rounded-full border-2 border-cyber-electric overflow-hidden mb-3 relative">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-cyber-dark flex items-center justify-center text-cyber-neon font-bold text-2xl">
                      {mockUser.email[0].toUpperCase()}
                    </div>
                  )}
                  
                  <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    {avatarUploading ? (
                      <div className="w-5 h-5 border-2 border-cyber-electric/30 border-t-cyber-electric rounded-full animate-spin"></div>
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                    <input type="file" accept="image/*" className="hidden" disabled={avatarUploading} onChange={handleAvatarUpload} />
                  </label>
                </div>
                
                <h4 className="text-white font-bold text-sm truncate w-full text-center">{mockUser.displayName}</h4>
                <p className="text-cyber-electric/70 text-xs font-mono mb-4">{role}</p>
                
                <button
                  onClick={() => { setShowProfileWidget(false); handleLogout(); }}
                  className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm font-bold border border-red-500/30 transition-colors"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Atmosphere / Background Effect - using updated shader */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-60">
        <ShaderBackground isLightMode={isLightMode} />
      </div>

      {/* Role Selector (Landing) */}
      {role === null && pendingRole === null && !isRegistering && (
        <div className="relative z-10 flex flex-col items-center h-full px-6 overflow-y-auto py-12">
          <div className="w-full flex flex-col items-center my-auto shrink-0">
            <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-center mb-6 relative">
              <div className="absolute inset-0 bg-cyber-electric/20 blur-3xl rounded-full"></div>
              <Logo className="w-24 h-24 md:w-36 md:h-36 relative z-10 drop-shadow-[0_0_15px_rgba(0,229,255,0.5)]" />
            </div>
            <h1 className="mb-4 drop-shadow-md px-4">
              <MatrixText 
                text="Heavenly Dreams"
                className="text-2xl sm:text-3xl md:text-5xl font-bold font-sans uppercase tracking-[0.1em] sm:tracking-[0.15em] flex-nowrap" 
              />
            </h1>
            <p className="text-cyber-electric/80 max-w-md mx-auto font-medium uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[10px] sm:text-sm px-4">
              Heavenly Dreams
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700 px-4 sm:px-0">
            <RoleButton 
              title="Gerencia / Admin" 
              desc="Acceso Total Enterprise" 
              icon={Crown} 
              color="yellow"
              onClick={() => setPendingRole('GERENTE')} 
            />
            <RoleButton 
              title="Supervisor" 
              desc="Control & Monitoreo IA" 
              icon={Shield} 
              color="purple"
              onClick={() => setPendingRole('SUPERVISOR')} 
            />
            <RoleButton 
              title="Asesor Comercial" 
              desc="Operativa & Ventas IA" 
              icon={ScanFace} 
              color="pink"
              onClick={() => setPendingRole('ASESOR')} 
            />
          </div>

          <div className="mt-8 sm:mt-12 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
            <button 
              onClick={() => setIsRegistering(true)} 
              className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl border border-cyber-electric/30 text-cyber-electric hover:bg-cyber-matrix/20 hover:border-cyber-matrix hover:text-white hover:shadow-[0_0_15px_rgba(0,255,136,0.5)] transition-all font-bold uppercase tracking-widest text-[10px] sm:text-sm flex items-center gap-3 backdrop-blur-md group"
            >
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" /> Iniciar Registro
            </button>
          </div>
          
          {error && (
             <div className="mt-4 sm:mt-6 p-2 sm:p-3 rounded-xl bg-red-900/30 border border-red-500/50 text-red-400 text-[10px] sm:text-sm flex items-center gap-2 animate-in slide-in-from-top-2 mx-4">
                 <span className="font-medium tracking-wide text-[10px] sm:text-xs">{error}</span>
             </div>
          )}
          </div>
        </div>
      )}

      {/* Login Screen */}
      {role === null && pendingRole !== null && !isRegistering && (
        <div className="relative z-10 flex flex-col items-center h-[100dvh] px-4 sm:px-6 overflow-y-auto py-8 sm:py-12">
          <button 
            onClick={cancelLogin}
            className="absolute top-6 left-6 sm:top-8 sm:left-8 p-2 sm:p-3 rounded-full hover:bg-cyber-electric/10 border border-cyber-electric/30 text-cyber-electric hover:text-white transition-all backdrop-blur-md group z-50"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          
          <div className="w-full max-w-md glass-panel-neon rounded-3xl p-6 sm:p-8 animate-in zoom-in-95 duration-300 relative overflow-hidden my-auto shrink-0 shadow-2xl">
            {/* Cyber accents */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-electric/20 blur-3xl rounded-full"></div>
            <div className="absolute -left-2 top-10 w-1 h-12 bg-cyber-neon rounded-r-md"></div>
            <div className="absolute -right-2 bottom-10 w-1 h-12 bg-cyber-electric rounded-l-md"></div>

            <div className="flex justify-center mb-4 sm:mb-6 relative z-10">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center border bg-cyber-electric/10 border-cyber-neon/50 text-cyber-neon shadow-[0_0_20px_rgba(0,229,255,0.3)]">
                {pendingRole === 'GERENTE' ? <Shield className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-md" /> : <Smartphone className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-md" />}
              </div>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold text-center text-white mb-1 sm:mb-2 uppercase tracking-wide">
              Bienvenido al Sistema
            </h2>
            <p className="text-cyber-electric text-[10px] sm:text-xs text-center mb-6 sm:mb-8 uppercase tracking-[0.1em]">
              Protocolo: <strong className="text-white">{pendingRole === 'GERENTE' ? 'Gerencia / Admin' : pendingRole === 'SUPERVISOR' ? 'Supervisor' : 'Asesor'}</strong>
            </p>
            
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 relative z-10">
              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Usuario</label>
                <MatrixInput
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={pendingRole === 'GERENTE' ? 'admin' : 'vendedor'}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Contraseña</label>
                <div className="relative group">
                  <MatrixInput
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-cyber-electric/50 hover:text-cyber-neon transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-2 sm:p-3 rounded-xl bg-red-900/30 border border-red-500/50 text-red-400 text-xs flex items-center gap-2 animate-in slide-in-from-top-2 mt-2 sm:mt-4">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium tracking-wide text-[10px] sm:text-xs">{error}</span>
                </div>
              )}

              {resetMessage && (
                <div className="p-3 rounded-xl bg-green-900/30 border border-green-500/50 text-green-400 text-sm flex items-center gap-2 animate-in slide-in-from-top-2 mt-4">
                  <span className="font-medium tracking-wide text-xs">{resetMessage}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between w-full gap-3">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 accent-cyber-neon cursor-pointer"
                  />
                  <span className="text-[10px] text-cyber-electric/80 group-hover:text-cyber-neon uppercase tracking-widest font-bold transition-colors">
                    Recordarme
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] text-cyber-electric/70 hover:text-cyber-neon uppercase tracking-widest font-bold transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 bg-cyber-electric hover:bg-cyber-neon text-cyber-black shadow-[0_0_20px_rgba(3,154,220,0.5)] uppercase tracking-wider text-sm"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-cyber-black/30 border-t-cyber-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Auth
                  </>
                )}
              </button>

              {biometricAvailable && (
                <>
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-cyber-electric/20" />
                    <span className="text-[9px] uppercase tracking-widest text-cyber-electric/60 font-bold">o</span>
                    <div className="flex-1 h-px bg-cyber-electric/20" />
                  </div>
                  <button
                    type="button"
                    onClick={handleBiometricLogin}
                    className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] bg-cyber-dark/50 hover:bg-cyber-neon/10 text-cyber-neon border border-cyber-neon/40 hover:border-cyber-neon uppercase tracking-wider text-sm"
                  >
                    <Fingerprint className="w-4 h-4" /> Entrar con huella digital
                  </button>
                </>
              )}

            </form>
          </div>
        </div>
      )}

      {/* Register Screen */}
      {role === null && isRegistering && (
        <div className="relative z-10 flex flex-col items-center h-full px-6 overflow-y-auto py-12">
          <RegisterForm onBack={() => setIsRegistering(false)} pendingRole={pendingRole} />
        </div>
      )}

      {/* Render Selected View */}
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
    <button 
      onClick={onClick}
      className="group glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-8 flex flex-col items-center text-center transition-all duration-300 hover:bg-cyber-electric/10 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(3,154,220,0.2)] border-cyber-electric/20 hover:border-cyber-neon/50 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyber-electric/0 to-cyber-electric/5 group-hover:to-cyber-neon/10 transition-colors"></div>
      
      <div className="mb-4 sm:mb-8">
        <div className="sm:hidden">
          <CyberIcon icon={Icon} color={color} size="lg" glowOpacity={0.6} />
        </div>
        <div className="hidden sm:block">
          <CyberIcon icon={Icon} color={color} size="xl" glowOpacity={0.6} />
        </div>
      </div>
      
      <h2 className="text-lg sm:text-2xl font-bold text-[var(--theme-text-main)] mb-1 sm:mb-2 uppercase tracking-wide group-hover:text-cyber-neon transition-colors">{title}</h2>
      <p className="text-[10px] sm:text-sm font-medium text-cyber-electric/70 uppercase tracking-widest leading-tight">{desc}</p>
    </button>
  );
});
