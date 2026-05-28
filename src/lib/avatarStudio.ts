import {
  DEFAULT_AVATAR_IDENTITY,
  normalizeAvatarIdentity,
  randomAvatarIdentity,
  type AvatarAnimationStyle,
  type AvatarBackgroundStyle,
  type AvatarBorderStyle,
  type AvatarNeonColor,
  type AvatarRarity,
  type AvatarRealtimeStatus,
} from '../features/avatar/avatar-presets';
import { generateAvatarPrompt } from '../services/avatarPromptEngine';

export type AvatarStudioConfig = {
  seed: string;
  concept: string;
  silhouette: string;
  style: string;
  mood: string;
  palette: string;
  outfit: string;
  accessory: string;
  background: string;
  phrase: string;
  details: string;
  borderStyle: AvatarBorderStyle;
  neonColor: AvatarNeonColor;
  backgroundStyle: AvatarBackgroundStyle;
  frameAnimation: AvatarAnimationStyle;
  glowIntensity: number;
  rarity: AvatarRarity;
  statusEffect: AvatarRealtimeStatus;
  aiGenerated: boolean;
};

export type AvatarOption = {
  value: string;
  label: string;
  hint?: string;
};

export const AVATAR_CONCEPTS: AvatarOption[] = [
  { value: 'person', label: 'Persona', hint: 'Retrato humano o asesor premium' },
  { value: 'animal', label: 'Animal', hint: 'Mascota con actitud humana' },
  { value: 'food', label: 'Alimento humanoide', hint: 'Comida convertida en personaje' },
  { value: 'robot', label: 'Robot IA', hint: 'Tecnologico, asistente o androide' },
  { value: 'creature', label: 'Criatura fantastica', hint: 'Guardian, elemental o ser mistico' },
  { value: 'object', label: 'Objeto vivo', hint: 'Cualquier cosa con personalidad' },
];

export const AVATAR_SILHOUETTES: AvatarOption[] = [
  { value: 'humanoid', label: 'Humanoide' },
  { value: 'portrait', label: 'Retrato' },
  { value: 'mascot', label: 'Mascota' },
  { value: 'emblem', label: 'Emblema' },
  { value: 'hero', label: 'Heroe corporativo' },
];

export const AVATAR_STYLES: AvatarOption[] = [
  { value: 'cyber', label: 'Cyber SaaS' },
  { value: 'realistic', label: 'Realista premium' },
  { value: 'anime', label: 'Anime limpio' },
  { value: 'comic', label: 'Comic neon' },
  { value: 'kawaii', label: 'Kawaii' },
  { value: '3d', label: '3D glass' },
  { value: 'pixar_cyber', label: 'Pixar cyber' },
  { value: 'toy_premium', label: 'Toy premium' },
  { value: 'gaming_aaa', label: 'Gaming AAA' },
  { value: 'pixel', label: 'Pixel art' },
  { value: 'executive', label: 'Ejecutivo IA' },
];

export const AVATAR_MOODS: AvatarOption[] = [
  { value: 'friendly', label: 'Amable' },
  { value: 'confident', label: 'Seguro' },
  { value: 'funny', label: 'Divertido' },
  { value: 'mysterious', label: 'Misterioso' },
  { value: 'elegant', label: 'Elegante' },
  { value: 'brave', label: 'Valiente' },
  { value: 'calm', label: 'Sereno' },
  { value: 'visionary', label: 'Visionario' },
];

export const AVATAR_OUTFITS: AvatarOption[] = [
  { value: 'executive_suit', label: 'Traje ejecutivo' },
  { value: 'field_uniform', label: 'Uniforme tecnico' },
  { value: 'neon_hoodie', label: 'Hoodie neon' },
  { value: 'futuristic_armor', label: 'Armadura futurista' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'sportswear', label: 'Ropa deportiva' },
  { value: 'astronaut', label: 'Traje espacial' },
  { value: 'gala', label: 'Atuendo de gala' },
  { value: 'kimono', label: 'Kimono moderno' },
  { value: 'chef', label: 'Chef creativo' },
  { value: 'royal_cape', label: 'Capa premium' },
  { value: 'sales_vest', label: 'Chaleco vendedor' },
];

