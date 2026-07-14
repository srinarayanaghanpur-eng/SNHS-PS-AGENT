// Vertical slice: Morning Prayer Assembly + one hero photo.
// Full pipeline: DesignPlan -> compose -> render -> quality gate -> mobile preview.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { derivePalette, typographyPairing } from './theme.mjs';
import { buildDesignPlan } from './planner.mjs';
import { composeHeroEditorial } from './family_heroEditorial.mjs';
import { renderPng } from './engine.mjs';
import { runQualityGate } from './qualityGate.mjs';
import { makeHeroPhoto, makeLogo, makeLeadLogo } from './placeholders.mjs';

const outDir = resolve(process.argv[2] || './studio-output');
const assetDir = join(outDir, 'assets');
mkdirSync(assetDir, { recursive: true });

// --- generate placeholder assets (real runs replace these with uploads) ---
const heroPath = makeHeroPhoto(join(assetDir, 'hero.png'));
const logoPath = makeLogo(join(assetDir, 'school-logo.png'));
const leadPath = makeLeadLogo(join(assetDir, 'lead-logo.png'));

// --- content ---
const content = {
  school: {
    name: 'SRI NARAYANA HIGH SCHOOL',
    address: 'Ghanpur (M), Jayashankar Bhupalpally Dist.',
    phone: '6300038389',
    academicYear: 'Academic Year 2026–27',
  },
  title: 'Morning Prayer Assembly',
  subtitle: '“A meaningful start to every day.”',
  date: 'MONDAY · 21 JULY 2026',
  schedule: [
    'Prayer Song', 'Pledge', 'Thought for the Day', 'News Headlines',
    'Word of the Day', 'Quiz Question', 'Birthday Wishes',
    'Principal’s Message', 'National Anthem',
  ],
  leadBranding: 'Powered by LEAD Curriculum',
  management: [],
};

const assets = { hero: heroPath, schoolLogo: logoPath, leadLogo: leadPath };

const width = 1080, height = 1350;
const palette = derivePalette('#1E3A5F', 'prayer');
const typo = typographyPairing();

const plan = buildDesignPlan({ width, height, content, assets, palette, typo, family: 'hero-editorial', seed: 1 });
const scene = composeHeroEditorial({ plan, content, assets, palette, typo });

const { png } = renderPng(scene, width);
writeFileSync(join(outDir, 'poster.png'), png);

// mobile preview 270x338
const { png: mobile } = renderPng(scene, 270);
writeFileSync(join(outDir, 'poster-mobile.png'), mobile);

const gate = await runQualityGate({ pngBuffer: png, scene, plan, content, palette });
plan.mobileReadabilityEstimate = gate.mobileReadability;

writeFileSync(join(outDir, 'design-plan.json'), JSON.stringify(plan, null, 2));
writeFileSync(join(outDir, 'quality-report.json'), JSON.stringify(gate, null, 2));

console.log('QUALITY GATE:', gate.pass ? 'PASS' : 'FAIL');
if (!gate.pass) console.log('Reasons:', gate.reasons);
console.log('Checks:', JSON.stringify(gate.checks));
console.log('Output:', outDir);
