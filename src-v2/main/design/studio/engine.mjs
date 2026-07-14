// SNHS Poster Studio — core engine (vertical-slice prototype, .mjs)
// Scene graph -> SVG -> PNG (via @resvg/resvg-js). Real text wrapping + dynamic sizing.
// This prototype will be ported to TypeScript + a Photoshop JSX emitter after sign-off.

import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Typography intelligence
// ---------------------------------------------------------------------------
// Coordinated 2-family pairing: Poppins (geometric display) + Lato (humanist body).
export const FONTS = {
  display: { family: 'Poppins', weightBold: 700, weightSemi: 600, weightMed: 500 },
  body: { family: 'Lato', weightReg: 400, weightBold: 700, weightBlack: 900 },
};

// Approx average glyph width as a fraction of font size, by style.
// Calibrated for Poppins/Lato; verified against rendered output.
const GLYPH_W = {
  displayUpper: 0.66,
  display: 0.58,
  body: 0.50,
  bodyUpper: 0.60,
};

export function measureLineWidth(text, fontSize, kind = 'body', tracking = 0) {
  const f = GLYPH_W[kind] ?? 0.52;
  return text.length * fontSize * f + Math.max(0, text.length - 1) * tracking;
}

// Greedy word wrap constrained to maxWidth; returns array of lines.
export function wrapText(text, fontSize, maxWidth, kind = 'body', tracking = 0) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (measureLineWidth(trial, fontSize, kind, tracking) <= maxWidth || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Dynamic font sizing: shrink to fit a box (width + max lines) within a range.
export function fitFontSize(text, box, opts) {
  const { min, max, kind = 'body', tracking = 0, lineHeight = 1.15, maxLines = 3 } = opts;
  for (let size = max; size >= min; size -= 1) {
    const lines = wrapText(text, size, box.w, kind, tracking);
    const totalH = lines.length * size * lineHeight;
    if (lines.length <= maxLines && totalH <= box.h) return { size, lines };
  }
  const lines = wrapText(text, min, box.w, kind, tracking);
  return { size: min, lines };
}

// ---------------------------------------------------------------------------
// Node factories
// ---------------------------------------------------------------------------
export const group = (name, children = []) => ({ type: 'group', name, children });
export const rect = (r, o = {}) => ({ type: 'rect', ...r, ...o });
export const line = (x1, y1, x2, y2, o = {}) => ({ type: 'line', x1, y1, x2, y2, ...o });
export const image = (r, href, o = {}) => ({ type: 'image', ...r, href, ...o });
export const text = (r, str, o = {}) => ({ type: 'text', ...r, text: str, ...o });

// ---------------------------------------------------------------------------
// SVG serialisation
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function dataUri(path) {
  const buf = readFileSync(path);
  const ext = path.toLowerCase().endsWith('.jpg') || path.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'png';
  return `data:image/${ext};base64,${buf.toString('base64')}`;
}

let uid = 0;
function nextId(p) { return `${p}${uid++}`; }

function renderNode(n, defs) {
  switch (n.type) {
    case 'group':
      return n.children.map((c) => renderNode(c, defs)).join('\n');

    case 'rect': {
      let fill = n.fill || 'none';
      if (n.gradient) {
        const id = nextId('grad');
        const stops = n.gradient.stops.map((s) => `<stop offset="${s.at}%" stop-color="${s.color}" stop-opacity="${s.opacity ?? 1}"/>`).join('');
        const a = ((n.gradient.angle ?? 0) * Math.PI) / 180;
        const x2 = (Math.cos(a) * 0.5 + 0.5).toFixed(4), y2 = (Math.sin(a) * 0.5 + 0.5).toFixed(4);
        const x1 = (0.5 - Math.cos(a) * 0.5).toFixed(4), y1 = (0.5 - Math.sin(a) * 0.5).toFixed(4);
        defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`);
        fill = `url(#${id})`;
      }
      const rx = n.radius ? ` rx="${n.radius}" ry="${n.radius}"` : '';
      const op = n.opacity != null ? ` opacity="${n.opacity}"` : '';
      const stroke = n.stroke ? ` stroke="${n.stroke}" stroke-width="${n.strokeWidth || 1}"` : '';
      return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}"${rx} fill="${fill}"${op}${stroke}/>`;
    }

    case 'line':
      return `<line x1="${n.x1}" y1="${n.y1}" x2="${n.x2}" y2="${n.y2}" stroke="${n.stroke || '#000'}" stroke-width="${n.strokeWidth || 1}" stroke-linecap="${n.cap || 'butt'}"/>`;

    case 'image': {
      const clipId = nextId('clip');
      let clip = '';
      if (n.shape === 'circle') {
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2, rr = Math.min(n.w, n.h) / 2;
        clip = `<clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${rr}"/></clipPath>`;
      } else {
        const rx = n.radius || 0;
        clip = `<clipPath id="${clipId}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${rx}" ry="${rx}"/></clipPath>`;
      }
      defs.push(clip);
      const href = n.href.startsWith('data:') ? n.href : dataUri(n.href);
      // cover fit: scale to fill, center-crop via preserveAspectRatio slice
      const img = `<image x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" href="${href}" preserveAspectRatio="${n.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}" clip-path="url(#${clipId})"/>`;
      let extra = '';
      if (n.ring) {
        if (n.shape === 'circle') {
          const cx = n.x + n.w / 2, cy = n.y + n.h / 2, rr = Math.min(n.w, n.h) / 2;
          extra = `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="${n.ring}" stroke-width="${n.ringWidth || 4}"/>`;
        } else {
          extra = `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.radius || 0}" fill="none" stroke="${n.ring}" stroke-width="${n.ringWidth || 4}"/>`;
        }
      }
      return img + extra;
    }

    case 'text': {
      const size = n.size || 24;
      const kind = n.kind || 'body';
      const lh = (n.lineHeight || 1.15) * size;
      const family = n.family || FONTS.body.family;
      const weight = n.weight || 400;
      const style = n.italic ? ' font-style="italic"' : '';
      const tracking = n.tracking || 0;
      const anchor = n.align === 'center' ? 'middle' : n.align === 'right' ? 'end' : 'start';
      const ax = n.align === 'center' ? n.x + n.w / 2 : n.align === 'right' ? n.x + n.w : n.x;
      const lines = n.lines || wrapText(n.text, size, n.w, kind, tracking);
      const fill = n.color || '#111';
      // baseline of first line: y + size (cap top at box top)
      const tspans = lines.map((ln, i) => `<tspan x="${ax}" dy="${i === 0 ? size : lh}">${esc(ln)}</tspan>`).join('');
      const ls = tracking ? ` letter-spacing="${tracking}"` : '';
      const sh = n.shadow ? ` filter="url(#softshadow)"` : '';
      return `<text x="${ax}" y="${n.y}" font-family="${family}" font-size="${size}" font-weight="${weight}"${style} fill="${fill}" text-anchor="${anchor}"${ls}${sh}>${tspans}</text>`;
    }
    default:
      return '';
  }
}

export function sceneToSvg(scene) {
  uid = 0;
  const defs = [];
  const body = scene.root.map((n) => renderNode(n, defs)).join('\n');
  const filters = `<filter id="softshadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000" flood-opacity="0.28"/></filter>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><defs>${filters}${defs.join('')}</defs>${body}</svg>`;
}

export function renderPng(scene, outWidth) {
  const svg = sceneToSvg(scene);
  const resvg = new Resvg(svg, {
    background: '#ffffff',
    fitTo: outWidth ? { mode: 'width', value: outWidth } : { mode: 'original' },
    font: { loadSystemFonts: true, defaultFontFamily: 'Lato' },
  });
  return { png: resvg.render().asPng(), svg };
}
