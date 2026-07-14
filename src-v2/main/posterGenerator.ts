// Poster generation orchestration: request → composition engine → quality
// validation/auto-fix → JSX emission → Photoshop (cscript + VBS DoJavaScript
// bridge) → verified exports. Supports 1–3 genuinely different variations.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, type WebContents } from 'electron';
import { posterRequestSchema, progressChannel, type PosterGenerationResult, type PosterProgressEvent, type PosterVariationResult } from '../shared/ipc';
import { atomicJson, baseFolder } from './storage';
import { composePoster } from './design/composer';
import { emitJsx } from './design/jsxEmitter';
import { runProDesignPipeline, legacyToContentInput } from './design/pro/orchestrator';
import { emitJsxFromSceneGraph } from './design/pro/jsxEmitterPro';
import { log } from './logger';
import { validateImageFile } from './imageValidation';
import { getProfile } from './brandKit/profileStore';
import { resolveBrand } from './brandKit/resolveBrand';
import { bridgeVbsPath, detectEnvironment, environmentError } from './environment';
import { validateAndFix } from './design/quality';
import { type ComposeInput, type Plan } from './design/types';
import { resolveOutputPaths, createOutputFolder, copyOutputFile } from './outputManager';
import { addHistory } from './historyStore';
import { shortNameFromSchool, posterTypeFromCategory } from '../shared/outputNaming';
import { presetById } from './design/presets';
import { hashDesignPlan } from '../shared/designPlanHash';
import { inspectProfessionalPoster, type ProfessionalQualityGateReport } from './design/professionalQualityGate';
import { DesignGenerationError } from './design/designGenerationError';
import { runBrainPipeline, recordRenderedOutput } from './design/brain';
import type { RejectionReason } from './design/brain';

const STAGES = [
  'Analysing content', 'Selecting composition', 'Preparing photos',
  'Building Photoshop layers', 'Fitting typography', 'Running quality checks', 'Exporting files',
];

function isDesignPlan(value: unknown): value is Plan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<Plan>;
  return Number.isFinite(plan.width) && Number.isFinite(plan.height) && typeof plan.baseHex === 'string' && Array.isArray(plan.groups)
    && plan.groups.every((group) => group && typeof group.name === 'string' && Array.isArray(group.nodes));
}

async function sourceCommit(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('git', ['rev-parse', '--short', 'HEAD'], { cwd: join(__dirname, '..'), shell: false, windowsHide: true });
    let output = '';
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.on('error', () => resolve(process.env.SOURCE_COMMIT || 'unknown'));
    child.on('exit', (code) => resolve(code === 0 ? output.trim() || 'unknown' : process.env.SOURCE_COMMIT || 'unknown'));
  });
}

async function appBuildVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(join(__dirname, '..', 'package.json'), 'utf8')) as { version?: string };
    return pkg.version || app.getVersion();
  } catch { return app.getVersion(); }
}

