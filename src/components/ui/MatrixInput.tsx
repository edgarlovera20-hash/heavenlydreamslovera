import React, { InputHTMLAttributes, useId } from 'react';
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
  label?: string;
  error?: string;
}

export function MatrixInput({
  className,
  value,
  onChange,
  type = "text",
  label,
  error,
  required,
  id: idProp,
  ...props
}: MatrixInputProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const errorId = `${id}-error`;

  return (
    <div className="relative w-full flex flex-col gap-1">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-[rgba(255,255,255,0.72)]"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-[var(--electric-pink)]" aria-hidden="true">*</span>
          )}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        aria-required={required ? true : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "hd-input w-full rounded-md border px-3 py-2 text-sm",
          error && "border-[var(--electric-rose)] focus:border-[var(--electric-rose)]",
          className
        )}
        placeholder={props.placeholder}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-[var(--electric-rose)] mt-0.5">
          {error}
        </p>
      )}
    </div>
  );
}
