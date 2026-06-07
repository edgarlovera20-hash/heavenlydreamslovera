import { randomUUID } from 'crypto';
import { db, updateById, parseJson } from './connection';
import { passwordForStorage } from './schema';

export const Users = {
  getAll: () => db.prepare('SELECT * FROM users ORDER BY nombre').all(),
  getById: (uid: string) => db.prepare('SELECT * FROM users WHERE uid=?').get(uid),
  getByUsername: (username: string) => db.prepare('SELECT * FROM users WHERE username=?').get(username),
  getByEmail: (email: string) => db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(email),
  create: (data: any) => {
    const clean = { ...data, password: passwordForStorage(data.password) };
    const stmt = db.prepare(`
      INSERT INTO users (uid,nombre,email,username,role,password,zona,puesto,activo)
      VALUES (@uid,@nombre,@email,@username,@role,@password,@zona,@puesto,@activo)
    `);
    return stmt.run(clean);
  },
  update: (uid: string, data: any) => {
    const clean = { ...data };
    if (Object.prototype.hasOwnProperty.call(clean, 'password') && clean.password) {
      clean.password = passwordForStorage(clean.password);
    }
    return updateById('users', 'uid', uid, clean, ['nombre', 'email', 'username', 'role', 'password', 'zona', 'puesto', 'avatar', 'biometric_id', 'activo']);
  },
  delete: (uid: string) => db.prepare("DELETE FROM users WHERE uid=?").run(uid),
};

function normalizeUserAvatar(row: any) {
  if (!row) return null;
  const colors = parseJson(row.colors, {});
  const effects = parseJson(row.effects, {});
  return {
    ...row,
    avatarUrl: row.avatar_url,
    borderStyle: row.border_style,
    neonColor: colors.neonColor || 'electric_blue',
    backgroundStyle: effects.backgroundStyle || 'neural',
    animationStyle: effects.animationStyle || 'float',
    glowIntensity: Number(effects.glowIntensity || 72),
    animationSpeed: Number(row.animation_speed || 1),
    rarity: row.rarity || 'rare',
    aiGenerated: Boolean(row.ai_generated),
    statusEffect: row.status_effect || 'online',
    phrase: effects.phrase || '',
    colors,
    effects,
  };
}

export const UserAvatars = {
  getByUserId: (userId: string) => normalizeUserAvatar(db.prepare('SELECT * FROM user_avatars WHERE user_id=?').get(userId)),
  upsert: (userId: string, data: any) => {
    const existing = UserAvatars.getByUserId(userId) as any;
    const colors = {
      ...(existing?.colors || {}),
      ...(typeof data.colors === 'object' ? data.colors : {}),
      neonColor: data.neonColor || data.colors?.neonColor || existing?.neonColor || 'electric_blue',
    };
    const effects = {
      ...(existing?.effects || {}),
      ...(typeof data.effects === 'object' ? data.effects : {}),
      backgroundStyle: data.backgroundStyle || data.effects?.backgroundStyle || existing?.backgroundStyle || 'neural',
      animationStyle: data.animationStyle || data.effects?.animationStyle || existing?.animationStyle || 'float',
      glowIntensity: Number(data.glowIntensity || data.effects?.glowIntensity || existing?.glowIntensity || 72),
      phrase: String(data.phrase || data.effects?.phrase || existing?.phrase || '').slice(0, 44),
    };
    db.prepare(`
      INSERT INTO user_avatars
        (id,user_id,avatar_url,border_style,colors,effects,animation_speed,rarity,ai_generated,status_effect)
      VALUES
        (@id,@user_id,@avatar_url,@border_style,@colors,@effects,@animation_speed,@rarity,@ai_generated,@status_effect)
      ON CONFLICT(user_id) DO UPDATE SET
        avatar_url=excluded.avatar_url,
        border_style=excluded.border_style,
        colors=excluded.colors,
        effects=excluded.effects,
        animation_speed=excluded.animation_speed,
        rarity=excluded.rarity,
        ai_generated=excluded.ai_generated,
        status_effect=excluded.status_effect,
        updated_at=datetime('now')
    `).run({
      id: existing?.id || data.id || randomUUID(),
      user_id: userId,
      avatar_url: data.avatarUrl || data.avatar_url || existing?.avatarUrl || null,
      border_style: data.borderStyle || data.border_style || existing?.borderStyle || 'neural',
      colors: JSON.stringify(colors),
      effects: JSON.stringify(effects),
      animation_speed: Number(data.animationSpeed || data.animation_speed || existing?.animationSpeed || 1),
      rarity: data.rarity || existing?.rarity || 'rare',
      ai_generated: data.aiGenerated === false || data.ai_generated === 0 ? 0 : 1,
      status_effect: data.statusEffect || data.status_effect || existing?.statusEffect || 'online',
    });
    return UserAvatars.getByUserId(userId);
  },
  delete: (userId: string) => db.prepare('DELETE FROM user_avatars WHERE user_id=?').run(userId),
};

