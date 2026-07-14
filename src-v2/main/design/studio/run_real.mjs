// Render the Hero family with REAL uploaded school assets.
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { derivePalette, typographyPairing } from './theme.mjs';
import { composeHero } from './family_hero.mjs';
import { renderPng } from './engine.mjs';
import { analysePhoto, keyWhiteToAlpha } from './photoPipeline.mjs';
import { createStoragePaths } from '../../storage/storagePaths.mjs';

const runtime = createStoragePaths();
const assetDir = process.argv[2] || runtime.assetsEventPhotos;
const outDir = resolve(process.argv[3] || join(runtime.acceptance, `studio-real-${Date.now()}`));
const pyDir = process.argv[4] || new URL('.', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

// flexible asset resolution
const files = existsSync(assetDir) ? readdirSync(assetDir) : [];
const find = (re) => { const f = files.find((n) => re.test(n)); return f ? join(assetDir, f) : null; };
const schoolLogo = find(/school.*logo|logo.*school/i);
let leadLogo = find(/lead/i);
const hero = find(/hero(?!-portrait)/i);

// preprocess LEAD (white bg -> transparent), place processed copy in outDir
if (leadLogo) {
  const keyed = join(outDir, 'lead-keyed.png');
  try { await keyWhiteToAlpha(leadLogo, keyed); leadLogo = keyed; } catch {}
}

const width = 1080, height = 1350;
const analysis = hero ? analysePhoto(pyDir, hero, width, Math.round(height * 0.36)) : null;

const content = {
  school: {
    name: 'SRI NARAYANA HIGH SCHOOL',
    branch: 'Ghanpur Campus',
    address: 'Ghanpur (M), Jayashankar Bhupalpally Dist., Telangana',
    phone: '6300038389',
    academicYear: 'A.Y. 2026-27',
    motto: 'Knowledge · Discipline · Character',
  },
  event: {
    type: 'prayer',
    title: 'Morning Prayer Assembly',
    titleCase: 'auto',
    subtitle: 'A meaningful start to every day',
    date: 'Monday, 21 July 2026',
    schedule: [
      'Prayer Song', 'Pledge', 'Thought for the Day', 'News Headlines',
      'Word of the Day', 'Quiz Question', 'Birthday Wishes',
      "Principal's Message", 'National Anthem',
    ],
  },
  assets: { management: [] },
};

const palette = derivePalette('#1E3A5F', content.event.type);
const typo = typographyPairing();
const assets = { schoolLogo, leadLogo, hero };

const { scene, meta } = composeHero({ width, height, content, assets, palette, typo, analysis });
const { png } = renderPng(scene, width);
writeFileSync(join(outDir, 'poster.png'), png);
const { png: mobile } = renderPng(scene, 270);
writeFileSync(join(outDir, 'poster-mobile.png'), mobile);
writeFileSync(join(outDir, 'analysis.json'), JSON.stringify(analysis, null, 2));
writeFileSync(join(outDir, 'meta.json'), JSON.stringify({ meta, assetsUsed: { schoolLogo, leadLogo, hero } }, null, 2));

console.log('MODE:', meta.mode, '| schedule:', meta.scheduleMode, 'minSize', meta.scheduleMinSize, 'overflow', meta.scheduleOverflow);
console.log('ANALYSIS:', JSON.stringify({ faces: analysis?.faces, scrim: analysis?.recommendedScrim, clearBottom: analysis?.clearBottomFrac, focus: analysis?.cropFocus }));
console.log('ASSETS:', { schoolLogo: !!schoolLogo, leadLogo: !!leadLogo, hero: !!hero });
console.log('OUT:', outDir);
