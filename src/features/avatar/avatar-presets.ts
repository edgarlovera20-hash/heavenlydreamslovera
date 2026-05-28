export type AvatarNeonColor =
  | 'electric_blue'
  | 'cyan_neon'
  | 'violet'
  | 'plasma_red'
  | 'matrix_green'
  | 'premium_gold';

export type AvatarBorderStyle =
  | 'moving'
  | 'pulse'
  | 'orbit'
  | 'energy'
  | 'glitch'
  | 'neural';

export type AvatarBackgroundStyle =
  | 'galaxy'
  | 'particles'
  | 'neural'
  | 'grid'
  | 'hologram'
  | 'liquid';

export type AvatarAnimationStyle =
  | 'calm'
  | 'float'
  | 'pulse'
  | 'orbit'
  | 'glitch';

export type AvatarRarity =
  | 'common'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'ai_elite';

export type AvatarRealtimeStatus =
  | 'online'
  | 'ai_active'
  | 'workflow'
  | 'busy'
  | 'error'
  | 'offline';

export type AvatarIdentityConfig = {
  userId?: string;
  avatarUrl?: string | null;
  borderStyle: AvatarBorderStyle;
  neonColor: AvatarNeonColor;
  backgroundStyle: AvatarBackgroundStyle;
  animationStyle: AvatarAnimationStyle;
  glowIntensity: number;
  rarity: AvatarRarity;
  aiGenerated: boolean;
  statusEffect: AvatarRealtimeStatus;
  phrase?: string;
};

export type AvatarPresetOption<T extends string = string> = {
  value: T;
  label: string;
  hint?: string;
  color?: string;
};

export const AVATAR_NEON_COLORS: AvatarPresetOption<AvatarNeonColor>[] = [
  { value: 'electric_blue', label: 'Azul electrico', color: '#00C2FF' },
  { value: 'cyan_neon', label: 'Cyan neon', color: '#7DF9FF' },
  { value: 'violet', label: 'Violeta IA', color: '#A855F7' },
  { value: 'plasma_red', label: 'Rojo plasma', color: '#FF2D55' },
  { value: 'matrix_green', label: 'Verde matrix', color: '#00FFD5' },
  { value: 'premium_gold', label: 'Dorado premium', color: '#FACC15' },
];

export const AVATAR_BORDER_STYLES: AvatarPresetOption<AvatarBorderStyle>[] = [
  { value: 'moving', label: 'Moving border', hint: 'Energia corriendo por el borde' },
  { value: 'pulse', label: 'Pulse border', hint: 'Respira con luz neon' },
  { value: 'orbit', label: 'Orbit border', hint: 'Particulas girando alrededor' },
  { value: 'energy', label: 'Energy ring', hint: 'Anillo de estado IA' },
  { value: 'glitch', label: 'Glitch border', hint: 'Distorsion cyber suave' },
  { value: 'neural', label: 'Neural ring', hint: 'Conexiones de identidad IA' },
];

export const AVATAR_BACKGROUNDS: AvatarPresetOption<AvatarBackgroundStyle>[] = [
  { value: 'galaxy', label: 'Galaxia' },
  { value: 'particles', label: 'Particulas' },
  { value: 'neural', label: 'IA neural' },
  { value: 'grid', label: 'Grid futurista' },
  { value: 'hologram', label: 'Holograma' },
  { value: 'liquid', label: 'Energia liquida' },
];

export const AVATAR_ANIMATIONS: AvatarPresetOption<AvatarAnimationStyle>[] = [
  { value: 'calm', label: 'Calma' },
  { value: 'float', label: 'Flotante' },
  { value: 'pulse', label: 'Pulso' },
  { value: 'orbit', label: 'Orbital' },
  { value: 'glitch', label: 'Glitch suave' },
];

export const AVATAR_RARITIES: AvatarPresetOption<AvatarRarity>[] = [
  { value: 'common', label: 'Common', color: '#94A3B8' },
  { value: 'rare', label: 'Rare', color: '#38BDF8' },
  { value: 'epic', label: 'Epic', color: '#A855F7' },
  { value: 'legendary', label: 'Legendary', color: '#F97316' },
  { value: 'mythic', label: 'Mythic', color: '#EC4899' },
  { value: 'ai_elite', label: 'AI Elite', color: '#00FFD5' },
];

export const AVATAR_REALTIME_STATUSES: AvatarPresetOption<AvatarRealtimeStatus>[] = [
  { value: 'online', label: 'Online', color: '#34D399' },
  { value: 'ai_active', label: 'IA activa', color: '#00E5FF' },
  { value: 'workflow', label: 'Workflow', color: '#A855F7' },
  { value: 'busy', label: 'Ocupado', color: '#FACC15' },
  { value: 'error', label: 'Error', color: '#FB7185' },
  { value: 'offline', label: 'Offline', color: '#94A3B8' },
];

export const DEFAULT_AVATAR_IDENTITY: AvatarIdentityConfig = {
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

function isValue<T extends string>(items: AvatarPresetOption<T>[], value: unknown): value is T {
  return items.some((item) => item.value === value);
}

export function normalizeAvatarIdentity(value?: Partial<AvatarIdentityConfig> | null): AvatarIdentityConfig {
  const next = { ...DEFAULT_AVATAR_IDENTITY, ...(value || {}) };
  return {
    ...next,
    borderStyle: isValue(AVATAR_BORDER_STYLES, next.borderStyle) ? next.borderStyle : DEFAULT_AVATAR_IDENTITY.borderStyle,
    neonColor: isValue(AVATAR_NEON_COLORS, next.neonColor) ? next.neonColor : DEFAULT_AVATAR_IDENTITY.neonColor,
    backgroundStyle: isValue(AVATAR_BACKGROUNDS, next.backgroundStyle) ? next.backgroundStyle : DEFAULT_AVATAR_IDENTITY.backgroundStyle,
    animationStyle: isValue(AVATAR_ANIMATIONS, next.animationStyle) ? next.animationStyle : DEFAULT_AVATAR_IDENTITY.animationStyle,
    rarity: isValue(AVATAR_RARITIES, next.rarity) ? next.rarity : DEFAULT_AVATAR_IDENTITY.rarity,
    statusEffect: isValue(AVATAR_REALTIME_STATUSES, next.statusEffect) ? next.statusEffect : DEFAULT_AVATAR_IDENTITY.statusEffect,
    glowIntensity: Math.min(100, Math.max(20, Number(next.glowIntensity || DEFAULT_AVATAR_IDENTITY.glowIntensity))),
    aiGenerated: Boolean(next.aiGenerated),
    phrase: String(next.phrase || '').slice(0, 44),
  };
}

export function randomAvatarIdentity(seed = Date.now()): AvatarIdentityConfig {
  const pick = <T extends string>(items: AvatarPresetOption<T>[], offset: number) => items[(seed + offset) % items.length].value;
  return normalizeAvatarIdentity({
    borderStyle: pick(AVATAR_BORDER_STYLES, 1),
    neonColor: pick(AVATAR_NEON_COLORS, 2),
    backgroundStyle: pick(AVATAR_BACKGROUNDS, 3),
    animationStyle: pick(AVATAR_ANIMATIONS, 4),
    rarity: pick(AVATAR_RARITIES, 5),
    statusEffect: pick(AVATAR_REALTIME_STATUSES, 6),
    glowIntensity: 54 + (seed % 42),
    aiGenerated: true,
  });
}
