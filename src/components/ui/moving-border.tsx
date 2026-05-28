import React from 'react';
import { cn } from '../../lib/utils';
import { avatarCssVars } from '../../features/avatar/avatar-effects';
import {
  DEFAULT_AVATAR_IDENTITY,
  type AvatarIdentityConfig,
} from '../../features/avatar/avatar-presets';

type MovingBorderProps = React.HTMLAttributes<HTMLDivElement> & {
  identity?: Partial<AvatarIdentityConfig>;
  active?: boolean;
};

export function MovingBorder({
  identity,
  active = true,
  className,
  style,
  children,
  ...props
}: MovingBorderProps) {
  const config = { ...DEFAULT_AVATAR_IDENTITY, ...(identity || {}) } as AvatarIdentityConfig;
  return (
    <div
      {...props}
      data-avatar-border={config.borderStyle}
      data-avatar-animation={config.animationStyle}
      data-avatar-active={active ? 'true' : 'false'}
      className={cn('hd-moving-border', className)}
      style={{ ...avatarCssVars(config), ...style }}
    >
      {children}
    </div>
  );
}
