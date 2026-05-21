import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface BinaryDecodeTextProps {
  text: string;
  className?: string;
  resolvedClassName?: string;
  binaryClassName?: string;
  delay?: number;
  speed?: number;
}

export function BinaryDecodeText({
  text,
  className,
  resolvedClassName,
  binaryClassName,
  delay = 0,
  speed = 100
}: BinaryDecodeTextProps) {
  const [resolvedIndices, setResolvedIndices] = useState<Set<number>>(new Set());
  const [binaryText, setBinaryText] = useState<string[]>(Array(text.length).fill('0'));
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    timeoutId = setTimeout(() => {
      setHasStarted(true);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [delay, text]);

  useEffect(() => {
    if (!hasStarted) return;
    
    // Reset state for new text
    setResolvedIndices(new Set());
    setBinaryText(Array(text.length).fill('0'));

    const interval = setInterval(() => {
      setBinaryText(prev => prev.map(() => Math.random() > 0.5 ? '1' : '0'));
    }, 50);

    let currentIndex = 0;
    const resolveInterval = setInterval(() => {
      setResolvedIndices(prev => {
        const next = new Set(prev);
        // Resolve non-alphanumeric immediately or step by step
        while (currentIndex < text.length && text[currentIndex] === ' ') {
            next.add(currentIndex);
            currentIndex++;
        }
        if (currentIndex < text.length) {
            next.add(currentIndex);
            currentIndex++;
        }
        return next;
      });

      if (currentIndex >= text.length) {
        clearInterval(resolveInterval);
        clearInterval(interval);
      }
    }, speed);

    return () => {
      clearInterval(interval);
      clearInterval(resolveInterval);
    };
  }, [text, hasStarted, speed]);

  if (!hasStarted) {
     return <span className={className} style={{ opacity: 0 }}>{text}</span>;
  }

  return (
    <span className={className}>
      {text.split('').map((char, index) => {
        const isResolved = resolvedIndices.has(index);
        return (
          <span
            key={index}
            className={cn(
              "transition-colors duration-300",
              isResolved ? resolvedClassName : cn("text-cyber-matrix font-mono font-bold animate-pulse shadow-cyber-matrix drop-shadow-[0_0_8px_rgba(0,255,136,0.8)]", binaryClassName)
            )}
          >
            {isResolved ? char : binaryText[index]}
          </span>
        );
      })}
    </span>
  );
}
