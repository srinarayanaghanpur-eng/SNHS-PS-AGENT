import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { assertContained, createStoragePaths } from '../src-v2/main/storage/storagePaths.mjs';

const [name, sourceArg, outputArg] = process.argv.slice(2);
if (!name || !sourceArg) {
  throw new Error('Usage: node scripts/collectAcceptanceArtifacts.mjs <name> <job-dir> [E-drive-acceptance-root]');
}

const runtime = createStoragePaths();
const outputRoot = outputArg ? assertContained(runtime.root, resolve(outputArg)) : runtime.acceptance;
const source = resolve(sourceArg); const destination = resolve(outputRoot, name);
await mkdir(destination, { recursive: true });

const copies = [
  ['final.png', 'final.png'], ['final.png', 'screenshot.png'], ['final.jpg', 'final.jpg'],
  ['final.psd', 'final.psd'], ['preview.png', 'preview.png'], ['approval.png', 'approval.png'],
  ['design-plan.json', 'design-plan.json'], ['render-log.json', 'render-log.json'],
];
for (const [from, to] of copies) await copyFile(join(source, from), join(destination, to));

const renderLog = JSON.parse(await readFile(join(source, 'render-log.json'), 'utf8'));
await writeFile(join(destination, 'quality-gate-report.json'), JSON.stringify(renderLog.QUALITY_GATE_REPORT, null, 2), 'utf8');
await writeFile(join(destination, 'asset-usage-report.json'), JSON.stringify({
  inputAssetCount: renderLog.INPUT_ASSET_COUNT,
  validAssetCount: renderLog.VALID_ASSET_COUNT,
  heroImagePath: renderLog.HERO_IMAGE_PATH,
  schoolLogoPath: renderLog.SCHOOL_LOGO_PATH,
  leadLogoPath: renderLog.LEAD_LOGO_PATH,
  chairmanImagePath: renderLog.CHAIRMAN_IMAGE_PATH,
  invalidOrMissingAssets: renderLog.INVALID_OR_MISSING_ASSETS,
  usage: renderLog.ASSET_USAGE_REPORT,
}, null, 2), 'utf8');
await writeFile(join(destination, 'acceptance-summary.json'), JSON.stringify({
  test: name,
  selectedFamily: renderLog.SELECTED_COMPOSITION_FAMILY,
  requestedFamily: renderLog.REQUESTED_COMPOSITION_FAMILY,
  renderer: renderLog.RENDERER_NAME,
  legacyRendererUsed: renderLog.LEGACY_RENDERER_USED,
  planHashesMatch: renderLog.DESIGN_PLAN_HASH === renderLog.PREVIEW_PLAN_HASH
    && renderLog.PREVIEW_PLAN_HASH === renderLog.PHOTOSHOP_PLAN_HASH
    && renderLog.PHOTOSHOP_PLAN_HASH === renderLog.FINAL_EXPORT_PLAN_HASH,
  qualityGateAccepted: renderLog.QUALITY_GATE_REPORT?.accepted === true,
}, null, 2), 'utf8');

process.stdout.write(`${destination}\n`);
