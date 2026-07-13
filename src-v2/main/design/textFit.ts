// Pure text measurement + fitting, ported from V1 src/layout/textFitEngine.ts but
// decoupled from Photoshop round-trips. The JSX emitter runs a second, exact
// fitting pass inside Photoshop; this pass sizes the plan so the second pass
// rarely needs to shrink more than a step or two.

// Average glyph width as a fraction of font size, per family class.
const WIDTH_FACTORS: Record<string, number> = {
  condensed: 0.44, bold: 0.58, regular: 0.52, serif: 0.5, display: 0.6,
};

export function widthFactorFor(font: string): number {
  const f = font.toLowerCase();
  if (f.includes('impact') || f.includes('condensed')) return WIDTH_FACTORS.condensed;
  if (f.includes('georgia') || f.includes('times') || f.includes('palatino') || f.includes('cambria')) return WIDTH_FACTORS.serif;
  if (f.includes('bold') || f.includes('black') || f.includes('heavy')) return WIDTH_FACTORS.bold;
  return WIDTH_FACTORS.regular;
}

export function estimateTextWidth(text: string, size: number, font: string, tracking = 0): number {
  const factor = widthFactorFor(font);
  return text.length * size * factor + text.length * (tracking / 1000) * size;
}

export function wrapLines(text: string, size: number, boxWidth: number, font: string, tracking = 0): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (estimateTextWidth(candidate, size, font, tracking) <= boxWidth || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export interface FitResult { size: number; lines: string[]; height: number; overflow: boolean }

// Largest size in [minSize, maxSize] whose wrapped text fits box width/height and maxLines.
export function fitText(
  text: string, box: { w: number; h: number },
  maxSize: number, minSize: number, maxLines: number,
  font: string, lineHeight = 1.2, tracking = 0,
): FitResult {
  let size = maxSize;
  while (size >= minSize) {
    const lines = wrapLines(text, size, box.w, font, tracking);
    const height = lines.length * size * lineHeight;
    if (lines.length <= maxLines && height <= box.h) return { size, lines, height, overflow: false };
    size -= Math.max(1, Math.round(size * 0.06));
  }
  const lines = wrapLines(text, minSize, box.w, font, tracking);
  return { size: minSize, lines, height: lines.length * minSize * lineHeight, overflow: true };
}
