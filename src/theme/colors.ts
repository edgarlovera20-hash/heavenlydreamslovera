export const neuralColors = {
  deepSpace: '#050505',
  navy: '#081220',
  electricBlue: '#00AFFF',
  cyan: '#00D9FF',
  ice: '#EAFBFF',
  violet: '#7B61FF',
  magenta: '#D946EF',
  success: '#2CF5B8',
  warning: '#FFB86B',
  danger: '#FF4D7D',
  text: '#FFFFFF',
  muted: '#B9D8F6',
} as const;

export type NeuralTone = 'cyan' | 'blue' | 'violet' | 'emerald' | 'amber' | 'rose';

export const neuralToneRgb: Record<NeuralTone, string> = {
  cyan: '0, 217, 255',
  blue: '4, 55, 242',
  violet: '123, 97, 255',
  emerald: '44, 245, 184',
  amber: '255, 184, 107',
  rose: '255, 77, 125',
};