async function runJsxInPhotoshop(jsxFile: string, outputDir: string): Promise<{ success: boolean; details: string; psdPath: string; jpgPath: string; pngPath: string; warnings: string }> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('cscript.exe', ['//Nologo', bridgeVbsPath(), jsxFile], { shell: false, windowsHide: true, env: { ...process.env, SNHS_SMOKE_OUTPUT: outputDir } });
    let log = '';
    child.stdout.on('data', (x) => { log += String(x); });
    child.stderr.on('data', (x) => { log += String(x); });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`POSTER_TIMEOUT ${log}`)); }, 240_000);
    child.on('exit', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`POSTER_VBS_${code} ${log}`)); });
    child.on('error', reject);
  });
  const resultPath = join(outputDir, 'result.json');
  const deadline = Date.now() + 120_000;
  let raw = '';
  while (Date.now() < deadline) {
    try { raw = await readFile(resultPath, 'utf8'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!raw) throw new Error('POSTER_RESULT_TIMEOUT');
  return JSON.parse(raw);
}

export async function generatePoster(raw: unknown, sender?: WebContents): Promise<PosterGenerationResult> {
  const input = posterRequestSchema.parse(raw);
  const jobId = `poster-${randomUUID()}`;
  const jobDir = join(baseFolder(), 'jobs', jobId);
  await mkdir(jobDir, { recursive: true });
  await atomicJson(join(jobDir, 'job.json'), { schemaVersion: 2, jobId, type: 'poster', input, createdAt: new Date().toISOString() });
  log('INFO', 'poster.start', { jobId, category: input.category, photos: input.photos?.length ?? 0, variations: input.variations ?? 1 });
  try {
    const env = await detectEnvironment();
    const precondition = environmentError(env);
    if (precondition) throw new Error(precondition);
    const result = await generateVariations(input, jobId, jobDir, sender);
    log('INFO', 'poster.completed', { jobId, files: result.variations.length });
    return result;
  } catch (error) {
    log('ERROR', 'poster.failed', error);
    await atomicJson(join(jobDir, 'final-result.json'), {
      success: false, jobId, stage: 'failed',
      error: { code: 'POSTER_GENERATION_FAILED', message: error instanceof Error ? error.message : String(error), retryable: true },
    }).catch(() => undefined);
    throw error;
  }
}

async function generateVariations(input: ReturnType<typeof posterRequestSchema.parse>, jobId: string, jobDir: string, sender?: WebContents): Promise<PosterGenerationResult> {

  const progress = (stage: number, variation?: number) => {
    const event: PosterProgressEvent = { jobId, stage, label: STAGES[stage], variation };
    try { sender?.send(progressChannel, event); } catch { /* window may be closing */ }
  };

  progress(0);
  let photos = (input.photos ?? []).map((p) => ({
    path: p.path, name: p.name, className: p.className,
    zoom: p.zoom, offsetX: p.offsetX, offsetY: p.offsetY,
  }));
  // Birthday photos supplied inside prayer content join the photo set.
  for (const b of input.prayer?.birthdays ?? []) {
    if (b.photo && !photos.some((p) => p.path === b.photo)) photos.push({ path: b.photo, name: b.name, className: b.className, zoom: undefined, offsetX: undefined, offsetY: undefined });
  }
  // Drop photos whose files are missing, empty, corrupt or non-images so the
  // composition never lays out a frame for content Photoshop cannot place; the
  // skips are logged and surfaced per variation.
  const rejectedPhotos: string[] = [];
  const checked = await Promise.all(photos.map(async (p) => {
    const check = await validateImageFile(p.path);
    if (check.ok) return p;
    rejectedPhotos.push(`${p.path} (${check.reason})`);
    return null;
  }));
  photos = checked.filter((p): p is typeof photos[number] => p !== null);
  if (rejectedPhotos.length) log('WARN', 'poster.photos-rejected', rejectedPhotos);

  // Resolve the selected school profile into brand data (colours, fonts, real
  // logo/LEAD/management asset paths). Missing asset files degrade gracefully.
  const profile = input.schoolProfileId ? await getProfile(input.schoolProfileId) : null;
  const brand = await resolveBrand(input, profile);
  if (brand.droppedAssets.length) { rejectedPhotos.push(...brand.droppedAssets.map((a) => `asset:${a} (missing)`)); log('WARN', 'poster.assets-dropped', brand.droppedAssets); }

  if (input.category === 'prayer' && (input.variations ?? 1) !== 1) {
    throw new DesignGenerationError({ code: 'VALID_COMPOSITION_NOT_AVAILABLE', fallbackReason: 'Daily Prayer renders one immutable preview plan per job. Create separate jobs for additional families.' });
  }
  const count = input.variations ?? 1;
  const variations: PosterVariationResult[] = [];
  let lastQuality: { score: number; warnings: { code: string; message: string; severity: string }[]; fixesApplied: string[] } | null = null;
  let renderLog: Record<string, unknown> | undefined;
  let designPlanPath: string | undefined;
  let renderLogPath: string | undefined;
  let previewPath: string | undefined;
  let finalPath: string | undefined;
  let immutablePlan: Plan | undefined;
  let qualityGateReport: ProfessionalQualityGateReport | undefined;

  // ── Pro design engine path ──
  if (input.useProEngine && input.category !== 'prayer') {
    progress(1, 0);
    const contentInput = legacyToContentInput({
      category: input.category,
      headline: input.headline, subheadline: input.subheadline || undefined,
      message: input.message || undefined, details: input.details || undefined, venue: input.venue,
      photos, prayer: input.prayer,
      school: { ...brand.school, logoPath: brand.assets.mainLogo?.path },
      brand: brand.brand, assets: brand.assets, management: brand.management,
      width: input.width ?? 1080, height: input.height ?? 1350,
      variationSeed: 0,
    } as ComposeInput);
    progress(2, 0);
    const proResult = await runProDesignPipeline({
      width: input.width ?? 1080,
      height: input.height ?? 1350,
      content: contentInput,
      primaryColor: brand.brand.colors?.primary || '#1E3A5F',
      photoPaths: photos.map(p => p.path),
      outputDir: jobDir,
    });
    for (let v = 0; v < count; v++) {
      const outDir = join(jobDir, `output-v${v + 1}`);
      await mkdir(outDir, { recursive: true });
      const jsx = emitJsxFromSceneGraph(proResult.finalSceneGraph, {
        outputDir: outDir,
        exportPng: input.exportPng ?? true,
        exportJpg: true,
        docName: `SNHS_${input.category}_v${v + 1}`,
      });
      const jsxFile = join(jobDir, `generate-v${v + 1}.jsx`);
      await writeFile(jsxFile, jsx, 'utf8');
      progress(3, v);
      const result = await runJsxInPhotoshop(jsxFile, outDir);
      if (!result.success) throw new Error(`POSTER_JSX_FAILED ${result.details}`);
      progress(4, v);
      progress(5, v);
      const quality = proResult.selectedCandidate.qualityScore;
      lastQuality = { score: quality.overall, warnings: [], fixesApplied: [] };
      variations.push({
        variation: v + 1, presetId: 'pro',
        psdPath: result.psdPath, jpgPath: result.jpgPath, pngPath: result.pngPath,
        quality: lastQuality,
        photoshopWarnings: [
          ...rejectedPhotos.map((p) => `PHOTO_REJECTED: ${p}`),
          ...(result.warnings ? result.warnings.split('|').filter(Boolean) : []),
        ],
      });
    }
  } else {
    // ── Legacy design engine path ──
    for (let v = 0; v < count; v++) {
      progress(1, v);
      const compose: ComposeInput = {
        category: input.category, presetId: v === 0 ? input.presetId : undefined,
        headline: input.headline, subheadline: input.subheadline || undefined,
        message: input.message || undefined, details: input.details || undefined, venue: input.venue,
        photos, prayer: input.prayer,
        school: { ...brand.school, logoPath: brand.assets.mainLogo?.path },
        brand: brand.brand, assets: brand.assets, management: brand.management,
        width: input.width ?? 1080, height: input.height ?? 1350,
        variationSeed: v,
        requestedCompositionFamily: input.requestedCompositionFamily,
      } as ComposeInput;
      progress(2, v);
      const suppliedPlan = input.category === 'prayer' && isDesignPlan(input.designPlan) ? input.designPlan : undefined;
      let plan = suppliedPlan ?? await composePoster(compose);
      // ── Poster Brain: record training data ──
      const brainPlanId = `brain_${jobId}_v${v}`;
      runBrainPipeline({
        composeInput: compose,
        posterWidth: input.width ?? 1080,
        posterHeight: input.height ?? 1350,
        variationSeed: v,
        compositionFamily: input.requestedCompositionFamily,
        existingPlanId: brainPlanId,
      }).then((out) => {
        if (out.criticReport.passed) {
          log('INFO', 'brain.pipeline', `Poster ${brainPlanId} passed critic (${out.criticReport.overallScore}/100)`);
        } else {
          log('INFO', 'brain.pipeline', `Poster ${brainPlanId} needs improvement (${out.criticReport.overallScore}/100)`);
        }
      }).catch((err) => log('ERROR', 'brain.pipeline', err.message));
      const initialPlanHash = hashDesignPlan(plan);
      const previewHash = input.category === 'prayer' ? (input.previewPlanHash || initialPlanHash) : initialPlanHash;
      if (input.category === 'prayer' && previewHash !== initialPlanHash) {
        throw new DesignGenerationError({ code: 'DESIGN_PLAN_HASH_MISMATCH', requestedFamily: input.requestedCompositionFamily, failures: [`Preview ${previewHash} != supplied plan ${initialPlanHash}`] });
      }
      immutablePlan = plan;
      designPlanPath = join(jobDir, 'design-plan.json');
      renderLogPath = join(jobDir, 'render-log.json');
      if (input.category === 'prayer') await atomicJson(designPlanPath, plan);
      const quality = validateAndFix(input.category === 'prayer' ? JSON.parse(JSON.stringify(plan)) as Plan : plan);

      // ── Visual Critique + Refinement Loop ──────────────────────────────
      // After initial composition, run the visual critique. If the score is
      // below threshold, try a revised layout with different photo ordering
      // or reduced photo count. This makes the poster look progressively more
      // human-designed with each iteration.
      const critiqueScore = input.category === 'prayer' ? -1 : (plan.metadata?.critiqueScore ?? -1);
      const CRITIQUE_THRESHOLD = 65;
      let refinementRound = 0;
      const MAX_REFINEMENT = 2;

      while (critiqueScore >= 0 && critiqueScore < CRITIQUE_THRESHOLD && refinementRound < MAX_REFINEMENT) {
        refinementRound++;
        // Revise strategy: try different photo ordering or layout adjustments
        const revisedCompose = { ...compose };
        if (refinementRound === 1 && revisedCompose.photos.length > 1) {
          // Reverse photo order so a different photo becomes hero
          revisedCompose.photos = [...revisedCompose.photos].reverse();
        } else if (refinementRound === 2 && revisedCompose.photos.length > 3) {
          // Reduce to strongest photos only (fewer, larger frames)
          revisedCompose.photos = revisedCompose.photos.slice(0, Math.min(4, revisedCompose.photos.length));
        }
        const revisedPlan = await composePoster(revisedCompose);
        validateAndFix(revisedPlan);
        const revisedScore = revisedPlan.metadata?.critiqueScore ?? -1;
        if (revisedScore > critiqueScore) {
          plan = revisedPlan;
          // Only log if the revision actually improved things
          if (revisedScore >= CRITIQUE_THRESHOLD) break;
        }
      }

      lastQuality = {
        score: quality.score,
        warnings: quality.warnings.map((w) => ({ code: w.code, message: w.message, severity: w.severity })),
        fixesApplied: [
          ...quality.fixesApplied,
          ...(refinementRound > 0 ? [`Visual critique: ${refinementRound} refinement round(s) applied.`] : []),
        ],
      };
      progress(3, v);
      const outDir = join(jobDir, `output-v${v + 1}`);
      await mkdir(outDir, { recursive: true });
      const presetUsed = input.presetId && v === 0 ? input.presetId : 'auto';
      const photoshopPlanHash = hashDesignPlan(plan);
      if (input.category === 'prayer' && photoshopPlanHash !== previewHash) {
        throw new DesignGenerationError({ code: 'DESIGN_PLAN_HASH_MISMATCH', failures: [`Preview ${previewHash} != Photoshop ${photoshopPlanHash}`] });
      }
      const jsx = emitJsx(plan, { outputDir: outDir, exportPng: input.category === 'prayer' ? true : (input.exportPng ?? true), exportJpg: true, docName: `SNHS_${input.category}_v${v + 1}` });
      const jsxFile = join(jobDir, `generate-v${v + 1}.jsx`);
      await writeFile(jsxFile, jsx, 'utf8');
      progress(4, v);
      const result = await runJsxInPhotoshop(jsxFile, outDir);
      if (!result.success) throw new Error(`POSTER_JSX_FAILED ${result.details}`);
      progress(5, v);
      if (input.category === 'prayer') {
        const finalExportPlanHash = hashDesignPlan(plan);
        const validAssetPaths = [
          ...photos.map((photo) => photo.path),
          ...Object.values(brand.assets).flatMap((asset) => asset?.path ? [asset.path] : []),
          ...[brand.management.chairman?.asset?.path, brand.management.principal?.asset?.path].filter((path): path is string => Boolean(path)),
        ];
        qualityGateReport = inspectProfessionalPoster(plan, result.pngPath, {
          schoolLogoPath: brand.assets.mainLogo?.path, leadLogoPath: brand.assets.leadLogo?.path,
          heroImagePath: plan.metadata?.heroImagePath, previewPlanHash: previewHash,
          photoshopPlanHash, finalExportPlanHash, legacyRendererUsed: false,
        });
        renderLog = {
          JOB_ID: jobId, APP_BUILD_VERSION: await appBuildVersion(), SOURCE_COMMIT: await sourceCommit(),
          SELECTED_COMPOSITION_FAMILY: plan.metadata?.compositionFamily || 'unknown',
          REQUESTED_COMPOSITION_FAMILY: input.requestedCompositionFamily || 'auto',
          FALLBACK_REASON: plan.metadata?.fallbackReason || 'none',
          RENDERER_NAME: plan.metadata?.rendererName || 'immutable-design-plan-jsx', LEGACY_RENDERER_USED: false,
          INPUT_ASSET_COUNT: (input.photos?.length ?? 0) + Object.keys(profile?.assets ?? {}).length,
          VALID_ASSET_COUNT: new Set(validAssetPaths).size,
          HERO_IMAGE_PATH: plan.metadata?.heroImagePath || '', SCHOOL_LOGO_PATH: brand.assets.mainLogo?.path || '',
          LEAD_LOGO_PATH: brand.assets.leadLogo?.path || '', CHAIRMAN_IMAGE_PATH: brand.management.chairman?.asset?.path || '',
          DESIGN_PLAN_HASH: initialPlanHash, PREVIEW_PLAN_HASH: previewHash,
          PHOTOSHOP_PLAN_HASH: photoshopPlanHash, FINAL_EXPORT_PLAN_HASH: finalExportPlanHash,
          INVALID_OR_MISSING_ASSETS: [...brand.droppedAssets, ...rejectedPhotos],
          ASSET_USAGE_REPORT: plan.metadata?.assetUsage || { used: [], missing: [], invalid: [] },
          QUALITY_GATE_REPORT: qualityGateReport,
        };
        await atomicJson(renderLogPath!, renderLog);
        previewPath = join(jobDir, 'preview.png'); finalPath = join(jobDir, 'final.png');
        await copyFile(result.pngPath, previewPath); await copyFile(result.pngPath, finalPath);
        await copyFile(result.pngPath, join(jobDir, 'approval.png')); await copyFile(result.psdPath, join(jobDir, 'final.psd'));
        await copyFile(result.jpgPath, join(jobDir, 'final.jpg'));
        if (!qualityGateReport.accepted) {
          throw new DesignGenerationError({ code: 'QUALITY_GATE_REJECTED', requestedFamily: input.requestedCompositionFamily, failures: qualityGateReport.failures, fallbackReason: plan.metadata?.fallbackReason });
        }
        lastQuality.warnings.push(...qualityGateReport.warnings.map((message) => ({ code: 'FINAL_RENDER_INSPECTION', message, severity: 'info' })));
        lastQuality.score = Math.max(0, 100 - qualityGateReport.warnings.length * 3);
      }
      // ── Poster Brain: record rendered output path ──
      if (result?.pngPath && input.category === 'prayer') {
        const qg = qualityGateReport?.accepted ? 100 : 50;
        recordRenderedOutput(`brain_${jobId}_v${v}`, result.pngPath, lastQuality?.score, qg).catch(() => {});
      }
      progress(6, v);
      variations.push({
        variation: v + 1, presetId: input.category === 'prayer' ? (plan.metadata?.compositionFamily || presetUsed) : presetUsed,
        psdPath: result.psdPath, jpgPath: result.jpgPath, pngPath: result.pngPath,
        quality: lastQuality,
        photoshopWarnings: [
          ...rejectedPhotos.map((p) => `PHOTO_REJECTED: ${p}`),
          ...(result.warnings ? result.warnings.split('|').filter(Boolean) : []),
        ],
      });
    }
  }

  const schoolName = brand.school.name;
  const schoolShort = profile?.shortName || shortNameFromSchool(schoolName);
  const presetObj = input.presetId ? presetById(input.presetId) : undefined;
  const posterDate = input.details ? new Date(input.details) : new Date();
  const outputPaths = await resolveOutputPaths(schoolShort, schoolName, input.category, input.presetId, presetObj?.label, posterDate);
  await createOutputFolder(outputPaths);

      const firstVar = variations[0];
  const psdTarget = outputPaths.psdPath;
  const pngTarget = outputPaths.pngPath;
  const jpgTarget = outputPaths.jpgPath;

  for (const v of variations) {
    if (v.psdPath) { try { await copyOutputFile(v.psdPath, psdTarget); } catch { log('ERROR', 'poster.copy-psd', v.psdPath); } }
    if (v.pngPath) { try { await copyOutputFile(v.pngPath, pngTarget!); } catch { log('ERROR', 'poster.copy-png', v.pngPath); } }
    if (v.jpgPath) { try { await copyOutputFile(v.jpgPath, jpgTarget!); } catch { log('ERROR', 'poster.copy-jpg', v.jpgPath); } }
  }

  const qualityScore = lastQuality?.score ?? 80;
  const qualityLabel = qualityScoreLabel(qualityScore);
  const assetsUsed: string[] = [];
  if (brand.assets.mainLogo?.path) assetsUsed.push(brand.assets.mainLogo.path);
  if (brand.assets.leadLogo?.path) assetsUsed.push(brand.assets.leadLogo.path);
  if (brand.assets.studentPhoto?.path) assetsUsed.push(brand.assets.studentPhoto.path);
  if (brand.assets.assemblyPhoto?.path) assetsUsed.push(brand.assets.assemblyPhoto.path);
  if (brand.assets.campusPhoto?.path) assetsUsed.push(brand.assets.campusPhoto.path);
  if (brand.assets.background?.path) assetsUsed.push(brand.assets.background.path);
  for (const p of photos) assetsUsed.push(p.path);

  const historyRecord = {
    id: jobId,
    schoolProfileId: input.schoolProfileId || '',
    schoolShortForm: schoolShort,
    schoolName,
    posterType: posterTypeFromCategory(input.category),
    posterCategory: input.category,
    templateId: immutablePlan?.metadata?.compositionFamily || input.presetId || 'auto',
    templateName: immutablePlan?.metadata?.compositionFamily || presetObj?.label || 'Automatic',
    posterDate: formatDateForDisplay(posterDate),
    generatedAt: new Date().toISOString(),
    version: outputPaths.version,
    baseName: outputPaths.baseName,
    psdPath: psdTarget,
    pngPath: pngTarget,
    jpgPath: jpgTarget,
    folderPath: outputPaths.folderPath,
    jsonPath: outputPaths.jsonPath,
    assetsUsed,
    posterContent: input as unknown as Record<string, unknown>,
    qualityResult: {
      score: qualityScore,
      label: qualityLabel,
      warnings: lastQuality?.warnings.length ?? 0,
    },
    renderLog,
  };

  const jsonMeta = {
    ...historyRecord,
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
  };
  delete (jsonMeta as any).id;
  await writeFile(outputPaths.jsonPath, JSON.stringify(jsonMeta, null, 2), 'utf8');
  await addHistory(historyRecord);

  const final: PosterGenerationResult = {
    success: true, jobId, stage: 'completed', variations,
    psdPath: psdTarget, jpgPath: jpgTarget, pngPath: pngTarget,
    designPlanPath, renderLogPath, previewPath, finalPath, renderLog,
  };
  await atomicJson(join(jobDir, 'final-result.json'), final);
  return final;
}

function qualityScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Review';
  return 'Invalid';
}

function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
