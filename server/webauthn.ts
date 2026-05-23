import { randomUUID } from 'crypto';
import { isIP } from 'net';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON, WebAuthnCredential } from '@simplewebauthn/server';
import { AuditLog, Users, WebAuthnChallenges, WebAuthnCredentials } from './db';
import { issueSession } from './security';
import type { Request } from 'express';

const RP_NAME = 'Heavenly Dreams CRM';

function firstHeader(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(',')[0]?.trim();
}

function stripPort(host: string) {
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']'));
  return host.split(':')[0];
}

function rpID(req?: Request) {
  const configured = process.env.WEBAUTHN_RP_ID?.trim();
  if (configured) return stripPort(configured);
  const forwardedHost = firstHeader(req?.headers['x-forwarded-host'] as any);
  const host = forwardedHost || req?.get('host') || req?.hostname || 'localhost';
  return stripPort(host);
}

function origin(req?: Request) {
  const configured = process.env.WEBAUTHN_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const proto = firstHeader(req?.headers['x-forwarded-proto'] as any) || req?.protocol || 'http';
  const forwardedHost = firstHeader(req?.headers['x-forwarded-host'] as any);
  const host = forwardedHost || req?.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

function isLocalRp(id: string) {
  return id === 'localhost' || id === '127.0.0.1' || id === '::1';
}

function assertWebAuthnContext(req?: Request) {
  const id = rpID(req);
  const expectedOrigin = origin(req);
  if (!isLocalRp(id) && isIP(id)) {
    throw new Error('WebAuthn requiere un dominio valido; no funciona con IP directa. Configura WEBAUTHN_RP_ID y WEBAUTHN_ORIGIN con un dominio HTTPS.');
  }
  if (!isLocalRp(id) && !expectedOrigin.startsWith('https://')) {
    throw new Error('WebAuthn requiere HTTPS en produccion. Configura WEBAUTHN_ORIGIN con https://tu-dominio.');
  }
}

function toB64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64url');
}

function fromB64Url(value: string) {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}

function challengeExpiresAt() {
  return new Date(Date.now() + 5 * 60 * 1000).toISOString();
}

function getCredentials(userId: string) {
  return (WebAuthnCredentials.getByUser(userId) as any[]).map(row => ({
    ...row,
    transports: row.transports ? JSON.parse(row.transports) : undefined,
  }));
}

function toCredential(row: any): WebAuthnCredential {
  return {
    id: row.credential_id,
    publicKey: fromB64Url(row.public_key),
    counter: Number(row.counter || 0),
    transports: row.transports ? JSON.parse(row.transports) : undefined,
  };
}

export function userHasPasskey(userId: string) {
  return getCredentials(userId).length > 0;
}

export async function makeRegistrationOptions(userId: string, req?: Request) {
  assertWebAuthnContext(req);
  WebAuthnChallenges.clearExpired();
  const user = Users.getById(userId) as any;
  if (!user) throw new Error('Usuario no encontrado');

  const existing = getCredentials(userId);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(req),
    userID: new TextEncoder().encode(user.uid),
    userName: user.email || user.username,
    userDisplayName: user.nombre || user.username,
    timeout: 60_000,
    attestationType: 'none',
    excludeCredentials: existing.map(c => ({ id: c.credential_id, transports: c.transports })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });

  WebAuthnChallenges.set({
    id: randomUUID(),
    user_id: user.uid,
    challenge: options.challenge,
    type: 'registration',
    expires_at: challengeExpiresAt(),
  });

  return options;
}

export async function verifyRegistration(userId: string, response: RegistrationResponseJSON, req?: Request) {
  const clientChallenge = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8')).challenge;
  const challenge = WebAuthnChallenges.consume(userId, 'registration', clientChallenge);
  if (!challenge) throw new Error('Challenge de registro inválido o expirado');

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin(req),
    expectedRPID: rpID(req),
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error('No se pudo verificar la passkey');

  const info = verification.registrationInfo;
  WebAuthnCredentials.create({
    id: randomUUID(),
    user_id: userId,
    credential_id: info.credential.id,
    public_key: toB64Url(info.credential.publicKey),
    counter: info.credential.counter || 0,
    transports: JSON.stringify(response.response.transports || []),
    device_type: info.credentialDeviceType,
    backed_up: info.credentialBackedUp ? 1 : 0,
  });
  AuditLog.insert({ accion: 'WEBAUTHN_REGISTER', entidad: 'users', entidad_id: userId, user_id: userId, user_nombre: null, detalle: info.credential.id });
  const user = Users.getById(userId) as any;
  const { password: _, ...safe } = user;
  return {
    ...safe,
    ...issueSession(user, req, { webAuthnVerified: true }),
    verified: true,
    webAuthnVerified: true,
    webAuthnEnrollmentRequired: false,
  };
}

export async function makeAuthenticationOptions(userId: string, req?: Request) {
  assertWebAuthnContext(req);
  WebAuthnChallenges.clearExpired();
  const user = Users.getById(userId) as any;
  if (!user) throw new Error('Usuario no encontrado');
  const credentials = getCredentials(userId);
  if (!credentials.length) throw new Error('El usuario no tiene passkeys registradas');

  const options = await generateAuthenticationOptions({
    rpID: rpID(req),
    timeout: 60_000,
    userVerification: 'required',
    allowCredentials: credentials.map(c => ({ id: c.credential_id, transports: c.transports })),
  });

  WebAuthnChallenges.set({
    id: randomUUID(),
    user_id: user.uid,
    challenge: options.challenge,
    type: 'authentication',
    expires_at: challengeExpiresAt(),
  });

  return options;
}

export async function verifyAuthentication(userId: string, response: AuthenticationResponseJSON, req?: Request) {
  const credentialRow = WebAuthnCredentials.getByCredentialId(response.id) as any;
  if (!credentialRow || credentialRow.user_id !== userId) throw new Error('Credencial no registrada para este usuario');
  const clientChallenge = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8')).challenge;
  const challenge = WebAuthnChallenges.consume(userId, 'authentication', clientChallenge);
  if (!challenge) throw new Error('Challenge de autenticación inválido o expirado');

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin(req),
    expectedRPID: rpID(req),
    credential: toCredential(credentialRow),
    requireUserVerification: true,
  });

  if (!verification.verified) throw new Error('Passkey inválida');
  WebAuthnCredentials.updateCounter(response.id, verification.authenticationInfo.newCounter);
  const user = Users.getById(userId) as any;
  AuditLog.insert({ accion: 'WEBAUTHN_LOGIN', entidad: 'users', entidad_id: userId, user_id: userId, user_nombre: user?.nombre || null, detalle: response.id });
  const { password: _, ...safe } = user;
  return { ...safe, ...issueSession(user, req, { webAuthnVerified: true }), webAuthnVerified: true };
}
