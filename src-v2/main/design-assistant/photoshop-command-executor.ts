// Photoshop command executor.
//
// Runs a validated ActionPlan against the live document by generating targeted
// JSX (jsx-operations) and dispatching it through the shared transport. Creates
// a named history snapshot before each command and returns a structured result
// (§ Photoshop execution). Operations are atomic per target: the JSX takes a
// snapshot first and reports failure without leaving partial edits committed by
// the assistant's own wrapper.

import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { baseFolder } from '../storage';
import { log } from '../logger';
import { runJsx } from './ps-transport';
import { emitExecuteJsx, emitReplaceBackgroundJsx } from './jsx-operations';
import { computeCover, computeContain } from './background-replacer';
import { validateDownloadedAsset } from './asset-validator';
import { readSceneGraph } from './photoshop-state-reader';
import { mapScene } from './semantic-layer-mapper';
import type { ActionPlan, ExecutionResult } from './types';

const jsxResultSchema = z.object({
  success: z.boolean(),
  details: z.string().default(''),
  previewPath: z.string().default(''),
  checkpointId: z.string().default(''),
  modifiedLayerIds: z.array(z.number()).default([]),
  warnings: z.array(z.string()).default([]),
});

export interface ExecuteOptions {
  checkpointName: string;
  previewPng?: boolean;
  trueDelete?: boolean;
}

export async function executePlan(plan: ActionPlan, opts: ExecuteOptions): Promise<ExecutionResult> {
  const jobId = `assist-${randomUUID()}`;
  const outputDir = join(baseFolder(), 'Jobs', jobId, 'output');
  await mkdir(outputDir, { recursive: true });

  // One target at a time keeps the atomic guarantee simple and reversible.
  const modified: number[] = [];
  const warnings: string[] = [];
  let previewPath: string | undefined;
  try {
    for (const target of plan.targets) {
      const jsx = emitExecuteJsx(plan, target.layerId, {
        outputDir,
        previewPng: opts.previewPng ?? plan.requiresPreview,
        checkpointName: opts.checkpointName,
        trueDelete: opts.trueDelete,
      });
      const { raw } = await runJsx({ outputDir, jsxPath: join(outputDir, `exec-${target.layerId}.jsx`), jsxSource: jsx });
      const result = jsxResultSchema.parse(raw);
      if (!result.success) {
        return { success: false, modifiedLayerIds: modified, warnings: [...warnings, ...result.warnings], error: result.details || 'PS_OPERATION_FAILED', checkpointId: opts.checkpointName };
      }
      modified.push(...result.modifiedLayerIds);
      warnings.push(...result.warnings);
      if (result.previewPath) previewPath = result.previewPath;
    }
    log('INFO', 'design-assistant.executePlan', { command: plan.command, modified });
    return { success: true, modifiedLayerIds: modified, warnings, previewPath, checkpointId: opts.checkpointName };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('ERROR', 'design-assistant.executePlan.failed', { command: plan.command, message });
    return { success: false, modifiedLayerIds: modified, warnings, error: message, checkpointId: opts.checkpointName };
  }
}

export interface BackgroundReplaceOptions {
  assetPath: string;
  fit?: 'cover' | 'contain';
  checkpointName: string;
  previewPng?: boolean;
}

// Dedicated background-replacement flow (§ Background replacement workflow):
// checkpoint → import as Smart Object → cover-fit without stretching → move
// below all content → hide (not delete) the previous background → preview.
export async function executeBackgroundReplacement(opts: BackgroundReplaceOptions): Promise<ExecutionResult> {
  // Validate the asset and read its real pixel dimensions.
  const asset = await validateDownloadedAsset(opts.assetPath);
  if (!asset.ok) return { success: false, modifiedLayerIds: [], warnings: [], error: `INVALID_ASSET: ${asset.reason}`, checkpointId: opts.checkpointName };

  // Read the live document to get canvas size + the current background layer id.
  let scene;
  try { scene = await readSceneGraph(); }
  catch (e) { return { success: false, modifiedLayerIds: [], warnings: [], error: (e as Error).message, checkpointId: opts.checkpointName }; }

  const matches = mapScene(scene);
  const bg = matches
    .filter((m) => m.role === 'background')
    .sort((a, b) => b.confidence - a.confidence)[0];
  const previousBackgroundId = bg ? bg.layerId : null;

  const iw = asset.width; const ih = asset.height;
  const cover = (iw && ih)
    ? (opts.fit === 'contain' ? computeContain(iw, ih, scene.document.width, scene.document.height)
                              : computeCover(iw, ih, scene.document.width, scene.document.height))
    : null;

  const jobId = `assist-bg-${randomUUID()}`;
  const outputDir = join(baseFolder(), 'Jobs', jobId, 'output');
  await mkdir(outputDir, { recursive: true });

  // When we could not read the image dimensions (e.g. WebP), fall back to a
  // 100% place and let Photoshop's own cover transform run; scale/offset 0.
  const jsx = emitReplaceBackgroundJsx({
    outputDir,
    assetPath: opts.assetPath,
    scalePercent: cover ? cover.scalePercent : 100,
    offsetX: cover ? cover.offsetX : 0,
    offsetY: cover ? cover.offsetY : 0,
    previousBackgroundId,
    checkpointName: opts.checkpointName,
    previewPng: opts.previewPng ?? true,
  });

  try {
    const { raw } = await runJsx<any>({ outputDir, jsxPath: join(outputDir, 'replace-bg.jsx'), jsxSource: jsx });
    const result = jsxResultSchema.parse(raw);
    if (!result.success) return { success: false, modifiedLayerIds: [], warnings: result.warnings, error: result.details || 'BACKGROUND_REPLACE_FAILED', checkpointId: opts.checkpointName };
    log('INFO', 'design-assistant.replaceBackground', { asset: opts.assetPath, previousBackgroundId });
    return { success: true, modifiedLayerIds: result.modifiedLayerIds, warnings: result.warnings, previewPath: result.previewPath || undefined, checkpointId: opts.checkpointName };
  } catch (error) {
    return { success: false, modifiedLayerIds: [], warnings: [], error: error instanceof Error ? error.message : String(error), checkpointId: opts.checkpointName };
  }
}
