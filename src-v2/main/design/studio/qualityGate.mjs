// Quality gate: renders the poster, analyses the raster for dead space and
// readability, and returns pass/fail with reasons. A file on disk is NOT proof.

import sharp from 'sharp';

// Analyse largest unintentionally-empty region by gridding the raster and
// flagging cells that are near-uniform AND near the canvas colour.
export async function analyseEmptiness(pngBuffer, canvasHex) {
  const grid = 24;
  const img = sharp(pngBuffer).resize(grid, Math.round(grid * 1.25), { fit: 'fill' });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const cols = info.width, rows = info.height;
  const cnv = [parseInt(canvasHex.slice(1, 3), 16), parseInt(canvasHex.slice(3, 5), 16), parseInt(canvasHex.slice(5, 7), 16)];
  const empty = [];
  for (let r = 0; r < rows; r++) {
    empty[r] = [];
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * ch;
      const d = Math.abs(data[i] - cnv[0]) + Math.abs(data[i + 1] - cnv[1]) + Math.abs(data[i + 2] - cnv[2]);
      empty[r][c] = d < 40 ? 1 : 0;
    }
  }
  // Largest all-empty axis-aligned rectangle (histogram method) as fraction of canvas.
  const heights = new Array(cols).fill(0);
  let best = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) heights[c] = empty[r][c] ? heights[c] + 1 : 0;
    // largest rectangle in histogram
    const stack = [];
    for (let c = 0; c <= cols; c++) {
      const h = c === cols ? 0 : heights[c];
      let start = c;
      while (stack.length && stack[stack.length - 1].h > h) {
        const top = stack.pop();
        best = Math.max(best, top.h * (c - top.i));
        start = top.i;
      }
      stack.push({ i: start, h });
    }
  }
  return best / (rows * cols); // fraction of canvas that is one empty block
}

export async function runQualityGate({ pngBuffer, scene, plan, content, palette }) {
  const reasons = [];
  const checks = {};

  // 1. Largest empty block must not exceed 30% of canvas.
  const emptyFrac = await analyseEmptiness(pngBuffer, palette.canvas);
  checks.largestEmptyBlockPct = Math.round(emptyFrac * 100);
  if (emptyFrac > 0.30) reasons.push(`Largest empty block ${Math.round(emptyFrac * 100)}% > 30%`);

  // 2. Required text present in the scene graph.
  const allText = collectText(scene.root).join('  ');
  const required = [content.school.name, content.title, content.school.phone, content.school.address];
  for (const req of required) {
    if (req && !allText.includes(req)) reasons.push(`Missing required text: "${req}"`);
  }
  checks.requiredTextPresent = required.every((r) => !r || allText.includes(r));

  // 3. Readability thresholds (min export sizes at 1080x1350).
  const sizes = collectSizes(scene.root);
  const titleSize = maxSizeFor(scene.root, content.title);
  checks.titlePx = titleSize;
  if (titleSize < 68) reasons.push(`Title ${titleSize}px < 68px min`);
  const scheduleSizes = sizesForItems(scene.root, content.schedule || []);
  const minSchedule = scheduleSizes.length ? Math.min(...scheduleSizes) : 0;
  checks.scheduleMinPx = minSchedule;
  if ((content.schedule || []).length && minSchedule < 24) reasons.push(`Schedule text ${minSchedule}px < 25px min`);
  const footerSize = maxSizeFor(scene.root, content.school.phone);
  checks.footerPx = footerSize;
  if (content.school.phone && footerSize < 22) reasons.push(`Footer ${footerSize}px < 22px min`);

  // 4. Safe margins: no text node starts left of margin or past right margin.
  const m = plan.canvas.margin;
  let marginViolations = 0;
  walk(scene.root, (n) => {
    if (n.type === 'text' && n.text && n.text.trim()) {
      if (n.x < m - 2 && n.align !== 'center') marginViolations++;
      if (n.x + n.w > plan.canvas.width - m + 2 && n.align === 'left') marginViolations++;
    }
  });
  checks.marginViolations = marginViolations;
  if (marginViolations > 0) reasons.push(`${marginViolations} elements break safe margins`);

  // 5. Focal point present.
  checks.hasFocalPoint = !!plan.focalElement;

  const pass = reasons.length === 0;
  const mobileReadability = minSchedule >= 25 && footerSize >= 22 && emptyFrac <= 0.30
    ? 'good' : minSchedule >= 22 ? 'acceptable' : 'poor';

  return { pass, reasons, checks, mobileReadability };
}

function walk(nodes, fn) { for (const n of nodes) { fn(n); if (n.children) walk(n.children, fn); } }
function collectText(nodes) { const out = []; walk(nodes, (n) => { if (n.type === 'text' && n.text) out.push(n.text); }); return out; }
function collectSizes(nodes) { const out = []; walk(nodes, (n) => { if (n.type === 'text' && n.size) out.push(n.size); }); return out; }
function maxSizeFor(nodes, str) { let s = 0; walk(nodes, (n) => { if (n.type === 'text' && str && n.text && (n.text.includes(str) || (n.lines && n.lines.join(' ').toUpperCase().includes(String(str).toUpperCase())))) s = Math.max(s, n.size || 0); }); return s; }
function sizesForItems(nodes, items) { const set = new Set(items); const out = []; walk(nodes, (n) => { if (n.type === 'text' && set.has(n.text)) out.push(n.size); }); return out; }
