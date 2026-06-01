import React, { useEffect, useMemo, useState } from 'react';
import { Bot, BriefcaseBusiness, Building2, Camera, Copy, Crown, Dices, Download, Gem, ImagePlus, Layers3, Palette, PawPrint, Pizza, Rocket, Save, Shield, Shuffle, Sparkles, Trophy, Upload, UserRound, Users, Wand2 } from 'lucide-react';
import {
  AVATAR_ACCESSORIES,
  AVATAR_BACKGROUNDS,
  AVATAR_CONCEPTS,
  AVATAR_MOODS,
  AVATAR_OUTFITS,
  AVATAR_PALETTES,
  AVATAR_SILHOUETTES,
  AVATAR_STYLES,
  type AvatarOption,
  type AvatarStudioConfig,
  buildAvatarPrompt,
  defaultAvatarConfig,
  generateAvatarDataUrl,
  loadAvatarConfig,
  randomAvatarConfig,
  saveAvatarConfig,
} from '../../lib/avatarStudio';
import { cn } from '../../lib/utils';
import {
  normalizeAvatarIdentity,
  type AvatarIdentityConfig,
} from '../../features/avatar/avatar-presets';
import { upsertAvatarIdentity } from '../../features/avatar/avatar-api';
import { AvatarEditor } from './avatar-editor';
import { AvatarPreview } from './avatar-preview';

interface AvatarStudioProps {
  uid?: string;
  name: string;
  role?: string;
  currentAvatar?: string | null;
  phrase?: string;
  compact?: boolean;
  className?: string;
  onAvatarChange: (url: string) => void;
  onPhraseChange?: (phrase: string) => void;
  onUploadClick?: () => void;
}

type ConfigKey = keyof Pick<
  AvatarStudioConfig,
  'concept' | 'silhouette' | 'style' | 'mood' | 'palette' | 'outfit' | 'accessory' | 'background'
>;

interface SelectControlProps {
  key?: React.Key;
  label: string;
  value: string;
  options: AvatarOption[];
  onChange: (value: string) => void;
}

function SelectControl({ label, value, options, onChange }: SelectControlProps) {
  return (
    <label className="space-y-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/90">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-cyan-300/25 bg-slate-950/70 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-cyan-200/70 focus:shadow-[0_0_22px_rgba(34,211,238,0.25)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-950 text-white">
            {option.label}
          </option>
        ))}
      </select>
      {options.find((option) => option.value === value)?.hint && (
        <span className="block text-[10px] font-semibold normal-case tracking-normal text-white/55">
          {options.find((option) => option.value === value)?.hint}
        </span>
      )}
    </label>
  );
}

const SELECT_GROUPS: Array<{ key: ConfigKey; label: string; options: AvatarOption[] }> = [
  { key: 'concept', label: 'Concepto', options: AVATAR_CONCEPTS },
  { key: 'silhouette', label: 'Forma', options: AVATAR_SILHOUETTES },
  { key: 'style', label: 'Estilo IA', options: AVATAR_STYLES },
  { key: 'mood', label: 'Actitud', options: AVATAR_MOODS },
  { key: 'palette', label: 'Paleta', options: AVATAR_PALETTES },
  { key: 'outfit', label: 'Ropa / Atuendo', options: AVATAR_OUTFITS },
  { key: 'accessory', label: 'Accesorio', options: AVATAR_ACCESSORIES },
  { key: 'background', label: 'Fondo', options: AVATAR_BACKGROUNDS },
];

const PHOTO_ANALYSIS_ITEMS = [
  'Rostro',
  'Cabello',
  'Barba / bigote',
  'Edad aprox.',
  'Genero visual',
  'Accesorios',
];

const MASCOT_EXAMPLES = [
  { label: 'Hamburguesa', concept: 'burger', details: 'hamburguesa sonriente estilo clay 3D corporativo, sticker ready' },
  { label: 'Robot', concept: 'robot', details: 'robot amable para soporte tecnico, icono SaaS, sonrisa cercana' },
  { label: 'Telefono', concept: 'phone', details: 'telefono con cara amable, brillo cyan, listo para app icon' },
  { label: 'Computadora', concept: 'computer', details: 'computadora corporativa con sonrisa, ideal para software y CRM' },
  { label: 'Casa', concept: 'house', details: 'casa sonriente para inmobiliaria, clay 3D, confianza familiar' },
  { label: 'Automovil', concept: 'car', details: 'automovil corporativo con expresion amable, estilo sticker premium' },
  { label: 'Perro', concept: 'dog', details: 'perro mascota corporativa, amigable, redondeado y profesional' },
  { label: 'Gato', concept: 'cat', details: 'gato elegante estilo clay 3D, branding premium y mirada amable' },
];

