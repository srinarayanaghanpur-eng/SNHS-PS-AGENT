// Render photoCollageSchoolEvent (Daily Prayer Proceedings) with real assets +
// labelled PENDING frames for photos not yet uploaded (layout proof).
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { derivePalette, typographyPairing } from './theme.mjs';
import { composeCollage } from './family_collage.mjs';
import { renderPng } from './engine.mjs';
import { keyWhiteToAlpha } from './photoPipeline.mjs';
import { createStoragePaths } from '../../storage/storagePaths.mjs';

const runtime = createStoragePaths();
const assetDir = process.argv[2] || runtime.assetsEventPhotos;
const outDir = resolve(process.argv[3] || join(runtime.acceptance, `studio-collage-${Date.now()}`));
mkdirSync(outDir, { recursive: true });

const files = existsSync(assetDir) ? readdirSync(assetDir) : [];
const find = (re) => { const f = files.find((n) => re.test(n)); return f ? join(assetDir, f) : null; };
const prog = (i) => find(new RegExp(`prog0?${i}\\.`, 'i')) || find(new RegExp(`programme?0?${i}\\.`, 'i'));

let leadLogo = find(/lead/i);
if (leadLogo) { const k = join(outDir, 'lead-keyed.png'); try { await keyWhiteToAlpha(leadLogo, k); leadLogo = k; } catch {} }

const assets = {
  schoolLogo: find(/school.*logo|logo.*school/i),
  groupLogo: find(/group/i),
  leadLogo,
  chairman: find(/chairman/i),
  hero: find(/hero(?!-portrait)/i),
};
const roles = {
  leftFeature: find(/prayer|leader|support1/i),
  rightTop: find(/award|achiev/i),
  rightBottom: find(/birthday/i),
  lowerGallery: [1, 2, 3, 4, 5, 6, 7].map(prog).filter(Boolean),
};

const content = {
  school: {
    name: 'Sri Narayana High School',
    recognition: 'Recognised by the Government of Telangana',
    address: 'Ghanpur (M), Jayashankar Bhupalpally District',
    group: 'Sri Adarshavani Group of Schools',
    branches: ['Ghanpur', 'Duggondi', 'Nallabelly'],
    phones: ['6300038389', '8121063032', '9032480165'],
  },
  event: {
    type: 'prayer',
    title: 'Daily Prayer Proceedings',
    date: '13 July 2026', day: 'Monday',
    chairman: { name: 'N. Ravi', role: 'Chairman' },
  },
  quote: '“Education turns today’s dreams into tomorrow’s achievements.”',
  footerQuote: '“Education is not the learning of facts, but the training of the mind to think.”',
  programme: ['Prayer Song', 'Pledge', "Today's News", 'Thought of the Day', 'Quiz', 'Birthday Wishes'],
};

const width = 1080, height = 1350;
const palette = derivePalette('#1E3A5F', 'prayer');
const typo = typographyPairing();
const { scene, meta } = composeCollage({ width, height, content, assets, palette, typo, roles });
const { png } = renderPng(scene, width);
writeFileSync(join(outDir, 'poster.png'), png);
writeFileSync(join(outDir, 'poster-mobile.png'), renderPng(scene, 270).png);

const present = Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, !!v]));
console.log('COLLAGE meta:', JSON.stringify(meta));
console.log('assets present:', JSON.stringify(present), 'gallery real:', roles.lowerGallery.length);
console.log('OUT:', outDir);
