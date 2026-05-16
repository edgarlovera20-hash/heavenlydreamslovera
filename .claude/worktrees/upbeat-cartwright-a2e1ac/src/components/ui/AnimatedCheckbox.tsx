import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AnimatedCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function AnimatedCheckbox({ checked, onChange, label, className }: AnimatedCheckboxProps) {
  return (
    <label className={cn("flex items-center gap-3 cursor-pointer group", className)}>
      <div className="relative flex items-center justify-center">
        <input 
          type="checkbox" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div className={cn(
          "w-6 h-6 rounded border-2 transition-all duration-300 flex items-center justify-center overflow-hidden relative",
          checked 
            ? "bg-cyber-neon/20 border-cyber-neon shadow-[0_0_10px_rgba(0,229,255,0.5)]" 
            : "bg-cyber-dark border-cyber-electric/50 group-hover:border-cyber-neon/50"
        )}>
          {/* Cyber scanline effect inside checkbox */}
          {checked && (
            <motion.div 
              initial={{ y: "-100%" }}
              animate={{ y: "100%" }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-transparent w-full h-[2px]"
            />
          )}

          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Check className="w-4 h-4 text-cyber-neon drop-shadow-[0_0_5px_rgba(0,229,255,1)]" strokeWidth={3} />
          </motion.div>
        </div>
      </div>
      {label && (
        <span className={cn(
          "font-bold uppercase tracking-widest text-xs transition-colors",
          checked ? "text-white" : "text-cyber-electric/70 group-hover:text-cyber-electric"
        )}>
          {label}
        </span>
      )}
    </label>
  );
}
