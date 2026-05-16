import React from 'react';

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "w-32 h-32" }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="HD"
      className={`rounded-full object-cover shrink-0 ${className}`}
      draggable={false}
    />
  );
}
