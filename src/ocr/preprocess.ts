import type { GrayImage } from './imaging';
import { adaptiveThreshold, estimateSkew, invert, resize, rotate, sharpen, stretchContrast } from './imaging';

export interface PreprocessVariant { name: VariantName; image: GrayImage; deskewAngle?: number }
export type VariantName =
  | 'original' | 'upscaled' | 'grayscale' | 'high-contrast'
  | 'adaptive-threshold' | 'inverted' | 'sharpened' | 'deskewed';

/**
 * Generate the mandated preprocessing variants. Order = priority: the pipeline
 * runs them until confidence is good enough, so cheap/likely-best come first.
 * Input is already grayscale, so 'grayscale' === 'original' input; both names
 * are kept so results report which variant won.
 */
export function buildVariants(gray: GrayImage): PreprocessVariant[] {
  const variants: PreprocessVariant[] = [
    { name: 'original', image: gray },
    { name: 'high-contrast', image: stretchContrast(gray) },
    { name: 'adaptive-threshold', image: adaptiveThreshold(gray) },
    { name: 'sharpened', image: sharpen(gray) },
    { name: 'inverted', image: invert(gray) }
  ];
  // Upscale small posters — Tesseract wants ≥ ~20px x-height.
  if (Math.max(gray.width, gray.height) < 1400) {
    const s = 1400 / Math.max(gray.width, gray.height);
    variants.splice(1, 0, { name: 'upscaled', image: resize(gray, Math.round(gray.width * s), Math.round(gray.height * s)) });
  }
  const angle = estimateSkew(gray);
  if (Math.abs(angle) >= 1)
    variants.push({ name: 'deskewed', image: rotate(gray, angle), deskewAngle: angle });
  return variants;
}