const PROFESSIONAL_DETAILS = [
  'peinado ejecutivo limpio',
  'cabello color castano oscuro',
  'barba corta profesional',
  'bigote sutil',
  'ojos expresivos y amables',
  'sonrisa confiable',
  'ropa ejecutiva premium',
  'corbata corporativa',
  'uniforme de empresa',
  'fondo transparente',
  'color corporativo cyan',
];

const BUSINESS_TEMPLATES = [
  { label: 'Reclutador', outfit: 'recruiter_blazer', accessory: 'badge', details: 'reclutador profesional, sonrisa amable, blazer, confianza y cercania' },
  { label: 'Ejecutivo', outfit: 'executive_suit', accessory: 'glasses', details: 'ejecutivo corporativo premium, traje y corbata, liderazgo sereno' },
  { label: 'Gerente', outfit: 'manager_uniform', accessory: 'badge', details: 'gerente operativo, presencia firme, uniforme corporativo y liderazgo' },
  { label: 'Supervisor', outfit: 'field_uniform', accessory: 'tablet', details: 'supervisor de campo, uniforme tecnico, tablet y actitud resolutiva' },
  { label: 'Vendedor', outfit: 'sales_vest', accessory: 'headset', details: 'vendedor comercial, energia positiva, enfoque CRM y cierre de ventas' },
  { label: 'Soporte Tecnico', outfit: 'support_polo', accessory: 'headset', details: 'soporte tecnico amable, polo corporativo, auricular y confianza' },
  { label: 'Atencion a Clientes', outfit: 'customer_service', accessory: 'headset', details: 'atencion a clientes, sonrisa profesional, auricular y trato humano' },
];

const ENTERPRISE_FEATURES = [
  'Avatares masivos',
  'API',
  'Branding corporativo',
  'Equipos ilimitados',
  'Exportacion HD',
  'PNG transparente',
  'Organigramas automaticos',
];

