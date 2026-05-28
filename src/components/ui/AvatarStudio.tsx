import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Camera, Copy, Crown, Dices, Gem, Palette, PawPrint, Pizza, Rocket, Save, Shield, Shuffle, Sparkles, Trophy, UserRound } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'appearance' | 'style' | 'identity' | 'collection'>('appearance');
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
            AI Avatar Lab Premium
          </p>
          <h3 className="mt-1 text-3xl font-black tracking-tight text-white">Cyber Identity Lab</h3>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-white/65">
            Diseña un avatar coleccionable con rareza, personalidad, glow y prompt IA listo para render premium.
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
              Usar foto propia
            </button>
          )}
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2 rounded-[24px] border border-white/10 bg-white/7 p-2">
            {[
              { id: 'appearance', label: 'Apariencia', icon: UserRound },
              { id: 'style', label: 'Estilo', icon: Sparkles },
              { id: 'identity', label: 'Identidad', icon: Shield },
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
            <AvatarEditor
              identity={identity}
              onChange={updateIdentity}
              compact={compact}
            />
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
