export const neuralColors = {
  deepSpace: '#0B0B0D',
  navy: '#111214',
  electricBlue: '#00A8FF',
  cyan: '#00A8FF',
  ice: '#EAFBFF',
  violet: '#8B8D98',
  magenta: '#C7C9D1',
  success: '#35D399',
  warning: '#FFB86B',
  danger: '#FF5F7E',
  text: '#FFFFFF',
  muted: '#B8BCC6',
} as const;

export type NeuralTone = 'cyan' | 'blue' | 'violet' | 'emerald' | 'amber' | 'rose';

export const neuralToneRgb: Record<NeuralTone, string> = {
  cyan: '0, 168, 255',
  blue: '0, 168, 255',
  violet: '139, 141, 152',
  emerald: '53, 211, 153',
  amber: '255, 184, 107',
  rose: '255, 95, 126',
};
