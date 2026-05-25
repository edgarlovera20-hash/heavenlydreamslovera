import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuditLog, OAuthAccounts, Users } from './db';
import { issueSessionCookie } from './security';
import { isWebAuthnRequired } from './webauthn';

type OAuthProvider = 'google';
type OAuthMode = 'login' | 'register';

interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl?: string | null;
}

const PROVIDERS: Record<OAuthProvider, {
  label: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  authUrl: (tenant?: string) => string;
  tokenUrl: (tenant?: string) => string;
  userInfoUrl: string;
  scopes: string[];
}> = {
  google: {
    label: 'Google',
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    authUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
};

function secret() {
  return process.env.JWT_SECRET || 'dev-heavenly-dreams-change-me';
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function encodeState(payload: any) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function decodeState(state: string) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig || sign(body) !== sig) throw new Error('Estado OAuth inválido');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Date.now()) throw new Error('Estado OAuth expirado');
  return payload;
}

function appBaseUrl(req: Request) {
  const configured = process.env.APP_URL || process.env.OAUTH_CALLBACK_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function callbackUrl(req: Request, provider: OAuthProvider) {
  return `${appBaseUrl(req)}/api/auth/oauth/${provider}/callback`;
}

function isConfiguredValue(value: any) {
  const text = String(value || '').trim();
  if (!text) return false;
  return !/^(TU_|MY_|change_me|localhost|https:\/\/crm\.tudominio\.com)/i.test(text);
}

function isValidGoogleClientId(value: any) {
  return isConfiguredValue(value) && String(value).trim().endsWith('.apps.googleusercontent.com');
}

function providerConfig(provider: string) {
  if (provider !== 'google') throw new Error('Proveedor OAuth no soportado');
  const config = PROVIDERS[provider];
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!isValidGoogleClientId(clientId) || !isConfiguredValue(clientSecret)) {
    throw new Error(`${config.label} OAuth no configurado. Define ${config.clientIdEnv} y ${config.clientSecretEnv}.`);
  }
  return { provider, config, clientId, clientSecret } as const;
}

function safeRole(value: any) {
  const role = String(value || 'ASESOR').toUpperCase();
  return ['ASESOR', 'SUPERVISOR', 'GERENTE', 'ADMINISTRACION'].includes(role) ? role : 'ASESOR';
}

