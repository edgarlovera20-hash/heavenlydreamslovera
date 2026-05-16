import React, { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface MatrixInputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  value?: any;
  onChange?: (e: any) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
}

export function MatrixInput({ className, value, onChange, type = "text", ...props }: MatrixInputProps) {
  return (
    <div className="relative w-full">
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={cn(
          "w-full bg-cyber-dark/40 border border-cyber-electric/30 rounded-xl px-4 py-3 text-white placeholder:text-cyber-electric/50 focus:outline-none focus:ring-2 focus:ring-cyber-neon/50 transition-all font-medium font-mono tracking-widest",
          className
        )}
        placeholder={props.placeholder}
        {...props}
      />
    </div>
  );
}