export const AVATAR_ACCESSORIES: AvatarOption[] = [
  { value: 'none', label: 'Sin accesorio' },
  { value: 'crown', label: 'Corona neon' },
  { value: 'glasses', label: 'Lentes futuristas' },
  { value: 'headset', label: 'Diadema de agente' },
  { value: 'cap', label: 'Gorra urbana' },
  { value: 'halo', label: 'Halo digital' },
  { value: 'wings', label: 'Alas de energia' },
  { value: 'badge', label: 'Insignia HD' },
  { value: 'mask', label: 'Visor tactico' },
  { value: 'tablet', label: 'Tablet de ventas' },
  { value: 'gem', label: 'Gema de rareza' },
];

export const AVATAR_BACKGROUNDS: AvatarOption[] = [
  { value: 'neural', label: 'Red neuronal' },
  { value: 'city', label: 'Ciudad neon' },
  { value: 'sky', label: 'Cielo electrico' },
  { value: 'portal', label: 'Portal IA' },
  { value: 'stars', label: 'Estrellas' },
  { value: 'grid', label: 'Dashboard premium' },
  { value: 'aura', label: 'Aura suave' },
];

export const AVATAR_PALETTES = [
  { value: 'electric_blue', label: 'Azul electrico', colors: ['#000080', '#0077B6', '#00E5FF', '#F8FAFC'] },
  { value: 'orange_neon', label: 'Naranja neon', colors: ['#0B1328', '#C2410C', '#FF8A1F', '#FFF7ED'] },
  { value: 'emerald', label: 'Verde IA', colors: ['#04130D', '#047857', '#34D399', '#ECFDF5'] },
  { value: 'violet', label: 'Morado cyber', colors: ['#140A2E', '#6D28D9', '#C084FC', '#FAF5FF'] },
  { value: 'sun_gold', label: 'Dorado solar', colors: ['#181100', '#B45309', '#FACC15', '#FFF7CC'] },
  { value: 'rose_red', label: 'Rojo neon', colors: ['#1B0710', '#BE123C', '#FB7185', '#FFF1F2'] },
  { value: 'mono_lux', label: 'Blanco ejecutivo', colors: ['#020617', '#1E293B', '#E2E8F0', '#FFFFFF'] },
];

const DEFAULT_CONFIG: AvatarStudioConfig = {
  seed: 'hd-avatar',
  concept: 'person',
  silhouette: 'humanoid',
  style: 'cyber',
  mood: 'confident',
  palette: 'electric_blue',
  outfit: 'executive_suit',
  accessory: 'crown',
  background: 'neural',
  phrase: '',
  details: '',
  borderStyle: DEFAULT_AVATAR_IDENTITY.borderStyle,
  neonColor: DEFAULT_AVATAR_IDENTITY.neonColor,
  backgroundStyle: DEFAULT_AVATAR_IDENTITY.backgroundStyle,
  frameAnimation: DEFAULT_AVATAR_IDENTITY.animationStyle,
  glowIntensity: DEFAULT_AVATAR_IDENTITY.glowIntensity,
  rarity: DEFAULT_AVATAR_IDENTITY.rarity,
  statusEffect: DEFAULT_AVATAR_IDENTITY.statusEffect,
  aiGenerated: DEFAULT_AVATAR_IDENTITY.aiGenerated,
};

function optionLabel(options: AvatarOption[], value: string) {
  return options.find((option) => option.value === value)?.label || value;
}

