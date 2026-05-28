import { cn } from '../../lib/utils';
import {
  AVATAR_REALTIME_STATUSES,
  type AvatarRealtimeStatus,
} from '../../features/avatar/avatar-presets';

type AvatarStatusRingProps = {
  status?: AvatarRealtimeStatus;
  className?: string;
  showLabel?: boolean;
};

export function AvatarStatusRing({ status = 'online', className, showLabel = false }: AvatarStatusRingProps) {
  const meta = AVATAR_REALTIME_STATUSES.find((item) => item.value === status) || AVATAR_REALTIME_STATUSES[0];
  return (
    <span className={cn('hd-avatar-status-ring', className)} data-status={status} title={meta.label}>
      <span className="hd-avatar-status-dot" />
      {showLabel && <span className="hd-avatar-status-label">{meta.label}</span>}
    </span>
  );
}
