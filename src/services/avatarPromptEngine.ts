import type { AvatarRarity } from '../features/avatar/avatar-presets';

export type AvatarPromptInput = {
  name: string;
  role: string;
  concept: string;
  silhouette: string;
  style: string;
  mood: string;
  outfit: string;
  accessory: string;
  background: string;
  palette: string;
  rarity: AvatarRarity;
  identity: string;
  phrase?: string;
  details?: string;
};

export const AVATARIA_MASTER_PROMPT = [
  'Create a premium 3D clay character avatar.',
  'Ultra clean corporate mascot style.',
  'Rounded shapes.',
  'Soft matte materials.',
  'Friendly facial expression.',
  'Pixar quality.',
  'Modern SaaS branding.',
  'Studio lighting.',
  'Centered composition.',
  'Highly detailed.',
  '4k render.',
  'Transparent background.',
  'Professional corporate clothing.',
  'Smooth clay texture.',
  'Cute but professional.',
].join(' ');

export const AVATARIA_BUSINESS_PROMPT = [
  'Create a professional business avatar in premium 3D clay style.',
  'Corporate executive.',
  'Friendly smile.',
  'Suit and tie.',
  'Rounded geometry.',
  'Soft shadows.',
  'Minimalist design.',
  'Pixar inspired.',
  'Modern SaaS branding.',
  'Transparent background.',
  'Ultra detailed.',
  '4k render.',
].join(' ');

export const AVATARIA_MASCOT_PROMPT = [
  'Create a cute corporate mascot in premium clay 3D style.',
  'Friendly expression.',
  'Rounded proportions.',
  'Bright colors.',
  'Studio lighting.',
  'Transparent background.',
  'Pixar quality.',
  'Professional branding mascot.',
  'Highly detailed.',
  'Sticker ready.',
  '4k render.',
].join(' ');

const RARITY_EFFECTS: Record<AvatarRarity, string> = {
  common: 'acabado limpio, luz suave, borde discreto, calidad premium sobria',
  rare: 'aura azul, rim light visible, particulas sutiles, acabado coleccionable',
  epic: 'bloom morado, energia holografica, materiales brillantes y profundidad cinematografica',
  legendary: 'aura dorada, detalles metalicos, particulas orbitando y presencia heroica',
  mythic: 'energia plasma, glow dinamico, atmosfera poderosa y acabado de personaje unico',
  ai_elite: 'nucleo IA, reflejos cyan, neural halo, sensacion de avatar enterprise de alto nivel',
};

const LIGHTING_BY_RARITY: Record<AvatarRarity, string> = {
  common: 'softbox frontal, sombra suave, contraste claro',
  rare: 'rim light cyan, luz volumetrica azul, reflejo bajo controlado',
  epic: 'key light violeta, glow lateral, reflejos de cristal',
  legendary: 'luz dorada superior, bloom cinematografico, aura elegante',
  mythic: 'contraluz rojo-magenta, energia radial, haze sutil',
  ai_elite: 'iluminacion holografica cyan, halo neural, brillos tipo sistema operativo IA',
};

const BACKGROUND_DIRECTIVES: Record<string, string> = {
  neural: 'fondo de red neuronal azul oscuro con nodos finos y conexiones elegantes',
  city: 'ciudad futurista desenfocada con luces corporativas',
  sky: 'cielo electrico abstracto con luz limpia y gradiente premium',
  portal: 'portal IA circular con profundidad, energia y halo suave',
  stars: 'espacio azul oscuro con micro estrellas y atmosfera premium',
  grid: 'dashboard futurista con grid sutil y paneles holograficos',
  aura: 'aura suave radial con fondo profundo y minimalista',
};

export function generateRarityEffects(rarity: AvatarRarity) {
  return RARITY_EFFECTS[rarity] || RARITY_EFFECTS.rare;
}

export function generateLighting(rarity: AvatarRarity) {
  return LIGHTING_BY_RARITY[rarity] || LIGHTING_BY_RARITY.rare;
}

export function generateBackground(background: string) {
  return BACKGROUND_DIRECTIVES[background] || BACKGROUND_DIRECTIVES.neural;
}

export function generateAvatarPrompt(input: AvatarPromptInput) {
  const phrase = input.phrase?.trim()
    ? `Frase visible corta: "${input.phrase.trim()}".`
    : 'Sin texto visible dentro del avatar.';
  const details = input.details?.trim()
    ? `Personalizacion solicitada: ${input.details.trim()}.`
    : 'Sin detalles extra del usuario.';

  return [
    'AvatarIA Studio: Convierte cualquier foto o idea en una identidad visual 3D profesional en segundos.',
    AVATARIA_MASTER_PROMPT,
    `Crea un avatar 3D premium para ${input.name}, rol ${input.role}.`,
    `Tipo: ${input.concept}; silueta: ${input.silhouette}; estilo: ${input.style}; personalidad: ${input.mood}.`,
    `Atuendo: ${input.outfit}; accesorio principal: ${input.accessory}; paleta: ${input.palette}.`,
    `Rareza: ${input.rarity}. Efectos de rareza: ${generateRarityEffects(input.rarity)}.`,
    `Iluminacion: ${generateLighting(input.rarity)}.`,
    `Fondo: ${generateBackground(input.background)}.`,
    `Identidad visual: ${input.identity}.`,
    phrase,
    details,
    'Entregables comerciales: avatar principal, icono, sticker, banner y PNG transparente. Mantener consistencia de equipo, iluminacion de estudio, branding corporativo y lectura clara en tamano pequeno. Sin texto ilegible, sin marcas externas, render limpio en alta calidad.',
  ].filter(Boolean).join(' ');
}
