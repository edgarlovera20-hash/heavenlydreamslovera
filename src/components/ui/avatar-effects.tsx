import { cn } from '../../lib/utils';
import type { AvatarIdentityConfig } from '../../features/avatar/avatar-presets';

type AvatarEffectsProps = {
  identity: AvatarIdentityConfig;
  className?: string;
};

export function AvatarEffects({ identity, className }: AvatarEffectsProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('hd-avatar-effects', className)}
      data-avatar-background={identity.backgroundStyle}
      data-avatar-animation={identity.animationStyle}
      data-avatar-rarity={identity.rarity}
    >
      <span className="hd-avatar-orbit hd-avatar-orbit-a" />
      <span className="hd-avatar-orbit hd-avatar-orbit-b" />
      <span className="hd-avatar-scan" />
      <span className="hd-avatar-neural-node hd-avatar-node-a" />
      <span className="hd-avatar-neural-node hd-avatar-node-b" />
      <span className="hd-avatar-neural-node hd-avatar-node-c" />
    </span>
  );
}