export const Sessions = {
  create: (data: any) => db.prepare(`
    INSERT INTO sessions (id,user_id,refresh_token,expires_at,ip,user_agent,webauthn_verified,webauthn_enrollment_required)
    VALUES (@id,@user_id,@refresh_token,@expires_at,@ip,@user_agent,@webauthn_verified,@webauthn_enrollment_required)
  `).run(data),
  getByRefreshToken: (token: string) => db.prepare('SELECT * FROM sessions WHERE refresh_token=?').get(token),
  revoke: (token: string) => db.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE refresh_token=?").run(token),
};

export const OAuthAccounts = {
  getByProviderUser: (provider: string, providerUserId: string) => db.prepare(
    'SELECT * FROM oauth_accounts WHERE provider=? AND provider_user_id=?'
  ).get(provider, providerUserId),
  upsert: (data: any) => db.prepare(`
    INSERT INTO oauth_accounts
      (id,user_id,provider,provider_user_id,email,email_verified,display_name,avatar_url)
    VALUES
      (@id,@user_id,@provider,@provider_user_id,@email,@email_verified,@display_name,@avatar_url)
    ON CONFLICT(provider, provider_user_id) DO UPDATE SET
      user_id=excluded.user_id,
      email=excluded.email,
      email_verified=excluded.email_verified,
      display_name=excluded.display_name,
      avatar_url=excluded.avatar_url,
      updated_at=datetime('now')
  `).run(data),
};

export const WebAuthnCredentials = {
  getByUser: (userId: string) => db.prepare('SELECT * FROM webauthn_credentials WHERE user_id=? ORDER BY created_at DESC').all(userId),
  getByCredentialId: (credentialId: string) => db.prepare('SELECT * FROM webauthn_credentials WHERE credential_id=?').get(credentialId),
  create: (data: any) => db.prepare(`
    INSERT INTO webauthn_credentials
      (id,user_id,credential_id,public_key,counter,transports,device_type,backed_up)
    VALUES
      (@id,@user_id,@credential_id,@public_key,@counter,@transports,@device_type,@backed_up)
  `).run(data),
  updateCounter: (credentialId: string, counter: number) => db.prepare(`
    UPDATE webauthn_credentials SET counter=?, updated_at=datetime('now') WHERE credential_id=?
  `).run(counter, credentialId),
};

export const WebAuthnChallenges = {
  set: (data: any) => db.prepare(`
    INSERT INTO webauthn_challenges (id,user_id,challenge,type,expires_at)
    VALUES (@id,@user_id,@challenge,@type,@expires_at)
  `).run(data),
  consume: (userId: string, type: string, challenge: string) => {
    const row = db.prepare(`
      SELECT * FROM webauthn_challenges
      WHERE user_id=? AND type=? AND challenge=? AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(userId, type, challenge) as any;
    if (row) db.prepare('DELETE FROM webauthn_challenges WHERE id=?').run(row.id);
    return row;
  },
  clearExpired: () => db.prepare("DELETE FROM webauthn_challenges WHERE expires_at <= datetime('now')").run(),
};
