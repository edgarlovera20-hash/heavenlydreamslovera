import { Gauge, Orbit, RadioTower, Sparkles } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import {
  AVATAR_ANIMATIONS,
  AVATAR_BACKGROUNDS,
  AVATAR_BORDER_STYLES,
  AVATAR_NEON_COLORS,
  AVATAR_RARITIES,
  AVATAR_REALTIME_STATUSES,
  type AvatarIdentityConfig,
  type AvatarPresetOption,
} from '../../features/avatar/avatar-presets';

type AvatarEditorProps = {
  identity: AvatarIdentityConfig;
  onChange: (patch: Partial<AvatarIdentityConfig>) => void;
  compact?: boolean;
  className?: string;
};

function ButtonGrid<T extends string>({
  label,
  icon,
  value,
  options,
  onChange,
  compact,
}: {
  label: string;
  icon: ReactNode;
  value: T;
  options: AvatarPresetOption<T>[];
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/90">
        {icon}
        {label}
      </p>
      <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3')}>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'hd-avatar-editor-chip',
              value === option.value && 'is-active'
            )}
            style={option.color ? { '--chip-color': option.color } as CSSProperties : undefined}
          >
            {option.color && <span className="hd-avatar-editor-swatch" />}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AvatarEditor({ identity, onChange, compact = false, className }: AvatarEditorProps) {
  return (
    <div className={cn('hd-avatar-editor', className)}>
      <div className={cn('grid gap-5', compact ? 'grid-cols-1' : 'xl:grid-cols-2')}>
        <ButtonGrid
          label="Color neon"
          icon={<Sparkles className="h-4 w-4 text-cyan-200" />}
          value={identity.neonColor}
          options={AVATAR_NEON_COLORS}
          onChange={(neonColor) => onChange({ neonColor })}
          compact={compact}
        />
        <ButtonGrid
          label="Borde neural"
          icon={<Orbit className="h-4 w-4 text-cyan-200" />}
          value={identity.borderStyle}
          options={AVATAR_BORDER_STYLES}
          onChange={(borderStyle) => onChange({ borderStyle })}
          compact={compact}
        />
        <ButtonGrid
          label="Fondo avatar"
          icon={<Sparkles className="h-4 w-4 text-cyan-200" />}
          value={identity.backgroundStyle}
          options={AVATAR_BACKGROUNDS}
          onChange={(backgroundStyle) => onChange({ backgroundStyle })}
          compact={compact}
        />
        <ButtonGrid
          label="Animacion"
          icon={<Gauge className="h-4 w-4 text-cyan-200" />}
          value={identity.animationStyle}
          options={AVATAR_ANIMATIONS}
          onChange={(animationStyle) => onChange({ animationStyle })}
          compact={compact}
        />
        <ButtonGrid
          label="Rareza"
          icon={<Sparkles className="h-4 w-4 text-cyan-200" />}
          value={identity.rarity}
          options={AVATAR_RARITIES}
          onChange={(rarity) => onChange({ rarity })}
          compact={compact}
        />
        <ButtonGrid
          label="Estado realtime"
          icon={<RadioTower className="h-4 w-4 text-cyan-200" />}
          value={identity.statusEffect}
          options={AVATAR_REALTIME_STATUSES}
          onChange={(statusEffect) => onChange({ statusEffect })}
          compact={compact}
        />
      </div>

      <label className="mt-5 block space-y-3 text-[11px] font-black uppercase tracking-[0.22em] text-white/90">
        Intensidad glow
        <input
          value={identity.glowIntensity}
          onChange={(event) => onChange({ glowIntensity: Number(event.target.value) })}
          type="range"
          min={20}
          max={100}
          step={1}
          className="hd-avatar-editor-range"
        />
        <span className="block text-[10px] font-bold normal-case tracking-normal text-white/55">
          {identity.glowIntensity}% de energia visual. En movil se reduce automaticamente para cuidar FPS.
        </span>
      </label>
    </div>
  );
}
