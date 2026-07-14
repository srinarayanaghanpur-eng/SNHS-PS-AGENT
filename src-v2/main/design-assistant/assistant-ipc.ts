// Design Assistant IPC registration.
//
// Additive IPC surface for the Live Design Assistant. All inputs are validated
// with zod before use; no arbitrary JSX or shell is accepted from the renderer.
// This wires the renderer to the supervisor, asset scout/downloader, history
// and version services, reusing existing storage/transport.

import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { z } from 'zod';
import { channels, assistantCommandSchema, assistantQuickOperationSchema, assistantSearchSchema, assistantDownloadSchema, assistantReplaceBackgroundSchema } from '../../shared/ipc';
import { getStoragePaths } from '../storage';
import { log } from '../logger';
import { photoshopBridge } from '../photoshopBridge';
import { CreativeSupervisor } from './creative-supervisor';
import { SessionStore } from './assistant-session-store';
import { readSceneGraph } from './photoshop-state-reader';
import { findLayer } from './document-analyzer';
import { parseCommand } from './command-interpreter';
import { scout, type ScoutConfig } from './asset-scout';
import { downloadAsset } from './asset-downloader';
import { executeBackgroundReplacement } from './photoshop-command-executor';
import { checkpointName } from './history-manager';
import { validateActionPlan } from './execution-planner';

let session: SessionStore | null = null;
let supervisor: CreativeSupervisor | null = null;

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
  const dir = getStoragePaths().getAssistantDownloadsDirectory();
  await mkdir(dir, { recursive: true });
  return dir;
}

function scoutConfig(): ScoutConfig {
  return {
    libraryDirs: [getStoragePaths().getAssetsDirectory()],
    approvedDirs: [getStoragePaths().getApprovedLibraryDirectory()],
    pexelsApiKey: config().pexelsApiKey,
    allowBrowserFallback: true,
    max: 12,
  };
}

