import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { AuditLog, Sessions, Users } from './db';

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_JWT_SECRET = 'dev-heavenly-dreams-change-me';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const ISSUER = 'heavenly-dreams-crm';
const REFRESH_COOKIE = 'hd_refresh';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en producción');
}

export type AppRole = 'GERENTE' | 'SUPERVISOR' | 'ASESOR';

type SessionOptions = {
  webAuthnVerified?: boolean;
  webAuthnEnrollmentRequired?: boolean;
};

function isSecureRequest(req?: Request) {
  const forwardedProto = String(req?.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return forwardedProto === 'https' || req?.secure === true || process.env.NODE_ENV === 'production';
}

function parseCookies(req: Request) {
  const header = req.headers.cookie || '';
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function setCookie(res: Response, value: string, expiresAt: string | Date, req?: Request) {
  const attrs = [
    `${REFRESH_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (isSecureRequest(req)) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

export function clearRefreshCookie(res: Response, req?: Request) {
  setCookie(res, '', new Date(0), req);
}

export function getRefreshTokenFromRequest(req: Request) {
  return String((req.body as any)?.refreshToken || parseCookies(req)[REFRESH_COOKIE] || '').trim();
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string) {
  return createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createAccessToken(user: any, options: SessionOptions = {}) {
  const now = Date.now();
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: ISSUER,
    sub: user.uid,
    role: user.role,
    name: user.nombre,
    webAuthnVerified: options.webAuthnVerified === true,
    webAuthnEnrollmentRequired: options.webAuthnEnrollmentRequired === true,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + ACCESS_TTL_MS) / 1000),
  }));
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifyAccessToken(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token inválido');
  const unsigned = `${parts[0]}.${parts[1]}`;
  if (!safeEqual(sign(unsigned), parts[2])) throw new Error('Firma inválida');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (payload.iss !== ISSUER) throw new Error('Issuer inválido');
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error('Token expirado');
  return payload;
}

export function getBearerAuth(req: Request) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  return verifyAccessToken(token);
}

function createSessionRecord(user: any, req?: Request, options: SessionOptions = {}) {
  const refreshToken = `${randomUUID()}.${randomBytes(32).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
  const webAuthnVerified = options.webAuthnVerified === true;
  const webAuthnEnrollmentRequired = options.webAuthnEnrollmentRequired === true;
  Sessions.create({
    id: randomUUID(),
    user_id: user.uid,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    ip: req?.ip || null,
    user_agent: req?.headers['user-agent'] || null,
    webauthn_verified: webAuthnVerified ? 1 : 0,
    webauthn_enrollment_required: webAuthnEnrollmentRequired ? 1 : 0,
  });
  return {
    refreshToken,
    expiresAt,
    publicSession: {
      accessToken: createAccessToken(user, { webAuthnVerified, webAuthnEnrollmentRequired }),
      expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
      webAuthnVerified,
      webAuthnEnrollmentRequired,
    },
  };
}

export function issueSession(user: any, req?: Request, options: SessionOptions = {}) {
  return createSessionRecord(user, req, options).publicSession;
}

export function issueSessionCookie(res: Response, user: any, req?: Request, options: SessionOptions = {}) {
  const created = createSessionRecord(user, req, options);
  setCookie(res, created.refreshToken, created.expiresAt, req);
  return created.publicSession;
}

export function rotateRefreshToken(refreshToken: string, req?: Request, res?: Response) {
  const session = Sessions.getByRefreshToken(refreshToken) as any;
  if (!session || session.revoked_at) throw new Error('Sesión inválida');
  if (new Date(session.expires_at).getTime() < Date.now()) throw new Error('Sesión expirada');
  Sessions.revoke(refreshToken);
  const user = Users.getById(session.user_id) as any;
  if (!user || user.activo !== 1) throw new Error('Usuario inactivo');
  AuditLog.insert({
    accion: 'REFRESH_TOKEN_ROTATED',
    entidad: 'sessions',
    entidad_id: session.id,
    user_id: user.uid,
    user_nombre: user.nombre,
    detalle: null,
  });
  const nextSession = createSessionRecord(user, req, {
    webAuthnVerified: session.webauthn_verified === 1,
    webAuthnEnrollmentRequired: session.webauthn_enrollment_required === 1,
  });
  if (res) setCookie(res, nextSession.refreshToken, nextSession.expiresAt, req);
  return {
    user,
    session: nextSession.publicSession,
  };
}

function allowsPendingManagerPasskey(req: Request) {
  return [
    '/api/webauthn/register/options',
    '/api/webauthn/register/verify',
    '/api/auth/passkey/continue',
    '/api/auth/logout',
    '/api/auth/refresh',
  ].includes(req.path);
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const auth = verifyAccessToken(token);
    if (auth.role === 'GERENTE' && auth.webAuthnEnrollmentRequired === true && auth.webAuthnVerified !== true && !allowsPendingManagerPasskey(req)) {
      return res.status(403).json({
        error: 'Passkey requerida para completar el acceso de gerencia.',
        code: 'WEBAUTHN_REQUIRED',
      });
    }
    (req as any).auth = auth;
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Token inválido' });
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  return authenticate(req, res, next);
}

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    authenticate(req, res, () => {
      const role = (req as any).auth?.role;
      if (!roles.includes(role)) return res.status(403).json({ error: 'Permisos insuficientes' });
      next();
    });
  };
}

export function rateLimit(name: string, limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const current = hits.get(key);
    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > limit) {
      return res.status(429).json({ error: 'Demasiadas solicitudes, intenta más tarde.' });
    }
    next();
  };
}
