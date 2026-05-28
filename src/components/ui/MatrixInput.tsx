import React, { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface MatrixInputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  value?: any;
  onChange?: (e: any) => void;
  onBlur?: (e: any) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  autoComplete?: string;
}

export function MatrixInput({ className, value, onChange, type = "text", ...props }: MatrixInputProps) {
  return (
    <div className="relative w-full">
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={cn(
          "hd-input",
          className
        )}
        placeholder={props.placeholder}
        {...props}
      />
    </div>
  );
}
