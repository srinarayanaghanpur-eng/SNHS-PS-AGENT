/**
 * Pure text fitting for newly created text layers. Estimates rendered width
 * from character metrics (average advance ≈ 0.52em for Latin, 0.95em for
 * Telugu) and searches the largest font size that fits the box within the
 * allowed line count — adjusting tracking before shrinking below readability.
 */
export interface FitBox { width: number; height: number; maxLines?: number }
export interface TextFit {
  fontSize: number;        // px
  tracking: number;        // 1/1000 em (Photoshop tracking units)
  leading: number;         // px
  lines: string[];
  fits: boolean;           // false only if even minimum size overflows
}

export const MIN_READABLE_PX = 12;

const AVG_ADVANCE_LATIN = 0.52;
const AVG_ADVANCE_TELUGU = 0.95;

export function estimateWidth(text: string, fontSize: number, tracking = 0): number {
  let w = 0;
  for (const ch of text) {
    if (/[ఀ-౿]/.test(ch)) w += AVG_ADVANCE_TELUGU;
    else if (ch === ' ') w += 0.28;
    else if (/[iIl1.,:;'!|]/.test(ch)) w += 0.30;
    else if (/[mwMW@]/.test(ch)) w += 0.85;
    else w += AVG_ADVANCE_LATIN;
  }
  return w * fontSize + (text.length - 1) * (tracking / 1000) * fontSize;
}

/** Greedy word wrap at a given size; returns undefined when a single word can't fit. */
export function wrapText(text: string, fontSize: number, maxWidth: number, tracking = 0): string[] | undefined {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (estimateWidth(word, fontSize, tracking) > maxWidth) return undefined;
    const candidate = line ? `${line} ${word}` : word;
    if (estimateWidth(candidate, fontSize, tracking) <= maxWidth) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Find the best fit. Order of adjustments (per spec): font size search first,
 * then tighter tracking (to −50), then more lines, finally minimum size.
 */
export function fitText(text: string, box: FitBox, opts?: { maxFontSize?: number; minFontSize?: number }): TextFit {
  const clean = text.replace(/\s+/g, ' ').trim();
  const maxLines = box.maxLines ?? Math.max(1, Math.floor(box.height / (MIN_READABLE_PX * 1.15)));
  const maxSize = Math.min(opts?.maxFontSize ?? box.height, box.height);
  const minSize = Math.max(MIN_READABLE_PX, opts?.minFontSize ?? MIN_READABLE_PX);

  const attempt = (fontSize: number, tracking: number): TextFit | undefined => {
    const leading = fontSize * 1.15;
    const lines = wrapText(clean, fontSize, box.width, tracking);
    if (!lines || lines.length > maxLines) return undefined;
    if (lines.length * leading > box.height + fontSize * 0.2) return undefined;
    return { fontSize, tracking, leading, lines, fits: true };
  };

  for (let size = Math.floor(maxSize); size >= minSize; size--) {
    for (const tracking of [0, -25, -50]) {
      const fit = attempt(size, tracking);
      if (fit) return fit;
    }
  }
  // Nothing fits at readable size: return minimum-size best effort, flagged.
  const lines = wrapText(clean, minSize, box.width, -50) ?? [clean];
  return { fontSize: minSize, tracking: -50, leading: minSize * 1.15, lines: lines.slice(0, Math.max(1, maxLines)), fits: false };
}
