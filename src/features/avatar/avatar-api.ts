import {
  normalizeAvatarIdentity,
  type AvatarIdentityConfig,
} from './avatar-presets';
import { loadAvatarIdentity, saveAvatarIdentity } from './avatar-store';

function serializeIdentity(identity: AvatarIdentityConfig) {
  return {
    avatarUrl: identity.avatarUrl || null,
    borderStyle: identity.borderStyle,
    neonColor: identity.neonColor,
    backgroundStyle: identity.backgroundStyle,
    animationStyle: identity.animationStyle,
    glowIntensity: identity.glowIntensity,
    rarity: identity.rarity,
    aiGenerated: identity.aiGenerated,
    statusEffect: identity.statusEffect,
    phrase: identity.phrase || '',
  };
}

export async function fetchAvatarIdentity(uid?: string | null): Promise<AvatarIdentityConfig> {
  if (!uid) return loadAvatarIdentity(uid);
  try {
    const res = await fetch(`/api/user-avatars/${encodeURIComponent(uid)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Avatar API ${res.status}`);
    const data = await res.json();
    const identity = normalizeAvatarIdentity({
      userId: uid,
      avatarUrl: data.avatarUrl || data.avatar_url,
      borderStyle: data.borderStyle || data.border_style,
      neonColor: data.neonColor || data.colors?.neonColor,
      backgroundStyle: data.backgroundStyle || data.effects?.backgroundStyle,
      animationStyle: data.animationStyle || data.effects?.animationStyle,
      glowIntensity: data.glowIntensity || data.effects?.glowIntensity,
      rarity: data.rarity,
      aiGenerated: Boolean(data.aiGenerated ?? data.ai_generated),
      statusEffect: data.statusEffect || data.status_effect,
      phrase: data.phrase || data.effects?.phrase,
    });
    saveAvatarIdentity(uid, identity);
    return identity;
  } catch {
    return loadAvatarIdentity(uid);
  }
}

export async function upsertAvatarIdentity(uid: string | undefined | null, identity: Partial<AvatarIdentityConfig>) {
  const config = saveAvatarIdentity(uid, identity);
  if (!uid) return config;
  try {
    const res = await fetch(`/api/user-avatars/${encodeURIComponent(uid)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializeIdentity(config)),
    });
    if (!res.ok) throw new Error(`Avatar API ${res.status}`);
    return normalizeAvatarIdentity(await res.json());
  } catch {
    return config;
  }
}
