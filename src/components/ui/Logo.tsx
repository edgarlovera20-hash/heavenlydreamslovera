import React from 'react';

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "w-32 h-32" }: LogoProps) {
  return (
    <picture className="shrink-0">
      <img
        src="/heavenly-dreams-brand.png"
        alt="Heavenly Dreams"
        className={`hd-app-logo rounded-full object-cover shrink-0 ${className}`}
        draggable={false}
        decoding="async"
      />
    </picture>
  );
}
