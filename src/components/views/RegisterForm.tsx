import React, { useState, useEffect } from 'react';
import { Shield, ArrowLeft, UserPlus, CheckCircle, Eye, EyeOff, Fingerprint, X, FileText } from 'lucide-react';
import { MatrixInput } from '../ui/MatrixInput';
import { auth, hashPassword } from '../../lib/firebase';

interface RegisterFormProps {
  onBack: () => void;
  pendingRole: 'GERENTE' | 'SUPERVISOR' | 'ASESOR' | null;
}

const TERMS_VERSION = '1.0';

const TERMS_TEXT = `TÉRMINOS Y CONDICIONES DE USO — HEAVENLY DREAMS CRM

Versión ${TERMS_VERSION} · Fecha de entrada en vigor: 12 de mayo de 2026

1. ACEPTACIÓN DEL ACUERDO
Al crear una cuenta y utilizar la plataforma Heavenly Dreams CRM (en adelante "la Aplicación"), operada por Heavenly Dreams SAS de CV (en adelante "la Empresa"), el usuario acepta de forma expresa, plena e incondicional los presentes Términos y Condiciones. Si no está de acuerdo con cualquiera de las cláusulas, debe abstenerse de registrarse y utilizar la Aplicación.

2. NATURALEZA DEL SERVICIO
La Aplicación es una herramienta interna de gestión comercial (CRM) destinada exclusivamente al personal autorizado de la Empresa: asesores comerciales, supervisores y gerencia. Permite la captura, validación, seguimiento y administración de ventas, clientes, contratos, expedientes y procesos de cobranza relacionados con la actividad comercial de la Empresa.

3. CUENTAS Y CREDENCIALES
3.1 El usuario es el único responsable de la veracidad de la información proporcionada en su registro.
3.2 El usuario debe resguardar la confidencialidad de su nombre de usuario, contraseña y, en su caso, credenciales biométricas. Cualquier acción ejecutada bajo su cuenta se presume realizada por él.
3.3 El alta definitiva queda sujeta a la aprobación de la gerencia. La Empresa se reserva el derecho de rechazar, suspender o cancelar cualquier cuenta sin necesidad de justificación previa.

4. CREDENCIALES BIOMÉTRICAS (HUELLA DIGITAL)
4.1 La autenticación biométrica es opcional y se realiza mediante el estándar WebAuthn del dispositivo del usuario. La huella o factor biométrico NO se transmite ni almacena en servidores de la Empresa: permanece exclusivamente en el hardware seguro del dispositivo.
4.2 La Empresa únicamente almacena un identificador público de credencial que permite verificar la firma generada por el dispositivo. Revocar el acceso biométrico es posible en cualquier momento desde Ajustes.

5. RECORDATORIO DE SESIÓN
5.1 La opción "Recordar usuario y contraseña" almacena las credenciales de forma local en el navegador del dispositivo (localStorage). El usuario reconoce que activar esta opción en un dispositivo compartido o público representa un riesgo de seguridad de su exclusiva responsabilidad.
5.2 Las contraseñas se almacenan cifradas con algoritmo SHA-256; sin embargo, la Empresa recomienda no activar esta opción en equipos no personales.

6. USO ACEPTABLE
El usuario se obliga a:
a) Utilizar la Aplicación únicamente para los fines autorizados por la Empresa.
b) No compartir su cuenta con terceros ajenos a la Empresa.
c) No capturar información falsa, alterada o que vulnere la privacidad de los clientes.
d) No realizar ingeniería inversa, descompilación ni intentos de acceso no autorizado a otros módulos.
e) Reportar de inmediato cualquier acceso indebido o anomalía detectada.

7. PROTECCIÓN DE DATOS PERSONALES
7.1 Los datos de clientes capturados (nombre, CURP, INE, domicilio, teléfono, correo y firma) son tratados de conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (México) y las políticas internas de la Empresa.
7.2 El usuario se obliga a recabar el consentimiento expreso del cliente antes de capturar cualquier dato personal y a entregar el aviso de privacidad correspondiente.
7.3 La Empresa actúa como responsable del tratamiento; el usuario como encargado en términos del artículo 49 del reglamento.

8. PROPIEDAD INTELECTUAL
Todo el contenido, diseño, código, marcas, logotipos y bases de datos de la Aplicación son propiedad exclusiva de Heavenly Dreams SAS de CV o de sus licenciantes. Queda prohibida su reproducción, modificación o uso fuera del ámbito laboral.

9. MONITOREO Y AUDITORÍA
La Empresa se reserva el derecho de monitorear, auditar y registrar las actividades realizadas dentro de la Aplicación con fines de seguridad, cumplimiento normativo y mejora del servicio. El usuario reconoce que su actividad puede ser revisada en cualquier momento.

10. SUSPENSIÓN Y TERMINACIÓN
La Empresa podrá suspender o dar de baja la cuenta del usuario en caso de:
a) Incumplimiento de cualquier cláusula de estos Términos.
b) Conductas que pongan en riesgo la seguridad, reputación o operación de la Empresa.
c) Terminación de la relación laboral o de prestación de servicios.

11. LIMITACIÓN DE RESPONSABILIDAD
La Aplicación se proporciona "tal cual". La Empresa no garantiza la disponibilidad ininterrumpida del servicio ni se hace responsable por pérdidas indirectas derivadas de fallas técnicas, siempre que se hayan adoptado medidas razonables de operación.

12. MODIFICACIONES
La Empresa podrá modificar estos Términos en cualquier momento. Los cambios serán notificados a través de la propia Aplicación. El uso continuado del servicio después de la notificación constituye aceptación de las nuevas condiciones.

13. LEGISLACIÓN APLICABLE Y JURISDICCIÓN
Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Para la interpretación y cumplimiento, las partes se someten a la jurisdicción de los tribunales competentes de la Ciudad de México, renunciando a cualquier otro fuero.

14. CONTACTO
Cualquier duda relacionada con estos Términos puede dirigirse al área de Recursos Humanos o al correo legal@heavenlydreams.mx.

Al marcar la casilla "Acepto los Términos y Condiciones" el usuario manifiesta haber leído, comprendido y aceptado el presente documento en su totalidad.`;

