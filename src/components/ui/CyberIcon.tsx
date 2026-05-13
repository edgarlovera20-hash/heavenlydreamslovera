import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type CyberColor = 'yellow' | 'pink' | 'cyan' | 'green' | 'purple' | 'orange' | 'red' | 'blue';

interface CyberIconProps {
  icon: LucideIcon;
  color?: CyberColor;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  glowOpacity?: number;
}

const colorStyles = {
  yellow: { rgb: '250, 204, 21', text: 'text-yellow-400' },
  pink: { rgb: '244, 114, 182', text: 'text-pink-400' },
  cyan: { rgb: '34, 211, 238', text: 'text-cyan-400' },
  green: { rgb: '52, 211, 153', text: 'text-emerald-400' },
  purple: { rgb: '192, 132, 252', text: 'text-purple-400' },
  orange: { rgb: '251, 146, 60', text: 'text-orange-400' },
  red: { rgb: '239, 68, 68', text: 'text-red-500' },
  blue: { rgb: '96, 165, 250', text: 'text-blue-400' }
};

const sizeStyles = {
  sm: 'w-8 h-8 p-1',
  md: 'w-12 h-12 p-2',
  lg: 'w-16 h-16 p-3',
  xl: 'w-24 h-24 p-4',
  '2xl': 'w-32 h-32 p-6',
};

export function CyberIcon({ icon: Icon, color = 'cyan', size = 'md', className, glowOpacity = 0.5 }: CyberIconProps) {
  const c = colorStyles[color];
  const sz = sizeStyles[size];

  return (
    <div className={cn(
      "relative flex items-center justify-center group transition-all duration-300",
      sz,
      className
    )}>
      {/* The Icon itself with strong neon glowing drop-shadow that increases on hover */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <Icon 
          className={cn(
            "w-full h-full stroke-[1.5] transition-all duration-300 group-hover:scale-110 group-hover:brightness-150", 
            c.text
          )} 
          style={{
            filter: `drop-shadow(0 0 8px rgba(${c.rgb}, ${glowOpacity + 0.2})) drop-shadow(0 0 20px rgba(${c.rgb}, ${glowOpacity}))`
          }}
        />
      </div>
    </div>
  );
}
