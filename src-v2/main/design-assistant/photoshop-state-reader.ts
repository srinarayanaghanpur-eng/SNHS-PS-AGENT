// Photoshop state reader.
//
// Reads the active document / active layer through the shared transport, using
// the non-destructive assistant-analyze.jsx resource. Returns a typed
// SceneGraph via the document-analyzer normaliser. Also exposes a lightweight
// active-layer read for "this / selected / current" commands (§ Active-layer
// support).

import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { baseFolder } from '../storage';
import { detectEnvironment, environmentError } from '../environment';
import { runJsx, photoshopResource } from './ps-transport';
import { buildSceneGraph, findLayer } from './document-analyzer';
import type { SceneGraph, SceneLayer } from './types';

export class PhotoshopUnavailableError extends Error {}

async function ensurePhotoshop(): Promise<void> {
  const env = await detectEnvironment();
  const err = environmentError(env);
  if (err) throw new PhotoshopUnavailableError(err);
}

// Read + normalise the active document into a SceneGraph.
export async function readSceneGraph(): Promise<SceneGraph> {
  await ensurePhotoshop();
  const jobId = `assist-scan-${randomUUID()}`;
  const outputDir = join(baseFolder(), 'Jobs', jobId, 'output');
  await mkdir(outputDir, { recursive: true });

  const source = photoshopResource('assistant-analyze.jsx');
  const template = await readFile(source, 'utf8');
  const jsxSource = template.replace('__SNHS_OUTPUT__', outputDir.replace(/\\/g, '/'));

  const { raw } = await runJsx<any>({
    outputDir,
    jsxPath: join(outputDir, 'analyze.jsx'),
    jsxSource,
    resultFileName: 'analysis-result.json',
    vbsTimeoutMs: 120_000,
    resultTimeoutMs: 30_000,
  });
  if (!raw || raw.success !== true) {
    throw new Error(`${raw?.code ?? 'LAYER_ANALYSIS_FAILED'}: ${raw?.details ?? 'unknown'}`);
  }
  return buildSceneGraph(raw);
}

export interface ActiveLayerInfo {
  documentName: string;
  activeLayerId: number | null;
  activeLayer: SceneLayer | null;
}

export async function readActiveLayer(): Promise<ActiveLayerInfo> {
  const scene = await readSceneGraph();
  return {
    documentName: scene.document.name,
    activeLayerId: scene.activeLayerId,
    activeLayer: scene.activeLayerId != null ? findLayer(scene, scene.activeLayerId) : null,
  };
}