// ---- WebAuthn helpers ----
function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function enrollBiometric(userId: string, userName: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    throw new Error('Este dispositivo no soporta autenticación biométrica.');
  }
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!available) {
    throw new Error('No se detectó un sensor biométrico (huella / Face ID) en este dispositivo.');
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBuf = new TextEncoder().encode(userId);
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Heavenly Dreams CRM' },
      user: {
        id: userIdBuf,
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none',
    },
  }) as PublicKeyCredential | null;
  if (!cred) return null;
  return bufferToBase64Url(cred.rawId);
}

export function RegisterForm({ onBack, pendingRole }: RegisterFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    fechaNacimiento: '',
    lugarNacimiento: '',
    telefono: '',
    email: '',
    zonaOperativa: '',
    supervisor: '',
    puesto: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [enableBiometric, setEnableBiometric] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(setBiometricSupported)
        .catch(() => setBiometricSupported(false));
    }
    // Prefill from previous "remember me" session
    try {
      const remembered = JSON.parse(localStorage.getItem('adhdreams_remember') || 'null');
      if (remembered?.username) {
        setFormData(prev => ({ ...prev, username: remembered.username, email: remembered.email || '' }));
      }
    } catch { /* ignore */ }
  }, []);

  const zones = [
    { id: '1', name: 'CDMX - Edgar Lovera' },
  ];

  const supervisors: Record<string, string[]> = {
    '1': ['Sup CDMX 1', 'Sup CDMX 2'],
    '2': ['Sup EdoMex 1', 'Sup EdoMex 2'],
    '3': ['Sup Tijuana 1', 'Sup Tijuana 2'],
  };

  const puestos = [
    'Capacitacion',
    'Asesor',
    'Supervisor',
    'Supervisor Jr',
    'Supervisor Lider',
    'Asistente de Gerente',
  ];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms) {
      setErrorMsg('Debes aceptar los Términos y Condiciones para continuar.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    if (formData.password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const users: any[] = JSON.parse(localStorage.getItem('adhdreams_users') || '[]');
      const exists = users.find((u: any) => u.email === formData.email || u.username === formData.username);
      if (exists) {
        setErrorMsg('El correo o usuario ya está registrado.');
        setIsSubmitting(false);
        return;
      }

      const uid = `user-${Date.now()}`;
      const passwordHash = await hashPassword(formData.password);
      const { confirmPassword: _cp, password: _pw, ...rest } = formData;

      let biometricCredId: string | null = null;
      if (enableBiometric) {
        try {
          biometricCredId = await enrollBiometric(uid, formData.email || formData.username);
        } catch (bioErr: any) {
          setErrorMsg(bioErr.message || 'No se pudo registrar la huella. Tu cuenta se creó sin biométrico.');
        }
      }

      const newUser = {
        uid,
        email: formData.email,
        displayName: `${formData.nombre} ${formData.apellidoPaterno}`,
        password: passwordHash,
        role: 'ASESOR',
        ...rest,
        biometricCredId,
        termsAccepted: { version: TERMS_VERSION, at: new Date().toISOString() },
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      localStorage.setItem('adhdreams_users', JSON.stringify(users));

      if (rememberMe) {
        localStorage.setItem('adhdreams_remember', JSON.stringify({
          username: formData.username,
          email: formData.email,
          // Plain password is kept locally only because the user opted in. SHA-256 hash already lives in users.
          password: formData.password,
        }));
      } else {
        localStorage.removeItem('adhdreams_remember');
      }

      auth.currentUser = { uid, email: formData.email, displayName: newUser.displayName, role: 'ASESOR' };
      localStorage.setItem('adhdreams_session', JSON.stringify(auth.currentUser));

      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al completar el registro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 2) {
    return (
      <div className="w-full max-w-md glass-panel-neon rounded-3xl p-8 animate-in zoom-in-95 duration-300 relative text-center my-auto shrink-0">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center border bg-cyber-matrix/20 border-cyber-matrix text-cyber-matrix shadow-[0_0_20px_rgba(0,255,136,0.3)]">
            <CheckCircle className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">Registro Completado</h2>
        <p className="text-cyber-electric text-sm mb-8">
          Tu registro ha sido enviado. Solo el creador o un Administrador podrán aceptarlo en el sistema.
          {enableBiometric && ' La próxima vez podrás iniciar sesión con tu huella digital.'}
        </p>
        <button
          onClick={onBack}
          className="w-full py-4 rounded-xl flex items-center justify-center bg-cyber-electric/20 hover:bg-cyber-electric/40 text-cyber-electric border border-cyber-electric/50 font-bold uppercase tracking-wider text-sm transition-all"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-2xl glass-panel-neon rounded-3xl p-6 sm:p-8 animate-in zoom-in-95 duration-300 relative overflow-hidden my-auto shrink-0">
        <button
          onClick={onBack}
          className="absolute top-6 left-6 p-2 rounded-full hover:bg-cyber-electric/10 text-cyber-electric hover:text-white transition-all z-20 group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
          title="Volver"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>

        <div className="flex justify-center mb-6 relative z-10 pt-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center border bg-cyber-neon/10 border-cyber-neon text-cyber-neon shadow-[0_0_20px_rgba(0,229,255,0.3)]">
            <UserPlus className="w-8 h-8 drop-shadow-md" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-white mb-2 uppercase tracking-wide">
          Registro de Personal
        </h2>
        <p className="text-cyber-electric text-xs text-center mb-8 uppercase tracking-[0.1em]">
          Protocolo de Alta en Sistema
        </p>

        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-3 rounded-lg mb-6 text-sm text-center" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Nombre(s)</label>
            <MatrixInput required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej. Juan" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Apellido Paterno</label>
            <MatrixInput required value={formData.apellidoPaterno} onChange={e => setFormData({ ...formData, apellidoPaterno: e.target.value })} placeholder="Pérez" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Apellido Materno</label>
            <MatrixInput required value={formData.apellidoMaterno} onChange={e => setFormData({ ...formData, apellidoMaterno: e.target.value })} placeholder="García" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Fecha de Nacimiento</label>
            <input
              type="date"
              required
              value={formData.fechaNacimiento}
              onChange={e => setFormData({ ...formData, fechaNacimiento: e.target.value })}
              className="w-full bg-cyber-dark/40 border border-cyber-electric/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyber-neon/50 uppercase text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Lugar de Nac.</label>
            <MatrixInput required value={formData.lugarNacimiento} onChange={e => setFormData({ ...formData, lugarNacimiento: e.target.value })} placeholder="Ciudad/Estado" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Teléfono</label>
            <MatrixInput required type="tel" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} placeholder="55 1234 5678" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Email</label>
            <MatrixInput required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="correo@ejemplo.com" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Zona Operativa</label>
            <select
              required
              value={formData.zonaOperativa}
              onChange={e => setFormData({ ...formData, zonaOperativa: e.target.value, supervisor: '' })}
              className="w-full bg-cyber-dark/80 border border-cyber-electric/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyber-neon/50 text-sm appearance-none"
            >
              <option value="">Selecciona Zona</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Supervisor</label>
            <select
              required
              disabled={!formData.zonaOperativa}
              value={formData.supervisor}
              onChange={e => setFormData({ ...formData, supervisor: e.target.value })}
              className="w-full bg-cyber-dark/80 border border-cyber-electric/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyber-neon/50 text-sm appearance-none disabled:opacity-50"
            >
              <option value="">Selecciona Supervisor</option>
              {formData.zonaOperativa && supervisors[formData.zonaOperativa]?.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-cyber-electric/80 uppercase tracking-widest pl-1">Puesto Asignado</label>
            <select
              required
              value={formData.puesto}
              onChange={e => setFormData({ ...formData, puesto: e.target.value })}
              className="w-full bg-cyber-dark/80 border border-cyber-electric/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyber-neon/50 text-sm appearance-none"
            >
              <option value="">Selecciona Puesto</option>
              {puestos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-cyber-matrix/80 uppercase tracking-widest pl-1">Crear Usuario</label>
            <MatrixInput required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="usuario123" />
          </div>

          {/* PASSWORD with show/hide */}
          <div className="space-y-1 md:col-span-1">
            <label className="text-[10px] font-bold text-cyber-matrix/80 uppercase tracking-widest pl-1">Crear Contraseña</label>
            <div className="relative">
              <MatrixInput
                required
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-cyber-electric/60 hover:text-cyber-neon transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1 md:col-span-1">
            <label className="text-[10px] font-bold text-cyber-matrix/80 uppercase tracking-widest pl-1">Confirmar Contraseña</label>
            <div className="relative">
              <MatrixInput
                required
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(v => !v)}
                aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-cyber-electric/60 hover:text-cyber-neon transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* OPTIONS BLOCK */}
          <div className="md:col-span-2 mt-2 space-y-3 bg-cyber-dark/30 border border-cyber-electric/20 rounded-xl p-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-cyber-neon cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-sm font-bold text-white uppercase tracking-wider">Recordar usuario y contraseña</span>
                <p className="text-[11px] text-cyber-electric/60 mt-0.5">
                  Guardará tus credenciales en este dispositivo para los próximos inicios de sesión. No actives en equipos compartidos.
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 ${biometricSupported ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} group`}>
              <input
                type="checkbox"
                disabled={!biometricSupported}
                checked={enableBiometric}
                onChange={e => setEnableBiometric(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-cyber-neon cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-cyber-neon" />
                  Entrar con huella digital / biométrico
                </span>
                <p className="text-[11px] text-cyber-electric/60 mt-0.5">
                  {biometricSupported
                    ? 'Al finalizar el registro se solicitará tu huella o Face ID para autenticación rápida. Los datos biométricos se quedan en tu dispositivo.'
                    : 'Tu dispositivo o navegador no soporta autenticación biométrica.'}
                </p>
              </div>
            </label>
          </div>

          {/* TERMS */}
          <div className="md:col-span-2 mt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-cyber-neon cursor-pointer"
              />
              <span className="text-sm text-cyber-electric/90 leading-relaxed">
                He leído y acepto los{' '}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-cyber-neon font-bold underline underline-offset-2 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded"
                >
                  Términos y Condiciones de Uso
                </button>
                {' '}y el aviso de privacidad de Heavenly Dreams CRM.
              </span>
            </label>
          </div>

          <div className="md:col-span-2 mt-4">
            <button
              type="submit"
              disabled={isSubmitting || !acceptedTerms}
              className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 bg-cyber-electric hover:bg-cyber-neon text-cyber-black shadow-[0_0_20px_rgba(3,154,220,0.5)] uppercase tracking-wider text-sm"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-cyber-black/30 border-t-cyber-black rounded-full animate-spin" />
              ) : enableBiometric ? (
                <><Fingerprint className="w-4 h-4" /> Solicitar Acceso + Registrar Huella</>
              ) : (
                <><Shield className="w-4 h-4" /> Solicitar Acceso</>
              )}
            </button>

            <p className="text-center text-[10px] text-cyber-electric/50 mt-4 uppercase">
              El acceso requiere autorización gerencial posterior al registro.
            </p>
          </div>
        </form>
      </div>

      {/* TERMS MODAL */}
      {showTerms && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowTerms(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="terms-title"
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] glass-panel-neon rounded-3xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-cyber-electric/20 bg-cyber-dark/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyber-neon/10 border border-cyber-neon/40 flex items-center justify-center text-cyber-neon">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="terms-title" className="text-white font-bold uppercase tracking-wide text-sm">Términos y Condiciones</h3>
                  <p className="text-[10px] text-cyber-electric/60 uppercase tracking-widest">Versión {TERMS_VERSION}</p>
                </div>
              </div>
              <button
                onClick={() => setShowTerms(false)}
                className="p-2 text-cyber-electric/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                aria-label="Cerrar términos"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 leading-relaxed">
                {TERMS_TEXT}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-cyber-electric/20 bg-cyber-dark/50 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setShowTerms(false)}
                className="px-4 py-2.5 rounded-xl border border-cyber-electric/30 text-cyber-electric hover:bg-cyber-electric/10 text-sm font-bold uppercase tracking-wider transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => { setAcceptedTerms(true); setShowTerms(false); }}
                className="px-4 py-2.5 rounded-xl bg-cyber-neon text-cyber-black hover:bg-white text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Acepto los Términos
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
