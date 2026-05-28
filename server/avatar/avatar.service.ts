import type { Express, RequestHandler } from 'express';
import { Users } from '../db';
import { AvatarStorage } from './avatar.storage';

type RouteDeps = {
  authOnly: RequestHandler;
  wrap: (handler: any) => RequestHandler;
  createHttpError: (status: number, message: string) => Error;
};

const PROFILE_MANAGERS = new Set(['GERENTE', 'ADMINISTRACION', 'SUPERVISOR']);

function canAccessAvatar(auth: any, userId: string) {
  return auth?.sub === userId || PROFILE_MANAGERS.has(auth?.role);
}

function publicAvatarPayload(row: any, userId: string) {
  return row || {
    user_id: userId,
    avatarUrl: null,
    borderStyle: 'neural',
    neonColor: 'electric_blue',
    backgroundStyle: 'neural',
    animationStyle: 'float',
    glowIntensity: 72,
    rarity: 'rare',
    aiGenerated: true,
    statusEffect: 'online',
    phrase: '',
  };
}

export function registerAvatarRoutes(app: Express, deps: RouteDeps) {
  const { authOnly, wrap, createHttpError } = deps;

  app.get('/api/user-avatars/:userId', authOnly, wrap((req: any, res: any) => {
    const userId = String(req.params.userId || '').trim();
    if (!userId) throw createHttpError(400, 'Usuario requerido');
    if (!canAccessAvatar(req.auth, userId)) throw createHttpError(403, 'No puedes consultar este avatar');
    const user = Users.getById(userId);
    if (!user) throw createHttpError(404, 'Usuario no encontrado');
    res.json(publicAvatarPayload(AvatarStorage.getByUserId(userId), userId));
  }));

  app.put('/api/user-avatars/:userId', authOnly, wrap((req: any, res: any) => {
    const userId = String(req.params.userId || '').trim();
    if (!userId) throw createHttpError(400, 'Usuario requerido');
    if (!canAccessAvatar(req.auth, userId)) throw createHttpError(403, 'No puedes modificar este avatar');
    const user = Users.getById(userId);
    if (!user) throw createHttpError(404, 'Usuario no encontrado');
    const saved = AvatarStorage.upsert(userId, req.body || {});
    res.json(publicAvatarPayload(saved, userId));
  }));
}