function paletteFor(value: string) {
  return AVATAR_PALETTES.find((palette) => palette.value === value) || AVATAR_PALETTES[0];
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function pick<T>(items: T[], seed: number, offset = 0) {
  return items[(seed + offset) % items.length];
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'HD';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function wrapPhrase(value: string) {
  const clean = value.trim().replace(/\s+/g, ' ').slice(0, 44);
  if (!clean) return ['', ''];
  if (clean.length <= 22) return [clean, ''];
  const splitAt = clean.lastIndexOf(' ', 22);
  const index = splitAt > 8 ? splitAt : 22;
  return [clean.slice(0, index).trim(), clean.slice(index).trim()];
}

export function avatarConfigStorageKey(uid: string) {
  return `hd_avatar_config_${uid}`;
}

export function defaultAvatarConfig(name = 'Usuario', role = 'ASESOR', phrase = ''): AvatarStudioConfig {
  const seed = `${name}-${role}-${Date.now().toString(36)}`;
  return {
    ...DEFAULT_CONFIG,
    seed,
    phrase: phrase.slice(0, 44),
  };
}

export function normalizeAvatarConfig(value: Partial<AvatarStudioConfig> | null | undefined, name = 'Usuario', role = 'ASESOR', phrase = ''): AvatarStudioConfig {
  const base = defaultAvatarConfig(name, role, phrase);
  const identity = normalizeAvatarIdentity({
    borderStyle: value?.borderStyle || base.borderStyle,
    neonColor: value?.neonColor || base.neonColor,
    backgroundStyle: value?.backgroundStyle || base.backgroundStyle,
    animationStyle: value?.frameAnimation || base.frameAnimation,
    glowIntensity: value?.glowIntensity || base.glowIntensity,
    rarity: value?.rarity || base.rarity,
    statusEffect: value?.statusEffect || base.statusEffect,
    aiGenerated: value?.aiGenerated ?? base.aiGenerated,
    phrase: value?.phrase || phrase,
  });
  return {
    ...base,
    ...(value || {}),
    seed: String(value?.seed || base.seed),
    phrase: String(value?.phrase || phrase || '').slice(0, 44),
    details: String(value?.details || '').slice(0, 240),
    borderStyle: identity.borderStyle,
    neonColor: identity.neonColor,
    backgroundStyle: identity.backgroundStyle,
    frameAnimation: identity.animationStyle,
    glowIntensity: identity.glowIntensity,
    rarity: identity.rarity,
    statusEffect: identity.statusEffect,
    aiGenerated: identity.aiGenerated,
  };
}

export function loadAvatarConfig(uid: string | undefined, name = 'Usuario', role = 'ASESOR', phrase = '') {
  if (!uid || typeof localStorage === 'undefined') return defaultAvatarConfig(name, role, phrase);
  try {
    const raw = localStorage.getItem(avatarConfigStorageKey(uid));
    if (!raw) return defaultAvatarConfig(name, role, phrase);
    return normalizeAvatarConfig(JSON.parse(raw), name, role, phrase);
  } catch {
    return defaultAvatarConfig(name, role, phrase);
  }
}

export function saveAvatarConfig(uid: string | undefined, config: AvatarStudioConfig) {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(avatarConfigStorageKey(uid), JSON.stringify(config));
  } catch {
    // Storage quota is non-critical; the avatar image can still be used in-memory.
  }
}

export function randomAvatarConfig(name = 'Usuario', role = 'ASESOR', phrase = ''): AvatarStudioConfig {
  const seed = hashString(`${name}-${role}-${phrase}-${Date.now()}-${Math.random()}`);
  const identity = randomAvatarIdentity(seed);
  return {
    seed: `hd-${seed.toString(36)}`,
    concept: pick(AVATAR_CONCEPTS, seed, 1).value,
    silhouette: pick(AVATAR_SILHOUETTES, seed, 2).value,
    style: pick(AVATAR_STYLES, seed, 3).value,
    mood: pick(AVATAR_MOODS, seed, 4).value,
    palette: pick(AVATAR_PALETTES, seed, 5).value,
    outfit: pick(AVATAR_OUTFITS, seed, 6).value,
    accessory: pick(AVATAR_ACCESSORIES, seed, 7).value,
    background: pick(AVATAR_BACKGROUNDS, seed, 8).value,
    phrase: phrase.slice(0, 44),
    details: '',
    borderStyle: identity.borderStyle,
    neonColor: identity.neonColor,
    backgroundStyle: identity.backgroundStyle,
    frameAnimation: identity.animationStyle,
    glowIntensity: identity.glowIntensity,
    rarity: identity.rarity,
    statusEffect: identity.statusEffect,
    aiGenerated: identity.aiGenerated,
  };
}

export function buildAvatarPrompt(config: AvatarStudioConfig, name = 'Usuario', role = 'ASESOR') {
  const concept = optionLabel(AVATAR_CONCEPTS, config.concept);
  const silhouette = optionLabel(AVATAR_SILHOUETTES, config.silhouette);
  const style = optionLabel(AVATAR_STYLES, config.style);
  const mood = optionLabel(AVATAR_MOODS, config.mood);
  const outfit = optionLabel(AVATAR_OUTFITS, config.outfit);
  const accessory = optionLabel(AVATAR_ACCESSORIES, config.accessory);
  const background = optionLabel(AVATAR_BACKGROUNDS, config.background);
  const palette = paletteFor(config.palette).label;
  const identity = `borde ${config.borderStyle}, glow ${config.neonColor}, fondo ${config.backgroundStyle}, animacion ${config.frameAnimation}, rareza ${config.rarity}`;

  return generateAvatarPrompt({
    name,
    role,
    concept,
    silhouette,
    style,
    mood,
    outfit,
    accessory,
    background,
    palette,
    rarity: config.rarity,
    identity,
    phrase: config.phrase,
    details: config.details,
  });
}

export function generateAvatarDataUrl(config: AvatarStudioConfig, name = 'Usuario', role = 'ASESOR') {
  const normalized = normalizeAvatarConfig(config, name, role, config.phrase);
  const seed = hashString(JSON.stringify(normalized));
  const palette = paletteFor(normalized.palette);
  const [dark, mid, accent, light] = palette.colors;
  const initials = initialsFromName(name);
  const [phraseOne, phraseTwo] = wrapPhrase(normalized.phrase);
  const faceColor = normalized.concept === 'robot' ? '#B8E7FF' : normalized.concept === 'food' ? pick(['#FACC15', '#FB923C', '#A7F3D0', '#F9A8D4'], seed, 5) : '#F3D7BF';
  const cheek = normalized.mood === 'funny' || normalized.mood === 'friendly' ? `<circle cx="205" cy="230" r="8" fill="#FB7185" opacity=".45"/><circle cx="307" cy="230" r="8" fill="#FB7185" opacity=".45"/>` : '';
  const smile = normalized.mood === 'mysterious'
    ? '<path d="M232 258 C254 246 278 246 300 258" fill="none" stroke="#0B1220" stroke-width="7" stroke-linecap="round" opacity=".72"/>'
    : '<path d="M230 253 C247 276 282 276 300 253" fill="none" stroke="#0B1220" stroke-width="7" stroke-linecap="round"/>';
  const eyeShape = normalized.concept === 'robot'
    ? '<rect x="200" y="214" width="34" height="18" rx="9" fill="#061322"/><rect x="278" y="214" width="34" height="18" rx="9" fill="#061322"/>'
    : '<circle cx="216" cy="222" r="9" fill="#061322"/><circle cx="296" cy="222" r="9" fill="#061322"/>';

  const bgPattern = {
    neural: `<path d="M74 128 C168 38 284 84 414 44" stroke="${accent}" stroke-width="3" opacity=".38" fill="none"/><path d="M62 384 C164 310 266 390 446 300" stroke="${accent}" stroke-width="2" opacity=".3" fill="none"/><g fill="${light}" opacity=".48"><circle cx="74" cy="128" r="4"/><circle cx="184" cy="78" r="3"/><circle cx="414" cy="44" r="4"/><circle cx="446" cy="300" r="4"/></g>`,
    city: `<path d="M34 366 H478" stroke="${accent}" opacity=".28"/><g fill="${mid}" opacity=".38"><rect x="70" y="250" width="44" height="116" rx="8"/><rect x="134" y="205" width="56" height="161" rx="9"/><rect x="332" y="232" width="50" height="134" rx="8"/><rect x="400" y="190" width="40" height="176" rx="8"/></g>`,
    sky: `<circle cx="120" cy="115" r="80" fill="${accent}" opacity=".18"/><path d="M32 340 C150 260 250 360 480 250" stroke="${light}" stroke-width="3" opacity=".22" fill="none"/>`,
    portal: `<circle cx="256" cy="256" r="190" fill="none" stroke="${accent}" stroke-width="8" opacity=".22"/><circle cx="256" cy="256" r="150" fill="none" stroke="${light}" stroke-width="2" opacity=".3"/>`,
    stars: `<g fill="${light}" opacity=".42"><circle cx="84" cy="88" r="3"/><circle cx="430" cy="122" r="2"/><circle cx="396" cy="384" r="3"/><circle cx="114" cy="350" r="2"/><circle cx="254" cy="60" r="2"/></g>`,
    grid: `<path d="M42 128 H470M42 206 H470M42 284 H470M42 362 H470M128 42 V470M206 42 V470M284 42 V470M362 42 V470" stroke="${accent}" stroke-width="1" opacity=".16"/>`,
    aura: `<circle cx="256" cy="228" r="168" fill="${accent}" opacity=".15"/><circle cx="256" cy="228" r="118" fill="${light}" opacity=".08"/>`,
  }[normalized.background] || '';

  const ears = normalized.concept === 'animal'
    ? `<path d="M166 176 L182 102 L222 166 Z" fill="${faceColor}" stroke="${accent}" stroke-width="5"/><path d="M346 176 L330 102 L290 166 Z" fill="${faceColor}" stroke="${accent}" stroke-width="5"/>`
    : '';
  const foodTop = normalized.concept === 'food'
    ? `<path d="M258 142 C246 112 270 92 304 88 C298 122 286 142 258 142 Z" fill="#34D399"/><path d="M246 142 C234 114 214 100 184 104 C194 132 214 150 246 142 Z" fill="#84CC16"/>`
    : '';
  const robotBits = normalized.concept === 'robot'
    ? `<path d="M256 142 V104" stroke="${accent}" stroke-width="8" stroke-linecap="round"/><circle cx="256" cy="94" r="12" fill="${accent}"/><rect x="172" y="150" width="168" height="142" rx="36" fill="${faceColor}" stroke="${accent}" stroke-width="6"/>`
    : '';
  const creatureBits = normalized.concept === 'creature'
    ? `<path d="M184 156 C150 118 164 82 198 102" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/><path d="M328 156 C362 118 348 82 314 102" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>`
    : '';
  const objectBits = normalized.concept === 'object'
    ? `<path d="M256 132 L352 216 L312 320 H200 L160 216 Z" fill="${mid}" stroke="${accent}" stroke-width="7"/>`
    : '';
  const head = normalized.concept === 'robot'
    ? robotBits
    : normalized.concept === 'object'
      ? objectBits
      : `${ears}${creatureBits}${foodTop}<circle cx="256" cy="220" r="88" fill="${faceColor}" stroke="${accent}" stroke-width="7"/>`;

  const bodyBase = normalized.silhouette === 'emblem'
    ? `<circle cx="256" cy="326" r="78" fill="${dark}" stroke="${accent}" stroke-width="6" opacity=".95"/>`
    : `<path d="M150 430 C160 344 196 306 256 306 C316 306 352 344 362 430 Z" fill="${mid}" stroke="${accent}" stroke-width="6"/>`;

  const outfit = {
    executive_suit: `<path d="M188 430 L226 316 L256 356 L286 316 L324 430 Z" fill="#07111F" opacity=".86"/><path d="M246 354 H266 L276 430 H236 Z" fill="${accent}"/>`,
    field_uniform: `<path d="M164 430 C178 348 206 316 256 316 C306 316 334 348 348 430 Z" fill="${mid}"/><path d="M182 368 H330" stroke="${light}" stroke-width="8" opacity=".48"/><rect x="220" y="348" width="72" height="28" rx="8" fill="${dark}" opacity=".55"/>`,
    neon_hoodie: `<path d="M166 430 C172 338 206 302 256 302 C306 302 340 338 346 430 Z" fill="${dark}"/><path d="M198 332 C226 298 286 298 314 332" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>`,
    futuristic_armor: `<path d="M154 430 L190 328 H322 L358 430 Z" fill="${dark}"/><path d="M190 350 H322M176 386 H336" stroke="${accent}" stroke-width="7" opacity=".65"/><path d="M256 326 L286 386 L256 430 L226 386 Z" fill="${accent}" opacity=".38"/>`,
    streetwear: `<path d="M158 430 C174 348 202 316 256 316 C310 316 338 348 354 430 Z" fill="${mid}"/><path d="M216 342 L256 390 L296 342" stroke="${light}" stroke-width="7" opacity=".7"/>`,
    sportswear: `<path d="M164 430 C176 346 210 316 256 316 C302 316 336 346 348 430 Z" fill="${accent}" opacity=".78"/><text x="256" y="392" fill="${dark}" font-size="38" font-family="Arial" font-weight="900" text-anchor="middle">HD</text>`,
    astronaut: `<path d="M150 430 C158 336 204 296 256 296 C308 296 354 336 362 430 Z" fill="${light}" opacity=".92"/><circle cx="256" cy="218" r="104" fill="none" stroke="${light}" stroke-width="14" opacity=".72"/>`,
    gala: `<path d="M172 430 L230 320 H282 L340 430 Z" fill="${dark}"/><path d="M226 326 C244 350 268 350 286 326" fill="none" stroke="${accent}" stroke-width="8"/>`,
    kimono: `<path d="M154 430 L214 318 L256 358 L298 318 L358 430 Z" fill="${mid}"/><path d="M214 318 L304 430M298 318 L208 430" stroke="${light}" stroke-width="7" opacity=".55"/>`,
    chef: `<path d="M164 430 C176 346 210 316 256 316 C302 316 336 346 348 430 Z" fill="#F8FAFC" opacity=".9"/><path d="M216 340 H296" stroke="${accent}" stroke-width="7"/><circle cx="210" cy="137" r="22" fill="#F8FAFC"/><circle cx="256" cy="122" r="28" fill="#F8FAFC"/><circle cx="302" cy="137" r="22" fill="#F8FAFC"/>`,
  }[normalized.outfit] || '';

  const accessory = {
    crown: `<path d="M196 144 L218 102 L256 138 L294 102 L316 144 L306 166 H206 Z" fill="${accent}" stroke="${light}" stroke-width="5"/>`,
    glasses: `<path d="M188 220 H236 M276 220 H324 M236 220 H276" stroke="${dark}" stroke-width="8" stroke-linecap="round"/><rect x="190" y="198" width="52" height="42" rx="18" fill="none" stroke="${dark}" stroke-width="7"/><rect x="270" y="198" width="52" height="42" rx="18" fill="none" stroke="${dark}" stroke-width="7"/>`,
    headset: `<path d="M172 218 C172 150 340 150 340 218" fill="none" stroke="${dark}" stroke-width="12"/><rect x="156" y="204" width="28" height="54" rx="12" fill="${dark}"/><rect x="328" y="204" width="28" height="54" rx="12" fill="${dark}"/><path d="M340 250 C328 278 300 286 274 286" stroke="${dark}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
    cap: `<path d="M176 180 C206 132 306 132 336 180 C294 162 218 162 176 180 Z" fill="${accent}"/><path d="M326 178 C360 176 384 186 396 202 C366 202 340 196 318 184 Z" fill="${accent}" opacity=".8"/>`,
    halo: `<ellipse cx="256" cy="132" rx="78" ry="20" fill="none" stroke="${accent}" stroke-width="8" opacity=".75"/>`,
    wings: `<path d="M160 302 C82 286 72 218 148 184 C126 240 160 270 220 292 Z" fill="${accent}" opacity=".32"/><path d="M352 302 C430 286 440 218 364 184 C386 240 352 270 292 292 Z" fill="${accent}" opacity=".32"/>`,
    badge: `<path d="M318 338 L352 352 L348 392 L318 414 L288 392 L284 352 Z" fill="${accent}" opacity=".85"/><text x="318" y="385" fill="${dark}" font-size="24" font-family="Arial" font-weight="900" text-anchor="middle">HD</text>`,
    mask: `<path d="M184 204 H328 C322 252 292 276 256 276 C220 276 190 252 184 204 Z" fill="${dark}" opacity=".82"/><path d="M206 226 H238M274 226 H306" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>`,
    tablet: `<rect x="314" y="322" width="72" height="92" rx="16" fill="${dark}" stroke="${accent}" stroke-width="6"/><path d="M334 350 H366M334 374 H366M334 398 H358" stroke="${light}" stroke-width="5" stroke-linecap="round" opacity=".72"/>`,
    gem: `<path d="M256 88 L300 126 L282 178 H230 L212 126 Z" fill="${accent}" stroke="${light}" stroke-width="5" opacity=".9"/>`,
    none: '',
  }[normalized.accessory] || '';

  const phraseSvg = phraseOne
    ? `<g font-family="Arial, sans-serif" text-anchor="middle" font-weight="900"><text x="256" y="462" fill="${light}" font-size="${phraseTwo ? 19 : 23}" opacity=".96">${escapeXml(phraseOne)}</text>${phraseTwo ? `<text x="256" y="486" fill="${light}" font-size="17" opacity=".8">${escapeXml(phraseTwo)}</text>` : ''}</g>`
    : '';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="70%" cy="18%" r="80%">
      <stop offset="0%" stop-color="${accent}" stop-opacity=".9"/>
      <stop offset="48%" stop-color="${mid}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </radialGradient>
    <filter id="glow" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="avatarClip"><circle cx="256" cy="256" r="238"/></clipPath>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g clip-path="url(#avatarClip)">
    <circle cx="86" cy="90" r="120" fill="${light}" opacity=".07"/>
    <circle cx="422" cy="396" r="150" fill="${accent}" opacity=".09"/>
    ${bgPattern}
    <circle cx="256" cy="256" r="214" fill="none" stroke="${light}" stroke-opacity=".14" stroke-width="2"/>
    <g filter="url(#glow)" opacity=".84"><circle cx="256" cy="250" r="142" fill="${accent}" opacity=".12"/></g>
    ${bodyBase}
    ${outfit}
    ${head}
    ${normalized.concept !== 'object' ? `${eyeShape}${cheek}${smile}` : ''}
    ${accessory}
    <text x="256" y="${normalized.silhouette === 'emblem' ? 350 : 414}" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="${light}" opacity=".95">${escapeXml(initials)}</text>
    <text x="256" y="64" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="${light}" opacity=".72">${escapeXml(String(role).toUpperCase())}</text>
    ${phraseSvg}
  </g>
  <circle cx="256" cy="256" r="238" fill="none" stroke="${accent}" stroke-width="10" opacity=".72"/>
  <circle cx="256" cy="256" r="248" fill="none" stroke="${light}" stroke-width="2" opacity=".2"/>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
