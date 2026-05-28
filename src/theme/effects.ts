import { neuralToneRgb, type NeuralTone } from './colors';

export const neuralGlow = (tone: NeuralTone = 'cyan', opacity = 0.32) => {
  const rgb = neuralToneRgb[tone];
  return `0 0 0 1px rgba(${rgb}, ${opacity * 0.55}), 0 18px 58px rgba(${rgb}, ${opacity})`;
};

export const neuralBorder = (tone: NeuralTone = 'cyan', opacity = 0.4) => {
  const rgb = neuralToneRgb[tone];
  return `1px solid rgba(${rgb}, ${opacity})`;
};
