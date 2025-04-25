import * as d3 from "d3";
import { Vocabulary } from "./data";

export const softmax = (logits: number[]): number[] => {
  if (!logits || logits.length === 0) return [];
  const maxLogit = Math.max(...logits);
  const exps = logits.map((logit) => Math.exp(logit - maxLogit));
  const sumExps = exps.reduce((sum, val) => sum + val, 0);
  if (sumExps === 0 || !Number.isFinite(sumExps)) {
    console.warn(
      "Softmax resulted in zero or non-finite sum, returning uniform distribution.",
    );
    return logits.map(() => 1 / logits.length);
  }
  return exps.map((exp) => exp / sumExps);
};

export const getLuminance = (color: string): number => {
  try {
    const rgbColor = d3.color(color)?.rgb();
    if (!rgbColor) return 0.5;
    const { r, g, b } = rgbColor;
    const RsRGB = r / 255,
      GsRGB = g / 255,
      BsRGB = b / 255;
    const R =
      RsRGB <= 0.03928 ? RsRGB / 12.92 : Math.pow((RsRGB + 0.055) / 1.055, 2.4);
    const G =
      GsRGB <= 0.03928 ? GsRGB / 12.92 : Math.pow((GsRGB + 0.055) / 1.055, 2.4);
    const B =
      BsRGB <= 0.03928 ? BsRGB / 12.92 : Math.pow((BsRGB + 0.055) / 1.055, 2.4);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  } catch (e) {
    console.error("Error calculating luminance for color:", color, e);
    return 0.5;
  }
};

export const getTextColorForBackground = (backgroundColor: string): string => {
  const luminance = getLuminance(backgroundColor);
  const dynamicTextColorThreshold = 0.1;
  const lightTextColor = "#f0f0f0";
  const darkTextColor = "#000";
  return luminance > dynamicTextColorThreshold ? darkTextColor : lightTextColor;
};

export const transformDataForSortedView = (
  logits: number[][],
  tokenIndices: number[][],
  vocab: Vocabulary,
): {
  token: string;
  logit: number;
  probability: number;
  originalIndex: number;
}[][] => {
  return logits.map((timestepLogits, timestepIndex) => {
    const timestepTokenIndices = tokenIndices[timestepIndex];
    const probabilities = softmax(timestepLogits);
    return timestepLogits.map((logit, logitIndex) => {
      const tokenIndex = timestepTokenIndices[logitIndex];

      return {
        token: vocab[tokenIndex],
        logit: logit,
        probability: probabilities[logitIndex],
        originalIndex: timestepTokenIndices[logitIndex],
      };
    });
  });
};

export function calculateSoftmax(logits: number[]): number[] {
  if (!logits || logits.length === 0) return [];
  const maxLogit = Math.max(...logits.filter((l) => isFinite(l)), -Infinity);
  if (!isFinite(maxLogit)) return Array(logits.length).fill(1 / logits.length); // Uniform if all are -Infinity
  const exps = logits.map((logit) => Math.exp(logit - maxLogit));
  const sumExps = exps.reduce((sum, val) => sum + val, 0);
  if (sumExps === 0) {
    return Array(logits.length).fill(1 / logits.length); // Uniform if sum is zero
  }
  return exps.map((exp) => exp / sumExps);
}

export function calculateEntropy(probabilities: number[]): number {
  if (!probabilities || probabilities.length === 0) return 0;
  return probabilities.reduce((entropy, p) => {
    if (p > 0) {
      // Use log base 2 for entropy in bits
      return entropy - p * Math.log2(p);
    }
    return entropy;
  }, 0);
}
