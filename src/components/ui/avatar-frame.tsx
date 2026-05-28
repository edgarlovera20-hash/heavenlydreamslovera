import React from 'react';
import { Camera } from 'lucide-react';
import { cn } from '../../lib/utils';
import { avatarCssVars } from '../../features/avatar/avatar-effects';
import {
  DEFAULT_AVATAR_IDENTITY,
  normalizeAvatarIdentity,
  type AvatarIdentityConfig,
} from '../../features/avatar/avatar-presets';
import { AvatarEffects } from './avatar-effects';
import { AvatarStatusRing } from './avatar-status-ring';
import { MovingBorder } from './moving-border';

type AvatarFrameProps = {
  identity?: Partial<AvatarIdentityConfig>;
  avatarUrl?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
  active?: boolean;
  className?: string;
  imageClassName?: string;
  onClick?: () => void;
  children?: React.ReactNode;
};

const SIZE_CLASS = {
  sm: 'h-14 w-14',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
  xl: 'h-44 w-44',
};

function initials(name = 'HD') {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'HD';
}

export function AvatarFrame({
  identity,
  avatarUrl,
  name = 'Usuario',
  size = 'lg',
  editable = false,
  active = true,
  className,
  imageClassName,
  onClick,
  children,
}: AvatarFrameProps) {
  const config = normalizeAvatarIdentity({ ...DEFAULT_AVATAR_IDENTITY, ...(identity || {}), avatarUrl: avatarUrl ?? identity?.avatarUrl });

  return (
    <MovingBorder
      identity={config}
      active={active}
      className={cn('hd-avatar-frame', SIZE_CLASS[size], editable && 'cursor-pointer', className)}
      style={avatarCssVars(config)}
      onClick={onClick}
    >
      <AvatarEffects identity={config} />
      <div className="hd-avatar-core">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`Avatar de ${name}`}
            className={cn('h-full w-full rounded-full object-cover', imageClassName)}
          />
        ) : (
          <span className="hd-avatar-initials">{initials(name)}</span>
        )}
        {children}
      </div>
      <AvatarStatusRing status={config.statusEffect} className="absolute bottom-2 right-2 z-20" />
      {editable && (
        <span className="hd-avatar-edit-layer">
          <Camera className="h-5 w-5" />
          Editar
        </span>
      )}
    </MovingBorder>
  );
}
