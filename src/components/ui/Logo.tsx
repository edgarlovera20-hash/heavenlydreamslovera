import React from 'react';

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "w-32 h-32" }: LogoProps) {
  return (
    <picture className="shrink-0">
      <source srcSet="/logo-mobile.webp" type="image/webp" />
      <img
        src="/logo-192.png"
        alt="HD"
        className={`rounded-full object-cover shrink-0 ${className}`}
        draggable={false}
        decoding="async"
      />
    </picture>
  );
}