export function registerAssistantIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(channels.assistantReadState, async () => {
    const operation = 'assistantReadState';
    const photoshop = await photoshopBridge.getPhotoshopStatus();
    if (!photoshop.success) return { ...photoshop, operation };
    if (!photoshop.data?.running) {
      return { success: true, operation, message: 'Photoshop is not running.', data: { state: 'not_running', photoshop: photoshop.data } };
    }
    try {
      const scene = await readSceneGraph();
      const layer = scene.activeLayerId == null ? null : findLayer(scene, scene.activeLayerId);
      return {
        success: true,
        operation,
        message: layer ? `Selected layer: ${layer.name}` : `Active document: ${scene.document.name}`,
        data: { state: layer ? 'ready' : 'no_layer', photoshop: photoshop.data, document: scene.document, layer, scene },
      };
    } catch (error) {
      const technicalDetails = error instanceof Error ? error.message : String(error);
      if (technicalDetails.includes('NO_DOCUMENT_OPEN')) {
        return { success: true, operation, message: 'No Photoshop document is open.', data: { state: 'no_document', photoshop: photoshop.data } };
      }
      return { success: false, operation, message: 'Photoshop state could not be read.', errorCode: 'PHOTOSHOP_STATE_READ_FAILED', technicalDetails };
    }
  });

  ipcMain.handle(channels.assistantReadActiveLayer, async () => photoshopBridge.getSelectedLayer());
  ipcMain.handle(channels.photoshopStatus, async () => photoshopBridge.getPhotoshopStatus());
  ipcMain.handle(channels.photoshopLaunch, async () => photoshopBridge.launchPhotoshop());

  ipcMain.handle(channels.assistantSelectPsd, async () => {
    const owner = getMainWindow();
    const picked = owner
      ? await dialog.showOpenDialog(owner, { properties: ['openFile'], filters: [{ name: 'Photoshop Documents', extensions: ['psd'] }] })
      : await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Photoshop Documents', extensions: ['psd'] }] });
    if (picked.canceled || !picked.filePaths[0]) {
      return { success: false, operation: 'openDocument', message: 'PSD selection was cancelled.', errorCode: 'PSD_SELECTION_CANCELLED' };
    }
    return photoshopBridge.openDocument(picked.filePaths[0]);
  });

  ipcMain.handle(channels.assistantOpenRecentPsd, async () => {
    const recent = await findMostRecentPsd();
    if (!recent) return { success: false, operation: 'openDocument', message: 'No recent PSD is available.', errorCode: 'NO_RECENT_PSD' };
    return photoshopBridge.openDocument(recent);
  });

  ipcMain.handle(channels.assistantQuickOperation, async (_e, input) => {
    const parsed = assistantQuickOperationSchema.parse(input);
    switch (parsed.operation) {
      case 'move': return photoshopBridge.moveSelectedLayer(parsed.deltaX, parsed.deltaY);
      case 'resize': return photoshopBridge.resizeSelectedLayer(parsed.scalePercent);
      case 'centre': return photoshopBridge.centreSelectedLayer(parsed.horizontal, parsed.vertical);
      case 'setText': return photoshopBridge.setSelectedTextLayerContent(parsed.text);
      case 'hide': return photoshopBridge.hideSelectedLayer();
      case 'show': return photoshopBridge.showSelectedLayer();
      case 'lock': return photoshopBridge.lockSelectedLayer();
      case 'unlock': return photoshopBridge.unlockSelectedLayer();
    }
  });

  ipcMain.handle(channels.assistantParseCommand, async (_e, input) => {
    const { command } = assistantCommandSchema.parse(input);
    const controlled = controlledCommand(command);
    if (!controlled) return { success: false, operation: 'parseCommand', message: 'This command is not supported yet.', errorCode: 'UNSUPPORTED_COMMAND' };
    return { success: true, operation: 'parseCommand', message: `Parsed operation: ${controlled.label}`, data: controlled };
  });

  ipcMain.handle(channels.assistantCommand, async (_e, input) => {
    const { command } = assistantCommandSchema.parse(input);
    const controlled = controlledCommand(command);
    if (!controlled) return { success: false, operation: 'executeCommand', message: 'This command is not supported yet.', errorCode: 'UNSUPPORTED_COMMAND' };
    if (controlled.special === 'save') return photoshopBridge.saveNewVersion();
    if (controlled.special === 'undo') return photoshopBridge.undo();
    if (controlled.special === 'redo') return photoshopBridge.redo();
    const { supervisor } = ensureSession();
    (supervisor as any).opts.liveApply = true;
    const outcome = await supervisor.handleCommand(command);
    if (outcome.status === 'applied') {
      return { success: true, operation: 'executeCommand', message: 'Command applied in Photoshop.', data: { parsedOperation: controlled, outcome } };
    }
    return {
      success: false,
      operation: 'executeCommand',
      message: outcome.message || outcome.warning || 'Photoshop command failed.',
      errorCode: outcome.status === 'needs_selection' ? 'NO_LAYER_SELECTED' : outcome.status === 'needs_confirmation' ? 'CONFIRMATION_REQUIRED' : 'PS_OPERATION_FAILED',
      technicalDetails: outcome.result?.error,
      data: { parsedOperation: controlled, outcome },
    };
  });

  // Apply a plan that was previewed/confirmed by the user. The plan is
  // re-validated against the strict schema before execution.
  ipcMain.handle(channels.assistantApplyPlan, async (_e, input) => {
    const v = validateActionPlan(input);
    if (!v.ok || !v.plan) return { status: 'error', message: v.errors.join('; ') };
    const { supervisor } = ensureSession();
    return supervisor.applyPlan(v.plan);
  });

  ipcMain.handle(channels.assistantUndo, async () => photoshopBridge.undo());
  ipcMain.handle(channels.assistantRedo, async () => photoshopBridge.redo());

  ipcMain.handle(channels.assistantRestoreOriginal, async () => {
    // Restores to the earliest assistant snapshot in this session.
    const { supervisor } = ensureSession();
    const first = supervisor.historyManager?.history()[0];
    if (!first) return { success: false, operation: 'restoreOriginal', message: 'No assistant checkpoint is available.', errorCode: 'NO_ASSISTANT_CHECKPOINT' };
    return { success: false, operation: 'restoreOriginal', message: 'Restore original is not supported in this repaired workflow.', errorCode: 'UNSUPPORTED_COMMAND' };
  });

  ipcMain.handle(channels.assistantSaveVersion, async () => photoshopBridge.saveNewVersion());
  ipcMain.handle(channels.assistantExportPng, async () => photoshopBridge.exportPng());

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

const CONTROLLED_TYPES = new Set(['translate', 'scale', 'align', 'setVisibility', 'setLock', 'replaceText']);

function controlledCommand(command: string): { label: string; operations: unknown[]; special?: 'save' | 'undo' | 'redo' } | null {
  if (/\bsave\s+(?:a\s+)?new\s+version\b/i.test(command)) return { label: 'saveDocumentAs', operations: [], special: 'save' };
  if (/^\s*undo\b/i.test(command)) return { label: 'undo', operations: [], special: 'undo' };
  if (/^\s*redo\b/i.test(command)) return { label: 'redo', operations: [], special: 'redo' };
  const parsed = parseCommand(command);
  if (parsed.unresolved || parsed.operations.length === 0 || parsed.operations.some((operation) => !CONTROLLED_TYPES.has(operation.type))) return null;
  return { label: parsed.operations.map((operation) => operation.type).join(' + '), operations: parsed.operations };
}

async function findMostRecentPsd(): Promise<string | null> {
  const jobsDir = getStoragePaths().getJobsDirectory();
  const records: { path: string; updatedAt: string }[] = [];
  const entries = await readdir(jobsDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const meta = JSON.parse(await readFile(join(jobsDir, entry.name, 'meta.json'), 'utf8')) as { psdPath?: string; updatedAt?: string; createdAt?: string };
      if (meta.psdPath) records.push({ path: meta.psdPath, updatedAt: meta.updatedAt || meta.createdAt || '' });
    } catch { /* incomplete jobs are ignored */ }
  }
  records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return records[0]?.path ?? null;
}
