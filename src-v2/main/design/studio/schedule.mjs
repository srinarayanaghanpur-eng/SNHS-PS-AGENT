// Adaptive schedule layout. Chooses two-column cards, single-column timeline, or
// compact numbered rows based on item count and text length. Never truncates
// items; never renders below a readable floor. Returns { nodes, mode, minSize, overflow }.

import { rect, line, text, fitFontSize, measureLineWidth } from './engine.mjs';

const READABLE_FLOOR = 24; // px at 1080x1350 -> legible on mobile

export function layoutSchedule({ items, box, palette, typo, heading = 'PROGRAMME' }) {
  const nodes = [];
  const n = items.length;
  if (!n) return { nodes, mode: 'none', minSize: 0, overflow: false };

  const maxLen = Math.max(...items.map((s) => s.length));

  // heading
  nodes.push(text({ x: box.x, y: box.y, w: box.w, h: 40 },
    heading, { size: 26, family: typo.label.family, weight: 600, color: palette.primary, align: 'left', tracking: 4 }));
  const headW = Math.round(measureLineWidth(heading, 26, 'bodyUpper', 4));
  nodes.push(line(box.x + headW + 24, box.y + 16, box.x + box.w, box.y + 16, { stroke: palette.accent, strokeWidth: 2 }));

  const areaY = box.y + 54;
  const areaH = box.h - 54;

  // Choose mode: long text -> timeline; very many items -> compact rows; else cards.
  let mode;
  if (maxLen > 28) mode = 'timeline';
  else if (n > 12) mode = 'rows';
  else mode = 'cards';

  let minSize = READABLE_FLOOR;
  let overflow = false;

  if (mode === 'cards') {
    const cols = n > 5 ? 2 : 1;
    const gapX = 24;
    const cardW = cols === 2 ? Math.round((box.w - gapX) / 2) : box.w;
    const rows = Math.ceil(n / cols);
    const cardH = Math.min(96, Math.floor((areaH - (rows - 1) * 12) / rows));
    if (cardH < 44) return layoutRows({ items, box, palette, typo, areaY, areaH, nodes }); // fall back
    const gapY = rows > 1 ? Math.floor((areaH - rows * cardH) / (rows - 1)) : 0;
    items.forEach((it, i) => {
      const col = cols === 2 ? i % 2 : 0;
      const row = cols === 2 ? Math.floor(i / 2) : i;
      const cx = box.x + col * (cardW + gapX);
      const cy = areaY + row * (cardH + Math.min(gapY, 20));
      nodes.push(rect({ x: cx, y: cy, w: cardW, h: cardH, radius: 12 }, { fill: palette.canvasAlt, stroke: '#E6E0D4', strokeWidth: 1 }));
      const pad = Math.round(cardH * 0.18); const chip = cardH - pad * 2;
      nodes.push(rect({ x: cx + pad, y: cy + pad, w: chip, h: chip, radius: 9 }, { fill: palette.primary }));
      const ns = Math.round(chip * 0.5);
      nodes.push(text({ x: cx + pad, y: cy + cardH / 2 - ns * 0.65, w: chip, h: chip }, String(i + 1),
        { size: ns, family: typo.displaySemi.family, weight: 700, color: palette.onPrimary, align: 'center' }));
      const txX = cx + pad + chip + 18; const txW = cx + cardW - txX - 16;
      const f = fitFontSize(it, { w: txW, h: cardH }, { min: READABLE_FLOOR, max: 30, kind: 'body', maxLines: 1 });
      minSize = Math.min(minSize, f.size);
      nodes.push(text({ x: txX, y: cy + cardH / 2 - f.size * 0.66, w: txW, h: cardH }, f.lines[0],
        { size: f.size, family: typo.bodyBold.family, weight: 700, color: palette.ink, align: 'left' }));
    });
    return { nodes, mode, minSize, overflow };
  }

  if (mode === 'timeline') {
    const rowH = Math.min(72, Math.floor(areaH / n));
    if (rowH < 40) overflow = true;
    items.forEach((it, i) => {
      const cy = areaY + i * rowH;
      // dot + connecting line
      const dotX = box.x + 16, dotY = cy + rowH / 2;
      if (i < n - 1) nodes.push(line(dotX, dotY, dotX, cy + rowH + rowH / 2, { stroke: palette.accent, strokeWidth: 2 }));
      nodes.push(rect({ x: dotX - 16, y: dotY - 15, w: 30, h: 30, radius: 15 }, { fill: palette.primary }));
      nodes.push(text({ x: dotX - 16, y: dotY - 15 + 4, w: 30, h: 30 }, String(i + 1),
        { size: 16, family: typo.displaySemi.family, weight: 700, color: palette.onPrimary, align: 'center' }));
      const txX = dotX + 34; const txW = box.x + box.w - txX;
      const f = fitFontSize(it, { w: txW, h: rowH }, { min: READABLE_FLOOR, max: 28, kind: 'body', maxLines: 2 });
      minSize = Math.min(minSize, f.size);
      const ty = dotY - (f.lines.length * f.size) / 2;
      nodes.push(text({ x: txX, y: ty, w: txW, h: rowH }, it,
        { size: f.size, lines: f.lines, family: typo.bodyBold.family, weight: 700, color: palette.ink, align: 'left', lineHeight: 1.1 }));
    });
    return { nodes, mode, minSize, overflow };
  }

  return layoutRows({ items, box, palette, typo, areaY, areaH, nodes });
}

function layoutRows({ items, box, palette, typo, areaY, areaH, nodes }) {
  const n = items.length;
  const cols = n > 10 ? 2 : 1;
  const gapX = 24;
  const colW = cols === 2 ? Math.round((box.w - gapX) / 2) : box.w;
  const rows = Math.ceil(n / cols);
  const rowH = Math.max(30, Math.min(56, Math.floor(areaH / rows)));
  const overflow = rowH < 34;
  let minSize = 24;
  items.forEach((it, i) => {
    const col = cols === 2 ? Math.floor(i / rows) : 0;
    const row = cols === 2 ? i % rows : i;
    const cx = box.x + col * (colW + gapX);
    const cy = areaY + row * rowH;
    const ns = 26;
    nodes.push(rect({ x: cx, y: cy + (rowH - 30) / 2, w: 30, h: 30, radius: 8 }, { fill: palette.primary }));
    nodes.push(text({ x: cx, y: cy + (rowH - 30) / 2 + 4, w: 30, h: 30 }, String(i + 1),
      { size: 16, family: typo.displaySemi.family, weight: 700, color: palette.onPrimary, align: 'center' }));
    const txX = cx + 42; const txW = cx + colW - txX;
    const cap = Math.max(20, Math.min(27, rowH - 8));
    const f = fitFontSize(it, { w: txW, h: rowH }, { min: 20, max: cap, kind: 'body', maxLines: 1 });
    minSize = Math.min(minSize, f.size);
    nodes.push(text({ x: txX, y: cy + rowH / 2 - f.size * 0.66, w: txW, h: rowH }, f.lines[0],
      { size: f.size, family: typo.bodyBold.family, weight: 700, color: palette.ink, align: 'left' }));
  });
  return { nodes, mode: 'rows', minSize, overflow };
}
