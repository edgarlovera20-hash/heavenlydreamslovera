import {
  AVATAR_NEON_COLORS,
  AVATAR_RARITIES,
  AVATAR_REALTIME_STATUSES,
  type AvatarIdentityConfig,
  type AvatarNeonColor,
  type AvatarRarity,
  type AvatarRealtimeStatus,
} from './avatar-presets';
import type { CSSProperties } from 'react';

const TONE_MAP: Record<AvatarNeonColor, { primary: string; secondary: string; soft: string }> = {
  electric_blue: { primary: '#00C2FF', secondary: '#1F51FF', soft: 'rgba(0,194,255,0.18)' },
  cyan_neon: { primary: '#7DF9FF', secondary: '#00E5FF', soft: 'rgba(125,249,255,0.18)' },
  violet: { primary: '#A855F7', secondary: '#7B61FF', soft: 'rgba(168,85,247,0.18)' },
  plasma_red: { primary: '#FF2D55', secondary: '#FB7185', soft: 'rgba(255,45,85,0.18)' },
  matrix_green: { primary: '#00FFD5', secondary: '#34D399', soft: 'rgba(0,255,213,0.18)' },
  premium_gold: { primary: '#FACC15', secondary: '#F97316', soft: 'rgba(250,204,21,0.18)' },
};

const RARITY_BOOST: Record<AvatarRarity, number> = {
  common: 0.76,
  rare: 0.9,
  epic: 1,
  legendary: 1.12,
  mythic: 1.2,
  ai_elite: 1.28,
};

export function avatarTone(color: AvatarNeonColor) {
  return TONE_MAP[color] || TONE_MAP.electric_blue;
}

export function avatarStatusColor(status: AvatarRealtimeStatus) {
  return AVATAR_REALTIME_STATUSES.find((item) => item.value === status)?.color || '#94A3B8';
}

export function avatarRarityColor(rarity: AvatarRarity) {
  return AVATAR_RARITIES.find((item) => item.value === rarity)?.color || '#94A3B8';
}

export function avatarCssVars(config: AvatarIdentityConfig): CSSProperties {
  const tone = avatarTone(config.neonColor);
  const statusColor = avatarStatusColor(config.statusEffect);
  const rarityColor = avatarRarityColor(config.rarity);
  const intensity = Math.min(1.6, Math.max(0.4, (config.glowIntensity / 100) * (RARITY_BOOST[config.rarity] || 1)));
  return {
    '--avatar-primary': tone.primary,
    '--avatar-secondary': tone.secondary,
    '--avatar-soft': tone.soft,
    '--avatar-status': statusColor,
    '--avatar-rarity': rarityColor,
    '--avatar-glow': `${Math.round(20 * intensity)}px`,
    '--avatar-glow-strong': `${Math.round(46 * intensity)}px`,
    '--avatar-alpha': String(Math.min(0.7, 0.22 + intensity * 0.26)),
  } as CSSProperties;
}

export function avatarLabel(value: string, fallback = value) {
  return (
    AVATAR_NEON_COLORS.find((item) => item.value === value)?.label ||
    AVATAR_RARITIES.find((item) => item.value === value)?.label ||
    AVATAR_REALTIME_STATUSES.find((item) => item.value === value)?.label ||
    fallback
  );
}
