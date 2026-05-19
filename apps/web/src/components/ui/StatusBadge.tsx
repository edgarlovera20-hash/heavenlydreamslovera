import React from 'react';
import { clsx } from 'clsx';
import { SaleStatus, WhatsAppSessionStatus } from '@heavenly/types';

// ============================================================
// Status color map
// ============================================================
export const SALE_STATUS_COLORS: Record<SaleStatus, string> = {
  [SaleStatus.PENDIENTE]:
    'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  [SaleStatus.EN_PROCESO]:
    'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  [SaleStatus.VALIDACION]:
    'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  [SaleStatus.APROBADA]:
    'bg-green-500/20 text-green-400 border border-green-500/30',
  [SaleStatus.RECHAZADA]:
    'bg-red-500/20 text-red-400 border border-red-500/30',
  [SaleStatus.INSTALADA]:
    'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
  [SaleStatus.CANCELADA]:
    'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  [SaleStatus.PENDIENTE]: 'Pendiente',
  [SaleStatus.EN_PROCESO]: 'En Proceso',
  [SaleStatus.VALIDACION]: 'Validación',
  [SaleStatus.APROBADA]: 'Aprobada',
  [SaleStatus.RECHAZADA]: 'Rechazada',
  [SaleStatus.INSTALADA]: 'Instalada',
  [SaleStatus.CANCELADA]: 'Cancelada',
};

export const WA_SESSION_COLORS: Record<WhatsAppSessionStatus, string> = {
  [WhatsAppSessionStatus.CONNECTED]:
    'bg-green-500/20 text-green-400 border border-green-500/30',
  [WhatsAppSessionStatus.DISCONNECTED]:
    'bg-red-500/20 text-red-400 border border-red-500/30',
  [WhatsAppSessionStatus.QR_READY]:
    'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  [WhatsAppSessionStatus.INITIALIZING]:
    'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  [WhatsAppSessionStatus.ERROR]:
    'bg-red-600/20 text-red-500 border border-red-600/30',
};

// ============================================================
// Generic StatusBadge
// ============================================================
interface StatusBadgeProps {
  status: string;
  type?: 'sale' | 'whatsapp' | 'generic';
  className?: string;
}

export function StatusBadge({ status, type = 'sale', className }: StatusBadgeProps) {
  let colorClass = 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
  let label = status;

  if (type === 'sale' && status in SALE_STATUS_COLORS) {
    colorClass = SALE_STATUS_COLORS[status as SaleStatus];
    label = SALE_STATUS_LABELS[status as SaleStatus] ?? status;
  } else if (type === 'whatsapp' && status in WA_SESSION_COLORS) {
    colorClass = WA_SESSION_COLORS[status as WhatsAppSessionStatus];
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
