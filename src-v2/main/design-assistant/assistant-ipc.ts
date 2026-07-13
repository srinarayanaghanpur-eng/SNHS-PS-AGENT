// Design Assistant IPC registration.
//
// Additive IPC surface for the Live Design Assistant. All inputs are validated
// with zod before use; no arbitrary JSX or shell is accepted from the renderer.
// This wires the renderer to the supervisor, asset scout/downloader, history
// and version services, reusing existing storage/transport.

import { randomUUID } from 'node:crypto';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { app, ipcMain, type BrowserWindow } from 'electron';
import { z } from 'zod';
import { channels, assistantCommandSchema, assistantSearchSchema, assistantDownloadSchema, assistantReplaceBackgroundSchema } from '../../shared/ipc';
import { baseFolder } from '../storage';
import { log } from '../logger';
import { CreativeSupervisor } from './creative-supervisor';
import { SessionStore } from './assistant-session-store';
import { readSceneGraph, readActiveLayer } from './photoshop-state-reader';
import { scout, type ScoutConfig } from './asset-scout';
import { downloadAsset } from './asset-downloader';
import { runJsx } from './ps-transport';
import { executeBackgroundReplacement } from './photoshop-command-executor';
import { checkpointName } from './history-manager';
import { emitRevertToSnapshot, emitSaveVersion } from './jsx-history';
import { validateActionPlan } from './execution-planner';
import { versionName } from './history-manager';

let session: SessionStore | null = null;
let supervisor: CreativeSupervisor | null = null;
let versionCounter = 0;

function config() {
  return {
    gemini: { apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL },
    pexelsApiKey: process.env.PEXELS_API_KEY,
    liveApply: false,
  };
}

function ensureSession(): { session: SessionStore; supervisor: CreativeSupervisor } {
  if (!session || !supervisor) {
    session = new SessionStore();
    supervisor = new CreativeSupervisor(session, {
      liveApply: config().liveApply,
      gemini: config().gemini,
      mapperContext: {},
    });
    // Attach history so undo/redo/restore and background checkpoints are tracked.
    supervisor.attachHistory('poster-original.psd');
  }
  return { session, supervisor };
}

async function assetsDir(): Promise<string> {
  const dir = join(baseFolder(), 'Assets', 'assistant-downloads');
  await mkdir(dir, { recursive: true });
  return dir;
}

function scoutConfig(): ScoutConfig {
  return {
    libraryDirs: [join(baseFolder(), 'Assets'), join(baseFolder(), 'Templates')],
    approvedDirs: [join(baseFolder(), 'Brand')],
    pexelsApiKey: config().pexelsApiKey,
    allowBrowserFallback: true,
    max: 12,
  };
}

export function registerAssistantIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(channels.assistantReadState, async () => {
    try { return { ok: true, scene: await readSceneGraph() }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });

  ipcMain.handle(channels.assistantReadActiveLayer, async () => {
    try { return { ok: true, ...(await readActiveLayer()) }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });

  ipcMain.handle(channels.assistantCommand, async (_e, input) => {
    const { command, liveApply } = assistantCommandSchema.parse(input);
    const { supervisor } = ensureSession();
    if (liveApply !== undefined) (supervisor as any).opts.liveApply = liveApply;
    return supervisor.handleCommand(command);
  });

  // Apply a plan that was previewed/confirmed by the user. The plan is
  // re-validated against the strict schema before execution.
  ipcMain.handle(channels.assistantApplyPlan, async (_e, input) => {
    const v = validateActionPlan(input);
    if (!v.ok || !v.plan) return { status: 'error', message: v.errors.join('; ') };
    const { supervisor } = ensureSession();
    return supervisor.applyPlan(v.plan);
  });

  ipcMain.handle(channels.assistantUndo, async () => {
    const { supervisor } = ensureSession();
    const h = supervisor.historyManager;
    if (!h || !h.canUndo()) return { ok: false, error: 'Nothing to undo' };
    const cp = h.undo();
    return revert(cp?.name);
  });

  ipcMain.handle(channels.assistantRedo, async () => {
    const { supervisor } = ensureSession();
    const h = supervisor.historyManager;
    if (!h || !h.canRedo()) return { ok: false, error: 'Nothing to redo' };
    const cp = h.redo();
    return revert(cp?.name);
  });

  ipcMain.handle(channels.assistantRestoreOriginal, async () => {
    // Restores to the earliest assistant snapshot in this session.
    const { supervisor } = ensureSession();
    const first = supervisor.historyManager?.history()[0];
    if (!first) return { ok: false, error: 'No assistant checkpoints in this session' };
    return revert(first.name);
  });

  ipcMain.handle(channels.assistantSaveVersion, async () => {
    const dir = join(baseFolder(), 'Outputs');
    await mkdir(dir, { recursive: true });
    const dest = join(dir, versionName(++versionCounter));
    const outputDir = join(baseFolder(), 'Jobs', `assist-save-${randomUUID()}`, 'output');
    await mkdir(outputDir, { recursive: true });
    try {
      const { raw } = await runJsx<any>({ outputDir, jsxPath: join(outputDir, 'save.jsx'), jsxSource: emitSaveVersion(outputDir, dest) });
      return raw?.success ? { ok: true, path: raw.path } : { ok: false, error: raw?.details ?? 'save failed' };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });

  ipcMain.handle(channels.assistantSearchAssets, async (_e, input) => {
    const { query } = assistantSearchSchema.parse(input);
    try { return { ok: true, result: await scout(query, scoutConfig()) }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });

  ipcMain.handle(channels.assistantDownloadAsset, async (_e, input) => {
    const { url, source, license } = assistantDownloadSchema.parse(input);
    const destDir = await assetsDir();
    const allowedHosts = ['openverse.org', 'api.openverse.org', 'images.pexels.com', 'pexels.com', 'wikimedia.org', 'upload.wikimedia.org', 'flickr.com', 'staticflickr.com'];
    return downloadAsset({ url, destDir, source, license, allowedHosts });
  });

  // Place a downloaded/validated image as the new background (behind content,
  // cover-fit, previous background hidden not deleted), with checkpoint + preview.
  ipcMain.handle(channels.assistantReplaceBackground, async (_e, input) => {
    const { assetPath, fit } = assistantReplaceBackgroundSchema.parse(input);
    const { supervisor } = ensureSession();
    const name = checkpointName('replace background', [{ type: 'replaceBackground', assetPath, fit: fit ?? 'cover' }]);
    const result = await executeBackgroundReplacement({ assetPath, fit, checkpointName: name, previewPng: true });
    if (result.success) supervisor.historyManager?.push(supervisor.historyManager.makeCheckpoint('replace background', [{ type: 'replaceBackground', assetPath, fit: fit ?? 'cover' }], result.modifiedLayerIds));
    return result;
  });

  log('INFO', 'design-assistant.ipc.registered');
}

async function revert(snapshotName?: string): Promise<{ ok: boolean; error?: string }> {
  if (!snapshotName) return { ok: false, error: 'No checkpoint' };
  const outputDir = join(baseFolder(), 'Jobs', `assist-revert-${randomUUID()}`, 'output');
  await mkdir(outputDir, { recursive: true });
  try {
    const { raw } = await runJsx<any>({ outputDir, jsxPath: join(outputDir, 'revert.jsx'), jsxSource: emitRevertToSnapshot(outputDir, snapshotName) });
    return raw?.success ? { ok: true } : { ok: false, error: raw?.details ?? 'revert failed' };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
