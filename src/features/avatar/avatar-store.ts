import {
  DEFAULT_AVATAR_IDENTITY,
  normalizeAvatarIdentity,
  type AvatarIdentityConfig,
} from './avatar-presets';

export const AVATAR_IDENTITY_EVENT = 'hd-avatar-identity-updated';

export function avatarIdentityStorageKey(uid: string) {
  return `hd_avatar_identity_${uid}`;
}

export function loadAvatarIdentity(uid?: string | null): AvatarIdentityConfig {
  if (!uid || typeof localStorage === 'undefined') return DEFAULT_AVATAR_IDENTITY;
  try {
    const raw = localStorage.getItem(avatarIdentityStorageKey(uid));
    return normalizeAvatarIdentity(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_AVATAR_IDENTITY;
  }
}

export function saveAvatarIdentity(uid: string | undefined | null, identity: Partial<AvatarIdentityConfig>) {
  const config = normalizeAvatarIdentity({ ...identity, userId: uid || identity.userId });
  if (uid && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(avatarIdentityStorageKey(uid), JSON.stringify(config));
    } catch {
      // Visual identity can still update in-memory if storage quota is unavailable.
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AVATAR_IDENTITY_EVENT, { detail: { uid, identity: config } }));
  }
  return config;
}
