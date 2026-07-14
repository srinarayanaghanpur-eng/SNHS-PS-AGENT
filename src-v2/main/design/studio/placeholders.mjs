// Placeholder asset generator. Real runs supply real uploads; if an asset is
// missing the composition omits it gracefully. These placeholders exist ONLY so
// the composition can be visually tested end-to-end.

import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

function toPng(svg, path, w) {
  const r = new Resvg(svg, { fitTo: w ? { mode: 'width', value: w } : { mode: 'original' }, font: { loadSystemFonts: true } });
  writeFileSync(path, r.render().asPng());
}

// A plausible "student assembly" hero photo stand-in: sky gradient, sun, ground,
// rows of stylised figures. Clearly imagery, not a flat block.
export function makeHeroPhoto(path, w = 1080, h = 620) {
  const figures = [];
  const rows = [{ y: h * 0.82, s: 1.0, n: 9 }, { y: h * 0.72, s: 0.8, n: 11 }, { y: h * 0.64, s: 0.65, n: 13 }];
  const skin = ['#C98A5E', '#E0B080', '#A9714B', '#D89A6A'];
  const cloth = ['#2F5FA0', '#3D6FB4', '#27508C', '#41639E'];
  rows.forEach((row, ri) => {
    for (let i = 0; i < row.n; i++) {
      const x = (w / (row.n + 1)) * (i + 1) + (ri % 2 ? 18 : -18);
      const bw = 42 * row.s, bh = 70 * row.s, hr = 15 * row.s;
      figures.push(`<rect x="${x - bw / 2}" y="${row.y}" width="${bw}" height="${bh}" rx="${bw * 0.4}" fill="${cloth[(i + ri) % 4]}"/>`);
      figures.push(`<circle cx="${x}" cy="${row.y - hr * 0.4}" r="${hr}" fill="${skin[(i * 2 + ri) % 4]}"/>`);
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8FC7E8"/><stop offset="55%" stop-color="#CDE7F2"/><stop offset="100%" stop-color="#EAD9B0"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/>
    <circle cx="${w * 0.8}" cy="${h * 0.22}" r="${h * 0.11}" fill="#FFF3C4" opacity="0.9"/>
    <rect x="0" y="${h * 0.58}" width="${w}" height="${h * 0.42}" fill="#6E8B4A"/>
    <rect x="0" y="${h * 0.58}" width="${w}" height="${h * 0.06}" fill="#7C9A54"/>
    ${figures.join('')}
  </svg>`;
  toPng(svg, path, w);
  return path;
}

// School emblem monogram.
export function makeLogo(path, monogram = 'SN', size = 240) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 6}" fill="#FFFFFF" stroke="#1E3A5F" stroke-width="8"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 22}" fill="none" stroke="#E0A83B" stroke-width="4"/>
    <path d="M${size * 0.3} ${size * 0.62} Q${size / 2} ${size * 0.5} ${size * 0.7} ${size * 0.62}" fill="none" stroke="#1E3A5F" stroke-width="6"/>
    <text x="${size / 2}" y="${size * 0.52}" font-family="Poppins" font-weight="700" font-size="${size * 0.3}" fill="#1E3A5F" text-anchor="middle">${monogram}</text>
    <text x="${size / 2}" y="${size * 0.78}" font-family="Lato" font-weight="700" font-size="${size * 0.09}" fill="#E0A83B" text-anchor="middle" letter-spacing="2">SCHOOL</text>
  </svg>`;
  toPng(svg, path, size);
  return path;
}

// LEAD co-brand wordmark.
export function makeLeadLogo(path, w = 300, h = 110) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect x="4" y="20" width="${w - 8}" height="${h - 40}" rx="14" fill="#101826"/>
    <text x="${w / 2}" y="${h * 0.58}" font-family="Poppins" font-weight="700" font-size="46" fill="#FFFFFF" text-anchor="middle" letter-spacing="4">LEAD</text>
    <rect x="${w * 0.28}" y="${h * 0.68}" width="${w * 0.44}" height="6" rx="3" fill="#E0A83B"/>
  </svg>`;
  toPng(svg, path, w);
  return path;
}
