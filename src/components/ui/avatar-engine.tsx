import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  normalizeAvatarIdentity,
  type AvatarIdentityConfig,
} from '../../features/avatar/avatar-presets';
import { AvatarFrame } from './avatar-frame';

type AvatarEngineProps = {
  identity?: Partial<AvatarIdentityConfig>;
  avatarUrl?: string | null;
  name?: string;
  role?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  compact?: boolean;
};

export function AvatarEngine({
  identity,
  avatarUrl,
  name = 'Usuario',
  role = 'Perfil IA',
  size = 'lg',
  className,
  compact = false,
}: AvatarEngineProps) {
  const config = useMemo(() => normalizeAvatarIdentity({ ...(identity || {}), avatarUrl }), [identity, avatarUrl]);

  return (
    <div className={cn('hd-avatar-engine', compact && 'hd-avatar-engine-compact', className)}>
      <AvatarFrame identity={config} avatarUrl={avatarUrl || config.avatarUrl} name={name} size={size} />
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{name}</p>
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/80">{role}</p>
        </div>
      )}
    </div>
  );
}