export default function AvatarStudio({
  uid,
  name,
  role = 'ASESOR',
  currentAvatar,
  phrase = '',
  compact = false,
  className,
  onAvatarChange,
  onPhraseChange,
  onUploadClick,
}: AvatarStudioProps) {
  const [config, setConfig] = useState<AvatarStudioConfig>(() => (
    uid ? loadAvatarConfig(uid, name, role, phrase) : defaultAvatarConfig(name, role, phrase)
  ));
  const [activeTab, setActiveTab] = useState<'photo' | 'mascot' | 'appearance' | 'style' | 'identity' | 'business' | 'team' | 'collection'>('photo');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(uid ? loadAvatarConfig(uid, name, role, phrase) : defaultAvatarConfig(name, role, phrase));
  }, [uid, name, role]);

  useEffect(() => {
    setConfig((current) => (
      current.phrase === phrase.slice(0, 44)
        ? current
        : { ...current, phrase: phrase.slice(0, 44) }
    ));
  }, [phrase]);

  const previewUrl = useMemo(() => generateAvatarDataUrl(config, name, role), [config, name, role]);
  const prompt = useMemo(() => buildAvatarPrompt(config, name, role), [config, name, role]);
  const variations = useMemo(() => (
    [0, 1, 2, 3].map((index) => {
      const moodIndex = Math.max(0, AVATAR_MOODS.findIndex((item) => item.value === config.mood));
      const backgroundIndex = Math.max(0, AVATAR_BACKGROUNDS.findIndex((item) => item.value === config.background));
      const variant = {
        ...config,
        seed: `${config.seed}-v${index}`,
        mood: AVATAR_MOODS[(moodIndex + index) % AVATAR_MOODS.length].value,
        background: AVATAR_BACKGROUNDS[(backgroundIndex + index) % AVATAR_BACKGROUNDS.length].value,
        glowIntensity: Math.min(100, Math.max(35, config.glowIntensity + (index - 1) * 8)),
      };
      return {
        id: `variation-${index + 1}`,
        label: `V${index + 1}`,
        config: variant,
        url: generateAvatarDataUrl(variant, name, role),
      };
    })
  ), [config, name, role]);
  const identity = useMemo(() => normalizeAvatarIdentity({
    userId: uid,
    avatarUrl: previewUrl,
    borderStyle: config.borderStyle,
    neonColor: config.neonColor,
    backgroundStyle: config.backgroundStyle,
    animationStyle: config.frameAnimation,
    glowIntensity: config.glowIntensity,
    rarity: config.rarity,
    statusEffect: config.statusEffect,
    aiGenerated: config.aiGenerated,
    phrase: config.phrase,
  }), [config, previewUrl, uid]);

  const collection = useMemo(() => {
    const base = normalizeAvatarIdentity(identity);
    return [
      {
        id: 'equipped',
        name: 'Avatar equipado',
        hint: 'Tu identidad actual',
        config,
        rarity: config.rarity,
        icon: Trophy,
      },
      {
        id: 'executive-bot',
        name: 'Executive Bot',
        hint: 'Robot gerente con aura cyan',
        rarity: 'rare',
        icon: Bot,
        config: {
          ...config,
          concept: 'robot',
          style: 'executive',
          outfit: 'executive_suit',
          accessory: 'badge',
          neonColor: 'cyan_neon',
          rarity: 'rare',
          borderStyle: 'neural',
          background: 'grid',
        },
      },
      {
        id: 'neon-mascot',
        name: 'Mascota Legendaria',
        hint: 'Animal humanoide con energia dorada',
        rarity: 'legendary',
        icon: PawPrint,
        config: {
          ...config,
          concept: 'animal',
          silhouette: 'mascot',
          style: 'toy_premium',
          mood: 'friendly',
          outfit: 'royal_cape',
          accessory: 'crown',
          neonColor: 'premium_gold',
          rarity: 'legendary',
          background: 'aura',
        },
      },
      {
        id: 'food-hero',
        name: 'Food Hero IA',
        hint: 'Alimento humanoide estilo gaming',
        rarity: 'epic',
        icon: Pizza,
        config: {
          ...config,
          concept: 'food',
          style: 'gaming_aaa',
          outfit: 'sales_vest',
          accessory: 'tablet',
          neonColor: 'plasma_red',
          rarity: 'epic',
          background: 'portal',
        },
      },
      {
        id: 'ai-elite',
        name: 'AI Elite',
        hint: 'Operador holografico mitico',
        rarity: 'ai_elite',
        icon: Gem,
        config: {
          ...config,
          concept: 'person',
          silhouette: 'hero',
          style: 'pixar_cyber',
          mood: 'visionary',
          outfit: 'futuristic_armor',
          accessory: 'gem',
          neonColor: 'matrix_green',
          rarity: 'ai_elite',
          borderStyle: 'energy',
          background: 'neural',
          glowIntensity: Math.max(base.glowIntensity, 88),
        },
      },
    ] as Array<{
      id: string;
      name: string;
      hint: string;
      rarity: string;
      icon: typeof Trophy;
      config: AvatarStudioConfig;
    }>;
  }, [config, identity]);

  const updateConfig = (patch: Partial<AvatarStudioConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const appendDetail = (detail: string) => {
    setConfig((current) => {
      const parts = current.details
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (!parts.includes(detail)) parts.push(detail);
      return { ...current, details: parts.join(', ').slice(0, 240) };
    });
    setSaved(false);
  };

  const updateIdentity = (patch: Partial<AvatarIdentityConfig>) => {
    const next: Partial<AvatarStudioConfig> = {};
    if (patch.borderStyle) next.borderStyle = patch.borderStyle;
    if (patch.neonColor) next.neonColor = patch.neonColor;
    if (patch.backgroundStyle) next.backgroundStyle = patch.backgroundStyle;
    if (patch.animationStyle) next.frameAnimation = patch.animationStyle;
    if (patch.glowIntensity !== undefined) next.glowIntensity = patch.glowIntensity;
    if (patch.rarity) next.rarity = patch.rarity;
    if (patch.statusEffect) next.statusEffect = patch.statusEffect;
    if (patch.aiGenerated !== undefined) next.aiGenerated = patch.aiGenerated;
    updateConfig(next);
  };

  const handleRandom = () => {
    setConfig(randomAvatarConfig(name, role, config.phrase));
    setSaved(false);
  };

  const equipPreset = (preset: AvatarStudioConfig) => {
    setConfig({
      ...preset,
      phrase: config.phrase,
      details: config.details,
      seed: `${preset.seed}-${Date.now().toString(36)}`,
    });
    setSaved(false);
  };

  const equipBusinessTemplate = (template: typeof BUSINESS_TEMPLATES[number]) => {
    updateConfig({
      concept: 'person',
      silhouette: 'portrait',
      style: 'executive',
      mood: 'friendly',
      outfit: template.outfit,
      accessory: template.accessory,
      background: 'grid',
      details: template.details,
      rarity: 'rare',
      neonColor: 'cyan_neon',
    } as Partial<AvatarStudioConfig>);
  };

  const equipMascot = (item: typeof MASCOT_EXAMPLES[number]) => {
    updateConfig({
      concept: item.concept,
      silhouette: 'mascot',
      style: 'toy_premium',
      mood: 'friendly',
      outfit: item.concept === 'robot' ? 'support_polo' : 'executive_suit',
      accessory: item.concept === 'burger' ? 'badge' : 'none',
      background: 'aura',
      details: item.details,
      rarity: 'epic',
    } as Partial<AvatarStudioConfig>);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleSave = () => {
    saveAvatarConfig(uid, config);
    if (uid) {
      try {
        localStorage.setItem(`hd_avatar_${uid}`, previewUrl);
      } catch {
        // The callback still updates the live UI even if local storage is full.
      }
    }
    onAvatarChange(previewUrl);
    if (onPhraseChange) onPhraseChange(config.phrase.trim().slice(0, 44));
    window.dispatchEvent(new CustomEvent('hd-avatar-updated', { detail: { uid, url: previewUrl } }));
    void upsertAvatarIdentity(uid, { ...identity, avatarUrl: previewUrl, phrase: config.phrase.trim().slice(0, 44) });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <section
      className={cn(
        'hd-avatar-lab group relative overflow-hidden rounded-[32px] border border-cyan-300/20 bg-slate-950/72 p-5 shadow-[0_28px_70px_rgba(0,0,0,0.42),0_12px_32px_rgba(0,229,255,0.10)] backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-cyan-200/50 hover:shadow-[0_36px_90px_rgba(0,0,0,0.55),0_0_52px_rgba(34,211,238,0.20)]',
        compact ? 'space-y-5' : 'space-y-6',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent opacity-80" />
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-cyan-300/15 blur-3xl transition group-hover:bg-cyan-200/25" />
      <div className="pointer-events-none absolute -bottom-28 left-8 h-56 w-56 rounded-full bg-blue-600/20 blur-3xl" />

      <div className="relative z-10 mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">
            <Rocket className="h-4 w-4" />
            AvatarIA Studio
          </p>
          <h3 className="mt-1 text-3xl font-black tracking-tight text-white">Convierte cualquier foto en un avatar 3D profesional</h3>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-white/65">
            Plataforma SaaS de identidad visual con IA: selfie a clay 3D, mascotas de marca, editor profesional, plantillas empresariales y equipos consistentes.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-cyan-100 shadow-[0_0_26px_rgba(34,211,238,0.14)]">
          <Crown className="h-5 w-5 text-yellow-300" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Rareza</p>
            <p className="text-sm font-black uppercase">{config.rarity.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      <div className={cn('relative grid gap-5', compact ? 'grid-cols-1' : 'xl:grid-cols-[320px_minmax(0,1fr)_300px]')}>
        <div className="space-y-4">
          <div className="hd-avatar-viewport">
            <div className="hd-avatar-viewport-ring" />
            <AvatarPreview
              identity={identity}
              avatarUrl={previewUrl}
              currentAvatar={currentAvatar}
              name={name}
              role={role}
            />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/10 bg-white/7 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Tipo</p>
                <p className="mt-1 truncate text-xs font-black text-white">{config.concept}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/7 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Estilo</p>
                <p className="mt-1 truncate text-xs font-black text-white">{config.style}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/7 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Glow</p>
                <p className="mt-1 text-xs font-black text-white">{config.glowIntensity}%</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {variations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => equipPreset(item.config)}
                  className="rounded-2xl border border-white/10 bg-white/7 p-2 transition hover:-translate-y-0.5 hover:border-cyan-200/50 hover:bg-cyan-300/10"
                  title={`Aplicar variacion ${item.label}`}
                >
                  <img src={item.url} alt={`Avatar ${item.label}`} className="aspect-square w-full rounded-xl object-cover" />
                  <span className="mt-1 block text-[10px] font-black text-cyan-100">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleRandom}
              className="flex items-center justify-center gap-2 rounded-2xl border border-orange-300/30 bg-orange-500/12 px-4 py-3 text-sm font-black text-orange-100 shadow-[0_0_20px_rgba(251,146,60,0.12)] transition hover:scale-[1.03] hover:border-orange-200/70 hover:bg-orange-400/20 hover:shadow-[0_0_32px_rgba(251,146,60,0.28)]"
            >
              <Shuffle className="h-4 w-4" />
              Aleatorio
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/35 bg-emerald-500/15 px-4 py-3 text-sm font-black text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,0.16)] transition hover:scale-[1.03] hover:border-emerald-200/80 hover:bg-emerald-400/25 hover:shadow-[0_0_36px_rgba(52,211,153,0.35)]"
            >
              <Save className="h-4 w-4" />
              {saved ? 'Guardado' : 'Guardar'}
            </button>
          </div>

          {onUploadClick && (
            <button
              type="button"
              onClick={onUploadClick}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-black text-white transition hover:scale-[1.02] hover:border-cyan-200/45 hover:bg-white/12"
            >
              <Camera className="h-4 w-4" />
              Subir selfie para avatar 3D
            </button>
          )}
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2 rounded-[24px] border border-white/10 bg-white/7 p-2">
            {[
              { id: 'photo', label: 'Foto IA', icon: Upload },
              { id: 'mascot', label: 'Mascota', icon: PawPrint },
              { id: 'appearance', label: 'Apariencia', icon: UserRound },
              { id: 'style', label: 'Estilo', icon: Sparkles },
              { id: 'identity', label: 'Identidad', icon: Shield },
              { id: 'business', label: 'Empresa', icon: BriefcaseBusiness },
              { id: 'team', label: 'Equipos', icon: Users },
              { id: 'collection', label: 'Coleccion', icon: Trophy },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition',
                  activeTab === tab.id
                    ? 'bg-cyan-300/18 text-white shadow-[0_0_24px_rgba(34,211,238,0.20)]'
                    : 'text-white/55 hover:bg-white/8 hover:text-white'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'photo' && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-[26px] border border-cyan-300/16 bg-white/7 p-5">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
                  <ImagePlus className="h-4 w-4" />
                  Modulo 1: Avatar desde foto
                </p>
                <h4 className="mt-2 text-2xl font-black text-white">Selfie a clay 3D en 4 variaciones</h4>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-white/62">
                  El flujo comercial queda listo para subir una foto, detectar rasgos visuales y convertirlos en un avatar corporativo con estilo consistente.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {PHOTO_ANALYSIS_ITEMS.map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-bold text-white/80">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {onUploadClick && (
                    <button
                      type="button"
                      onClick={onUploadClick}
                      className="flex items-center gap-2 rounded-2xl border border-cyan-200/35 bg-cyan-300/14 px-4 py-3 text-sm font-black text-cyan-50 transition hover:scale-[1.02] hover:bg-cyan-300/22"
                    >
                      <Upload className="h-4 w-4" />
                      Subir selfie
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => updateConfig({ concept: 'person', silhouette: 'portrait', style: 'toy_premium', mood: 'friendly', outfit: 'executive_suit', background: 'aura', details: 'selfie convertida en avatar clay 3D profesional, rostro amigable, iluminacion de estudio, fondo transparente' })}
                    className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-black text-white transition hover:scale-[1.02] hover:border-cyan-200/45"
                  >
                    <Wand2 className="h-4 w-4" />
                    Simular analisis IA
                  </button>
                </div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-slate-950/48 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/45">Exportaciones MVP</p>
                {['PNG transparente', 'Icono', 'Sticker', 'Banner'].map((item) => (
                  <div key={item} className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/7 px-3 py-2 text-sm font-bold text-white/75">
                    <Download className="h-4 w-4 text-cyan-200" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'mascot' && (
            <div className="space-y-4">
              <div className="rounded-[26px] border border-cyan-300/16 bg-white/7 p-5">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
                  <PawPrint className="h-4 w-4" />
                  Modulo 2: Generador de Mascotas IA
                </p>
                <textarea
                  value={config.details}
                  maxLength={240}
                  onChange={(event) => updateConfig({ details: event.target.value.slice(0, 240) })}
                  placeholder="Crea una hamburguesa sonriente estilo clay 3D corporativo"
                  className="mt-4 min-h-[92px] w-full resize-none rounded-2xl border border-cyan-300/25 bg-slate-950/70 px-4 py-3 text-sm font-semibold leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-cyan-200/70"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {MASCOT_EXAMPLES.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => equipMascot(item)}
                    className="rounded-[22px] border border-white/10 bg-white/7 p-4 text-left transition hover:-translate-y-1 hover:border-cyan-200/50 hover:bg-cyan-300/10"
                  >
                    <p className="font-black text-white">{item.label}</p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-white/55">{item.details}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className={cn('grid gap-4', compact ? 'grid-cols-1 sm:grid-cols-2' : 'md:grid-cols-2')}>
              {SELECT_GROUPS.filter((group) => ['concept', 'silhouette', 'outfit', 'accessory'].includes(group.key)).map((group) => (
                <SelectControl
                  key={group.key}
                  label={group.label}
                  value={config[group.key]}
                  options={group.options}
                  onChange={(value) => updateConfig({ [group.key]: value })}
                />
              ))}
            </div>
          )}

          {activeTab === 'style' && (
            <div className={cn('grid gap-4', compact ? 'grid-cols-1 sm:grid-cols-2' : 'md:grid-cols-2')}>
              {SELECT_GROUPS.filter((group) => ['style', 'mood', 'palette', 'background'].includes(group.key)).map((group) => (
                <SelectControl
                  key={group.key}
                  label={group.label}
                  value={config[group.key]}
                  options={group.options}
                  onChange={(value) => updateConfig({ [group.key]: value })}
                />
              ))}
            </div>
          )}

          {activeTab === 'identity' && (
            <div className="space-y-4">
              <AvatarEditor
                identity={identity}
                onChange={updateIdentity}
                compact={compact}
              />
              <div className="rounded-[24px] border border-white/10 bg-white/7 p-4">
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">Editor profesional</p>
                <div className="flex flex-wrap gap-2">
                  {PROFESSIONAL_DETAILS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => appendDetail(item)}
                      className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-2 text-xs font-bold text-white/70 transition hover:border-cyan-200/50 hover:bg-cyan-300/10 hover:text-white"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'business' && (
            <div className="space-y-4">
              <div className="rounded-[26px] border border-cyan-300/16 bg-white/7 p-5">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
                  <Building2 className="h-4 w-4" />
                  Modulo 4: Avatares para empresas
                </p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-white/62">
                  Plantillas listas para reclutamiento, CRM, call centers, equipos comerciales y directorios internos.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {BUSINESS_TEMPLATES.map((template) => (
                  <button
                    key={template.label}
                    type="button"
                    onClick={() => equipBusinessTemplate(template)}
                    className="rounded-[22px] border border-white/10 bg-white/7 p-4 text-left transition hover:-translate-y-1 hover:border-cyan-200/50 hover:bg-cyan-300/10"
                  >
                    <p className="font-black text-white">{template.label}</p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-white/55">{template.details}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
              <div className="rounded-[26px] border border-cyan-300/16 bg-white/7 p-5">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
                  <Users className="h-4 w-4" />
                  Modulo 5: Generador de equipos
                </p>
                <h4 className="mt-2 text-2xl font-black text-white">30 fotos, un mismo estilo visual</h4>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-white/62">
                  Define iluminacion, branding, fondo y uniforme una sola vez para generar avatares consistentes para CRM, organigramas, intranet y directorios.
                </p>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {['10', '30', '100+'].map((amount) => (
                    <div key={amount} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-center">
                      <p className="text-2xl font-black text-white">{amount}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">avatares</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-slate-950/48 p-4">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
                  <Layers3 className="h-4 w-4" />
                  Enterprise
                </p>
                {ENTERPRISE_FEATURES.map((item) => (
                  <div key={item} className="mt-3 rounded-2xl border border-white/10 bg-white/7 px-3 py-2 text-sm font-bold text-white/75">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'collection' && (
            <div className="grid gap-3 md:grid-cols-2">
              {collection.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => equipPreset(item.config)}
                  className="group relative overflow-hidden rounded-[24px] border border-cyan-300/16 bg-[#061b3a]/80 p-4 text-left shadow-[0_18px_40px_rgba(0,0,0,0.24)] transition hover:-translate-y-1 hover:border-cyan-200/55 hover:shadow-[0_0_34px_rgba(0,229,255,0.18)]"
                >
                  <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-cyan-300/12 blur-2xl transition group-hover:bg-cyan-200/25" />
                  <div className="relative flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-black text-white">{item.name}</p>
                      <p className="text-xs font-semibold text-white/55">{item.hint}</p>
                    </div>
                  </div>
                  <span className="relative mt-3 inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                    {item.rarity.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className={cn('grid gap-4', compact ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]')}>
            <label className="space-y-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/90">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-200" />
                Frase del avatar
              </span>
              <input
                value={config.phrase}
                maxLength={44}
                onChange={(event) => updateConfig({ phrase: event.target.value.slice(0, 44) })}
                placeholder="Ej. Dream team activado"
                className="w-full rounded-2xl border border-cyan-300/25 bg-slate-950/70 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-white/35 focus:border-cyan-200/70 focus:shadow-[0_0_22px_rgba(34,211,238,0.25)]"
              />
              <span className="block text-[10px] font-semibold normal-case tracking-normal text-white/55">
                {config.phrase.length}/44 caracteres. Se guarda como frase visible del perfil.
              </span>
            </label>

            <label className="space-y-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/90">
              <span className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-cyan-200" />
                Detalles personalizados
              </span>
              <textarea
                value={config.details}
                maxLength={240}
                onChange={(event) => updateConfig({ details: event.target.value.slice(0, 240) })}
                placeholder="Ej. gato supervisor con chamarra naranja, taco humanoide con traje, robot con casco HD..."
                className="min-h-[96px] w-full resize-none rounded-2xl border border-cyan-300/25 bg-slate-950/70 px-4 py-3 text-sm font-semibold leading-relaxed text-white outline-none transition placeholder:text-white/35 focus:border-cyan-200/70 focus:shadow-[0_0_22px_rgba(34,211,238,0.25)]"
              />
            </label>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[26px] border border-cyan-300/16 bg-white/7 p-4 shadow-[0_18px_46px_rgba(0,0,0,0.22)]">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
              <Gem className="h-4 w-4" />
              Rarezas y evolucion
            </p>
            {[
              ['LVL 5', 'Ojos neon'],
              ['LVL 10', 'Mascota rara'],
              ['LVL 20', 'Aura holografica'],
              ['LVL 30', 'Avatar legendario'],
              ['LVL 50', 'Personaje mitico'],
            ].map(([level, label]) => (
              <div key={level} className="mb-2 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/42 px-3 py-2">
                <span className="text-xs font-black text-white">{level}</span>
                <span className="text-xs font-semibold text-white/62">{label}</span>
              </div>
            ))}
          </div>

          <div className="rounded-[24px] border border-white/12 bg-white/7 p-4 shadow-[0_18px_38px_rgba(0,0,0,0.28)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Prompt IA generado</p>
                <p className="text-xs font-semibold text-white/55">Listo para enviarlo a un generador real de imagen si quieres una version hiperrealista.</p>
              </div>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex items-center gap-2 rounded-2xl border border-cyan-200/25 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:scale-[1.03] hover:border-cyan-100/70 hover:bg-cyan-300/20"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <textarea
              value={prompt}
              readOnly
              className="min-h-[112px] w-full resize-none rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm font-semibold leading-relaxed text-white/80 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleRandom}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] border border-fuchsia-300/25 bg-fuchsia-400/12 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-fuchsia-100 transition hover:-translate-y-1 hover:border-fuchsia-200/70 hover:bg-fuchsia-400/20 hover:shadow-[0_0_34px_rgba(217,70,239,0.24)]"
          >
            <Dices className="h-5 w-5" />
            Generar Avatar Epico
          </button>
        </aside>
      </div>
    </section>
  );
}