function htmlEscape(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderOAuthResult(res: Response, payload: { session?: any; title: string; message: string; error?: boolean }) {
  const sessionJson = payload.session
    ? JSON.stringify(payload.session).replace(/</g, '\\u003c')
    : 'null';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${htmlEscape(payload.title)}</title>
  <style>
    body{margin:0;min-height:100vh;background:#071323;color:#e5f4ff;font-family:Inter,Arial,sans-serif;display:grid;place-items:center}
    .card{width:min(92vw,520px);border:1px solid ${payload.error ? '#ef4444' : '#22d3ee'}66;background:#0b1424;padding:32px;border-radius:20px;text-align:center;box-shadow:0 20px 80px #0008}
    h1{font-size:24px;margin:0 0 12px;text-transform:uppercase;letter-spacing:.12em}
    p{color:#a8bad2;line-height:1.55}
    a{display:inline-block;margin-top:20px;padding:12px 18px;border-radius:12px;background:#00d4ff;color:#00111f;text-decoration:none;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
  </style>
</head>
<body>
  <main class="card">
    <h1>${htmlEscape(payload.title)}</h1>
    <p>${htmlEscape(payload.message)}</p>
    <a href="/">Volver a Heavenly Dreams</a>
  </main>
  <script>
    const session = ${sessionJson};
    if (session) {
      const { accessToken, refreshToken, ...profile } = session;
      localStorage.setItem('hd_session', JSON.stringify(profile));
      localStorage.setItem('hd_remember_user', JSON.stringify({ username: session.username || session.email, email: session.email }));
      setTimeout(() => location.replace('/'), 700);
    }
  </script>
</body>
</html>`);
}

async function exchangeCode(provider: OAuthProvider, code: string, redirectUri: string) {
  const { config, clientId, clientSecret } = providerConfig(provider);
  const res = await fetch(config.tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error_description || data?.error || `${config.label} token error ${res.status}`);
  if (!data.access_token) throw new Error(`${config.label} no devolvió access_token`);
  return data.access_token as string;
}

async function fetchProfile(provider: OAuthProvider, accessToken: string): Promise<OAuthProfile> {
  const { config } = providerConfig(provider);
  const res = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error_description || data?.error?.message || `${config.label} userinfo error ${res.status}`);

  const providerUserId = String(data.sub || data.id || '').trim();
  const email = String(data.email || data.preferred_username || data.upn || '').trim().toLowerCase();
  if (!providerUserId || !email) throw new Error(`${config.label} no devolvió email verificable`);
  return {
    provider,
    providerUserId,
    email,
    emailVerified: data.email_verified === true,
    displayName: String(data.name || data.given_name || email.split('@')[0]).trim(),
    avatarUrl: data.picture || null,
  };
}

function uniqueUsername(email: string) {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]+/g, '').slice(0, 28) || 'usuario';
  let username = base;
  let i = 1;
  while (Users.getByUsername(username)) {
    username = `${base}${i}`;
    i++;
  }
  return username;
}

function linkOAuth(profile: OAuthProfile, user: any) {
  OAuthAccounts.upsert({
    id: randomUUID(),
    user_id: user.uid,
    provider: profile.provider,
    provider_user_id: profile.providerUserId,
    email: profile.email,
    email_verified: profile.emailVerified ? 1 : 0,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl || null,
  });
}

function createPendingOAuthUser(profile: OAuthProfile, role: string) {
  const requestedRole = safeRole(role);
  const publicRole = ['GERENTE', 'ADMINISTRACION'].includes(requestedRole) ? 'ASESOR' : requestedRole;
  const user = {
    uid: randomUUID(),
    nombre: profile.displayName,
    email: profile.email,
    username: uniqueUsername(profile.email),
    role: publicRole,
    password: `oauth:${randomBytes(24).toString('base64url')}`,
    zona: null,
    puesto: null,
    activo: 2,
  };
  Users.create(user);
  linkOAuth(profile, user);
  AuditLog.insert({
    accion: 'OAUTH_REGISTER_PENDING',
    entidad: 'users',
    entidad_id: user.uid,
    user_id: user.uid,
    user_nombre: user.nombre,
    detalle: `${profile.provider}:${profile.email}`,
  });
  return user;
}

function sessionForOAuthUser(user: any, req: Request, res: Response) {
  const managerRequiresWebAuthn = ['GERENTE', 'ADMINISTRACION'].includes(user.role) && isWebAuthnRequired(req);
  const { password: _password, ...safe } = user;
  const { accessToken: _accessToken, ...session } = issueSessionCookie(res, user, req, ['GERENTE', 'ADMINISTRACION'].includes(user.role)
    ? { webAuthnVerified: !managerRequiresWebAuthn, webAuthnEnrollmentRequired: managerRequiresWebAuthn }
    : {});
  return {
    ...safe,
    displayName: user.nombre,
    ...session,
    webAuthnEnrollmentRequired: managerRequiresWebAuthn,
  };
}

export function oauthStart(req: Request, res: Response) {
  try {
    const provider = String(req.params.provider || '') as OAuthProvider;
    const { config, clientId } = providerConfig(provider);
    const mode = (String(req.query.mode || 'login') === 'register' ? 'register' : 'login') as OAuthMode;
    if (mode === 'register' && req.query.termsAccepted !== 'true') {
      return renderOAuthResult(res, {
        title: 'Términos requeridos',
        message: 'Debes aceptar los Términos y Condiciones antes de registrarte con Google.',
        error: true,
      });
    }
    const state = encodeState({
      provider,
      mode,
      role: safeRole(req.query.role),
      termsAccepted: req.query.termsAccepted === 'true',
      nonce: randomBytes(16).toString('base64url'),
      exp: Date.now() + 10 * 60 * 1000,
    });
    const authUrl = new URL(config.authUrl());
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl(req, provider));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');
    res.redirect(authUrl.toString());
  } catch (err: any) {
    renderOAuthResult(res, {
      title: 'OAuth no configurado',
      message: err?.message || 'No se pudo iniciar el acceso con Google.',
      error: true,
    });
  }
}

export async function oauthCallback(req: Request, res: Response) {
  const provider = String(req.params.provider || '') as OAuthProvider;
  try {
    providerConfig(provider);
    const providerError = String(req.query.error || '');
    if (providerError) {
      const description = String(req.query.error_description || req.query.error_uri || '').trim();
      throw new Error(description || `El proveedor devolvió error OAuth: ${providerError}`);
    }
    const code = String(req.query.code || '');
    const state = decodeState(String(req.query.state || ''));
    if (!code) throw new Error('Código OAuth faltante');
    if (state.provider !== provider) throw new Error('Proveedor OAuth no coincide');

    const accessToken = await exchangeCode(provider, code, callbackUrl(req, provider));
    const profile = await fetchProfile(provider, accessToken);
    if (!profile.emailVerified) {
      return renderOAuthResult(res, {
        title: 'Correo no verificado',
        message: 'El proveedor no confirmó ese correo como verificado. Usa una cuenta Google verificada.',
        error: true,
      });
    }
    let user = Users.getByEmail(profile.email) as any;
    const linked = OAuthAccounts.getByProviderUser(profile.provider, profile.providerUserId) as any;
    if (linked && !user) user = Users.getById(linked.user_id) as any;

    if (!user && state.mode === 'login') {
      return renderOAuthResult(res, {
        title: 'Cuenta no encontrada',
        message: 'No existe una cuenta aprobada con ese correo. Usa la opción de registro con Google.',
        error: true,
      });
    }

    if (!user) {
      if (process.env.NODE_ENV === 'production' && process.env.PUBLIC_REGISTRATION_ENABLED !== 'true') {
        return renderOAuthResult(res, {
          title: 'Registro deshabilitado',
          message: 'El registro público está cerrado en producción. Solicita invitación a gerencia.',
          error: true,
        });
      }
      user = createPendingOAuthUser(profile, state.role);
      return renderOAuthResult(res, {
        title: 'Registro enviado',
        message: 'Tu cuenta con Google quedó pendiente de aprobación por gerencia.',
      });
    }

    linkOAuth(profile, user);
    if (user.activo === 2) {
      return renderOAuthResult(res, {
        title: 'Cuenta pendiente',
        message: 'Tu cuenta existe, pero todavía requiere aprobación por gerencia.',
        error: true,
      });
    }
    if (user.activo === 0) {
      return renderOAuthResult(res, {
        title: 'Cuenta inactiva',
        message: 'Tu cuenta está desactivada. Contacta a gerencia.',
        error: true,
      });
    }

    AuditLog.insert({
      accion: 'OAUTH_LOGIN',
      entidad: 'users',
      entidad_id: user.uid,
      user_id: user.uid,
      user_nombre: user.nombre,
      detalle: `${profile.provider}:${profile.email}`,
    });
    renderOAuthResult(res, {
      session: sessionForOAuthUser(user, req, res),
      title: 'Acceso verificado',
      message: 'Cuenta verificada. Entrando al CRM.',
    });
  } catch (err: any) {
    renderOAuthResult(res, {
      title: 'OAuth no disponible',
      message: err?.message || 'No se pudo completar el acceso externo.',
      error: true,
    });
  }
}

export function oauthStatus() {
  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  return {
    google: isValidGoogleClientId(googleClientId) && isConfiguredValue(googleClientSecret),
    microsoft: false,
    callbacks: {
      google: '/api/auth/oauth/google/callback',
    },
    missing: {
      googleClientId: !isValidGoogleClientId(googleClientId),
      googleClientSecret: !isConfiguredValue(googleClientSecret),
    },
  };
}
