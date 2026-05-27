import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Copy, Palette, Save, Shuffle, Sparkles, Wand2 } from 'lucide-react';
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

  const updateConfig = (patch: Partial<AvatarStudioConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const handleRandom = () => {
    setConfig(randomAvatarConfig(name, role, config.phrase));
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
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <section
      className={cn(
        'group relative overflow-hidden rounded-[28px] border border-cyan-300/20 bg-slate-950/72 p-5 shadow-[0_28px_70px_rgba(0,0,0,0.42),0_12px_32px_rgba(0,229,255,0.10)] backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-cyan-200/50 hover:shadow-[0_36px_90px_rgba(0,0,0,0.55),0_0_52px_rgba(34,211,238,0.20)]',
        compact ? 'space-y-5' : 'space-y-6',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent opacity-80" />
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-cyan-300/15 blur-3xl transition group-hover:bg-cyan-200/25" />
      <div className="pointer-events-none absolute -bottom-28 left-8 h-56 w-56 rounded-full bg-blue-600/20 blur-3xl" />

      <div className={cn('relative grid gap-5', compact ? 'grid-cols-1' : 'lg:grid-cols-[260px_minmax(0,1fr)]')}>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/35 bg-cyan-300/10 text-cyan-200 shadow-[0_0_26px_rgba(34,211,238,0.22)]">
              <Wand2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">Avatar IA</p>
              <h3 className="text-2xl font-black text-white">Estudio creativo</h3>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-white/65">
                Crea una persona, animal, alimento humanoide, robot, objeto vivo o mascota premium para tu perfil.
              </p>
            </div>
          </div>

          <div className="relative mx-auto flex max-w-[240px] flex-col items-center rounded-[30px] border border-white/15 bg-white/8 p-4 shadow-[0_20px_55px_rgba(0,0,0,0.36)]">
            <div className="absolute inset-0 rounded-[30px] bg-gradient-to-br from-white/14 via-transparent to-cyan-300/10 opacity-80" />
            <img
              src={previewUrl}
              alt="Vista previa del avatar IA"
              className="relative h-44 w-44 rounded-full border-4 border-cyan-200/50 object-cover shadow-[0_0_42px_rgba(34,211,238,0.28)]"
            />
            {currentAvatar && (
              <div className="relative mt-3 flex items-center gap-2 rounded-full bg-slate-950/70 px-3 py-2 text-[11px] font-bold text-white/70">
                <img src={currentAvatar} alt="Avatar actual" className="h-6 w-6 rounded-full object-cover" />
                Avatar actual
              </div>
            )}
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
          <div className={cn('grid gap-4', compact ? 'grid-cols-1 sm:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4')}>
            {SELECT_GROUPS.map((group) => (
              <SelectControl
                key={group.key}
                label={group.label}
                value={config[group.key]}
                options={group.options}
                onChange={(value) => updateConfig({ [group.key]: value })}
              />
            ))}
          </div>

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
        </div>
      </div>
    </section>
  );
}
