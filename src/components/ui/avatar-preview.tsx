import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  AVATAR_RARITIES,
  type AvatarIdentityConfig,
} from '../../features/avatar/avatar-presets';
import { AvatarFrame } from './avatar-frame';

type AvatarPreviewProps = {
  identity: AvatarIdentityConfig;
  avatarUrl?: string | null;
  currentAvatar?: string | null;
  name: string;
  role?: string;
  className?: string;
};

export function AvatarPreview({ identity, avatarUrl, currentAvatar, name, role, className }: AvatarPreviewProps) {
  const rarity = AVATAR_RARITIES.find((item) => item.value === identity.rarity);

  return (
    <div className={cn('hd-avatar-preview', className)}>
      <div className="hd-avatar-preview-glow" />
      <AvatarFrame identity={identity} avatarUrl={avatarUrl} name={name} size="xl" />
      <div className="relative z-10 mt-4 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/80">{role || 'Perfil IA'}</p>
        <h4 className="mt-1 text-xl font-black text-white">{name}</h4>
        <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
          <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
          {rarity?.label || identity.rarity}
        </p>
      </div>

      {currentAvatar && currentAvatar !== avatarUrl && (
        <div className="relative z-10 mt-3 flex items-center justify-center gap-2 rounded-full bg-slate-950/70 px-3 py-2 text-[11px] font-bold text-white/70">
          <img src={currentAvatar} alt="Avatar actual" className="h-6 w-6 rounded-full object-cover" />
          Avatar actual
        </div>
      )}
    </div>
  );
}
