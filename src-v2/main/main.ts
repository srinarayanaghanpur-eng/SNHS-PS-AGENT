import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { channels, openPathSchema, pickImagesSchema, smokeRequestSchema } from '../shared/ipc';
import { initializeStorage, baseFolder, containedPath } from './storage';
import { getStorageManager } from './storage/storage-manager';
import { validateStorageRoot } from './storage/storage-validator';
import { runPhotoshopSmoke } from './photoshopSmoke';
import { selectAndImportReference, referenceDialogFilters } from './selectReference';
import { posterRequestSchema } from '../shared/ipc';
import { generatePoster } from './posterGenerator';
import { analyzeActivePsd } from './psdAnalysis';
import { installCrashHandlers, log } from './logger';
import { detectEnvironment } from './environment';
import { initProfiles, listProfiles, getProfile, createProfile, updateProfile, deleteProfile, duplicateProfile, setDefaultProfile, getDefaultProfile, importAsset, removeAsset, setAssetCrop, checkMissingAssets } from './brandKit/profileStore';
import { validatePosterRequest } from './brandKit/validatePoster';
import { registerAssistantIpc } from './design-assistant/assistant-ipc';
import { registerGooglePhotosIpc } from './googlePhotos/gp-ipc';
import { listHistory, deleteHistory, getHistoryById } from './historyStore';
import { openAssistantWindow, closeAssistantWindow } from './design-assistant/assistant-window';
import { BRAND_ASSET_KEYS, cropSchema, type BrandAssetKey } from '../shared/brandKit';
import { z } from 'zod';
import { open, stat, readFile, readdir } from 'node:fs/promises';
import { validateImageFile } from './imageValidation';
import { readDimensions } from './googlePhotos/imageMeta';
import { approveRecord, rejectRecord, correctRecord, savePreferencePair, loadRecord, brainStats, listRecordsWithMeta, saveRecord as saveTrainingRecord } from './design/brain/brainStorage';

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1360, height: 900, minWidth: 1000, minHeight: 680, title: 'SNHS SMART POSTER AGENT V2', show: true,
    icon: join(__dirname, '..', 'dist-v2', 'app-icon.png'),
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  await mainWindow.loadFile(join(__dirname, '..', 'dist-v2', 'index.html'));
  const gate = async (label: string, script: string) => {
    try {
      const result = await mainWindow!.webContents.executeJavaScript(script);
      process.stdout.write(`${label}=${JSON.stringify(result)}\n`);
    } catch (error) {
      log('ERROR', 'gate.failed', error);
      process.stdout.write(`${label}=${JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) })}\n`);
    }
    setTimeout(() => app.quit(), 250);
  };
  if (process.argv.includes('--smoke-gate')) { await gate('V2_IPC_SMOKE_RESULT', 'window.posterApi.runPhotoshopSmoke()'); return; }
  if (process.argv.includes('--poster-gate')) {
    // SNHS Daily Prayer Proceedings acceptance payload (README §13): logo, four
    // student photos, birthday section, thought, programme, footer contacts.
    const desktop = 'C:/Users/ADMIN/Desktop';
    const shots = 'C:/Users/ADMIN/Pictures/Screenshots';
    const acceptance = {
      category: 'prayer', headline: 'Daily Prayer Proceedings',
      subheadline: 'A meaningful start to the school day',
      message: 'Our students gathered in unity for prayer, reflection and positive thoughts.',
      details: '11/07/2026', variations: 1, exportPng: true, width: 1080, height: 1350,
      logoPath: `${desktop}/SNHS-PS-AGENT-main/build/icon.png`,
      photos: [
        { path: `${desktop}/Untitled-2 copy.jpg`, name: 'Ravi Kumar', className: '8A' },
        { path: `${shots}/Screenshot 2026-07-10 185402.png`, name: 'Sana Begum', className: '7B' },
        { path: `${shots}/Screenshot 2026-07-11 160012.png`, name: 'Arjun Rao', className: '9C' },
        { path: `${shots}/Screenshot 2026-07-11 180136.png`, name: 'Priya Sharma', className: '6A' },
      ],
      prayer: {
        day: 'Saturday', prayerTitle: 'Asato Ma Sadgamaya',
        thought: 'Discipline is the bridge between goals and accomplishment.',
        news: 'District science fair winners announced this week.',
        pledge: 'India is my country. All Indians are my brothers and sisters.',
        programme: ['Prayer song', 'Pledge', 'Thought of the day', 'News reading', 'Birthday wishes', 'Principal address'],
        birthdays: [{ name: 'Anush', className: '7B' }],
      },
    };
    // --poster-payload <file.json> overrides the default acceptance payload,
    // so packaged builds can be driven through arbitrary end-to-end scenarios.
    const payloadIndex = process.argv.indexOf('--poster-payload');
    let payload: unknown = acceptance;
    if (payloadIndex !== -1 && process.argv[payloadIndex + 1]) {
      payload = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(process.argv[payloadIndex + 1], 'utf8')));
    }
    await gate('V2_POSTER_RESULT', `window.posterApi.generatePoster(${JSON.stringify(payload)})`);
    return;
  }
  if (process.argv.includes('--analysis-gate')) { await gate('V2_ANALYSIS_RESULT', 'window.posterApi.analyzeActivePsd()'); return; }
  // Brand-kit end-to-end gate: seeds a profile with real asset files (no dialog),
  // then generates a Daily Prayer poster through Photoshop. Config JSON path
  // follows --brandkit-e2e. Proves uploaded assets flow into the PSD (§12).
  if (process.argv.includes('--brandkit-e2e')) {
    const cfgIndex = process.argv.indexOf('--brandkit-e2e');
    const cfgPath = process.argv[cfgIndex + 1];
    const out: Record<string, unknown> = {};
    try {
      const fs = await import('node:fs/promises');
      const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf8')) as { assets: Record<string, string>; management?: Record<string, unknown>; branding?: Record<string, unknown>; request?: Record<string, unknown> };
      const profile = await createProfile({ name: 'E2E Brand School', academicYear: '2026–27', phone1: '6300038389', addressLine1: 'Ghanpur (M)', district: 'Jayashankar Bhupalpally District', pin: '506135' });
      if (cfg.branding) await updateProfile(profile.id, { branding: { ...profile.branding, ...cfg.branding } as typeof profile.branding });
      const imported: Record<string, boolean> = {};
      for (const [key, src] of Object.entries(cfg.assets)) {
        try { await importAsset(profile.id, key as BrandAssetKey, { sourcePath: src }); imported[key] = true; }
        catch (e) { imported[key] = false; out[`import_error_${key}`] = e instanceof Error ? e.message : String(e); }
      }
      out.profileId = profile.id; out.imported = imported;
      const reloaded = await getProfile(profile.id);
      out.assetsInProfile = reloaded ? Object.keys(reloaded.assets) : [];
      const request = {
        category: 'prayer', headline: 'Daily Prayer Proceedings', subheadline: 'A meaningful start to the school day',
        message: 'Our students gathered in unity for prayer and reflection.', details: '13/07/2026', exportPng: true,
        variations: 1,
        management: cfg.management ?? { chairman: { show: true, assetKey: 'chairmanPhoto', name: 'Sri K. Rao', designation: 'Chairman', frame: 'circle' } },
        prayer: { day: 'Monday', prayerTitle: 'Asato Ma Sadgamaya', thought: 'Discipline bridges goals and accomplishment.',
          programme: ['Prayer song', 'Pledge', 'Thought of the day', 'Birthday wishes'], birthdays: [{ name: 'Anush', className: '7B' }] },
        ...(cfg.request ?? {}),
        schoolProfileId: profile.id,
      };
      const result = await generatePoster(request, undefined);
      out.result = result;
    } catch (error) {
      out.error = error instanceof Error ? error.message : String(error);
    }
    process.stdout.write(`V2_BRANDKIT_E2E=${JSON.stringify(out)}\n`);
    setTimeout(() => app.quit(), 250);
    return;
  }
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function registerIpc(): void {
  ipcMain.handle(channels.bootstrap, async () => {
    const environment = await detectEnvironment();
    return { appName: 'SNHS SMART POSTER AGENT V2', baseFolder: baseFolder(), photoshopTransport: 'DoJavaScript + $.evalFile', environment };
  });
  ipcMain.handle(channels.smoke, async (_event, input) => { smokeRequestSchema.parse(input); return runPhotoshopSmoke(); });
  ipcMain.handle(channels.importReference, async () => selectAndImportReference(async () => {
    if (!mainWindow) return { canceled: true, filePaths: [] };
    return dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: referenceDialogFilters.map((filter) => ({ ...filter, extensions: [...filter.extensions] })) });
  }, join(baseFolder(), 'Jobs')));
  ipcMain.handle(channels.openPath, async (_event, input) => {
    const { path } = openPathSchema.parse(input);
    if (!containedPath(path)) throw new Error('PATH_OUTSIDE_APP_STORAGE');
    return shell.openPath(path);
  });
  ipcMain.handle(channels.generatePoster, async (event, input) => generatePoster(posterRequestSchema.parse(input), event.sender));
  ipcMain.handle(channels.analyzeActivePsd, async () => analyzeActivePsd());

  // ── Live Design Assistant (additive) ──
  registerAssistantIpc(() => mainWindow);
  // ── Google Photos connector (additive) ──
  registerGooglePhotosIpc();
  ipcMain.handle(channels.assistantOpen, async () => {
    const preload = join(__dirname, 'preload.js');
    const html = join(__dirname, '..', 'dist-v2', 'assistant.html');
    const icon = join(__dirname, '..', 'dist-v2', 'app-icon.png');
    openAssistantWindow(preload, html, icon);
    return { ok: true };
  });
  ipcMain.handle(channels.assistantClose, async () => { closeAssistantWindow(); return { ok: true }; });
  ipcMain.handle(channels.pickImages, async (_event, input) => {
    const { kind } = pickImagesSchema.parse(input);
    if (!mainWindow) return { canceled: true, paths: [] };
    const picked = await dialog.showOpenDialog(mainWindow, {
      properties: kind === 'photos' ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'psd'] }],
    });
    const images = await Promise.all(picked.filePaths.map(async (path) => {
      const check = await validateImageFile(path);
      const info = await stat(path).catch(() => null);
      let width = 0; let height = 0;
      if (check.ok && check.format) {
        const handle = await open(path, 'r').catch(() => null);
        if (handle) {
          try {
            const buffer = Buffer.alloc(64 * 1024);
            const read = await handle.read(buffer, 0, buffer.length, 0);
            ({ width, height } = readDimensions(buffer.subarray(0, read.bytesRead), check.format));
          } finally { await handle.close(); }
        }
      }
      return { path, width, height, bytes: info?.size ?? 0 };
    }));
    return { canceled: picked.canceled, paths: picked.filePaths, images };
  });

  // ── Brand kit / school profiles ──────────────────────────────────────────
  const assetKeySchema = z.enum(BRAND_ASSET_KEYS);
  const idSchema = z.object({ id: z.string().min(1) }).strict();
  ipcMain.handle(channels.profilesList, async () => listProfiles());
  ipcMain.handle(channels.profileGet, async (_e, input) => getProfile(idSchema.parse(input).id));
  ipcMain.handle(channels.profileCreate, async (_e, input) => createProfile(z.object({ patch: z.record(z.string(), z.unknown()) }).parse(input).patch));
  ipcMain.handle(channels.profileUpdate, async (_e, input) => {
    const { id, patch } = z.object({ id: z.string().min(1), patch: z.record(z.string(), z.unknown()) }).parse(input);
    return updateProfile(id, patch);
  });
  ipcMain.handle(channels.profileDelete, async (_e, input) => { await deleteProfile(idSchema.parse(input).id); return { ok: true }; });
  ipcMain.handle(channels.assetImport, async (_e, input) => {
    const { id, key, sourcePath } = z.object({ id: z.string().min(1), key: assetKeySchema, sourcePath: z.string().min(1).optional() }).parse(input);
    if (!mainWindow) throw new Error('NO_WINDOW');
    if (sourcePath) {
      const profile = await importAsset(id, key as BrandAssetKey, { sourcePath });
      return { canceled: false, profile };
    }
    const picked = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
    if (picked.canceled || !picked.filePaths[0]) return { canceled: true };
    const profile = await importAsset(id, key as BrandAssetKey, { sourcePath: picked.filePaths[0] });
    return { canceled: false, profile };
  });
  ipcMain.handle(channels.assetRemove, async (_e, input) => {
    const { id, key } = z.object({ id: z.string().min(1), key: assetKeySchema }).parse(input);
    return removeAsset(id, key as BrandAssetKey);
  });
  ipcMain.handle(channels.assetSetCrop, async (_e, input) => {
    const { id, key, crop } = z.object({ id: z.string().min(1), key: assetKeySchema, crop: cropSchema }).parse(input);
    return setAssetCrop(id, key as BrandAssetKey, crop);
  });
  ipcMain.handle(channels.assetCheckMissing, async (_e, input) => checkMissingAssets(idSchema.parse(input).id));
  ipcMain.handle(channels.profileDuplicate, async (_e, input) => duplicateProfile(idSchema.parse(input).id));
  ipcMain.handle(channels.profileSetDefault, async (_e, input) => { await setDefaultProfile(idSchema.parse(input).id); return { ok: true }; });
  ipcMain.handle(channels.profileGetDefault, async () => getDefaultProfile());
  ipcMain.handle(channels.validatePosterRequest, async (_e, input) => {
    const request = posterRequestSchema.parse(input);
    const profile = request.schoolProfileId ? await getProfile(request.schoolProfileId) : null;
    return validatePosterRequest(request, profile);
  });

  // ── Storage ──
  ipcMain.handle(channels.getStorageSettings, async () => {
    const mgr = await getStorageManager();
    return { root: mgr.getStorageRoot(), usage: await mgr.getStorageUsage() };
  });
  ipcMain.handle(channels.chooseStorageRoot, async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    return { canceled: false, path: result.filePaths[0] };
  });
  ipcMain.handle(channels.validateStorageRoot, async (_e, input) => {
    const { path: dirPath } = z.object({ path: z.string().min(1) }).parse(input);
    return validateStorageRoot(dirPath);
  });
  ipcMain.handle(channels.estimateMigration, async (_e, input) => {
    const { path: newRoot } = z.object({ path: z.string().min(1) }).parse(input);
    const mgr = await getStorageManager();
    return mgr.estimateMigration(newRoot);
  });
  ipcMain.handle(channels.migrateStorage, async (_e, input) => {
    const { path: newRoot, migrateExisting } = z.object({ path: z.string().min(1), migrateExisting: z.boolean().optional() }).parse(input);
    const mgr = await getStorageManager();
    const plan = await mgr.estimateMigration(newRoot);
    if (migrateExisting && !plan.sufficientSpace) {
      return { ok: false, error: 'Insufficient space on target drive.', plan };
    }
    if (migrateExisting && plan.totalFiles > 0) {
      await mgr.setStorageRoot(newRoot, true);
    } else {
      await mgr.setStorageRoot(newRoot, false);
    }
    return { ok: true, plan };
  });
  ipcMain.handle(channels.openStorageRoot, async () => {
    const mgr = await getStorageManager();
    return shell.openPath(mgr.getStorageRoot());
  });
  ipcMain.handle(channels.getStorageUsage, async () => {
    const mgr = await getStorageManager();
    const usage = await mgr.getStorageUsage();
    return usage;
  });
  ipcMain.handle(channels.clearCache, async () => {
    const mgr = await getStorageManager();
    const result = await mgr.clearCache();
    return { filesDeleted: result.filesDeleted, bytesRecovered: result.bytesRecovered };
  });
  ipcMain.handle(channels.clearTemp, async () => {
    const mgr = await getStorageManager();
    const result = await mgr.clearTemp();
    return { filesDeleted: result.filesDeleted, bytesRecovered: result.bytesRecovered };
  });

  // ── Poster Brain (learning system) ──
  ipcMain.handle(channels.brainApprove, async (_e, input) => {
    const { posterId } = z.object({ posterId: z.string() }).parse(input);
    return approveRecord(posterId);
  });
  ipcMain.handle(channels.brainReject, async (_e, input) => {
    const { posterId, reasons, note } = z.object({ posterId: z.string(), reasons: z.array(z.string()), note: z.string() }).parse(input);
    return rejectRecord(posterId, reasons as any, note);
  });
  ipcMain.handle(channels.brainCorrect, async (_e, input) => {
    const { posterId, corrections, note } = z.object({ posterId: z.string(), corrections: z.any(), note: z.string() }).parse(input);
    return correctRecord(posterId, corrections, note);
  });
  ipcMain.handle(channels.brainCompare, async (_e, input) => {
    const { posterAId, posterBId, winner, reason } = z.object({ posterAId: z.string(), posterBId: z.string(), winner: z.enum(['A', 'B', 'none']), reason: z.string() }).parse(input);
    return savePreferencePair({ posterAId, posterBId, winner, reason, createdAt: new Date().toISOString() });
  });
  ipcMain.handle(channels.brainStats, async () => brainStats());
  ipcMain.handle(channels.brainListRecords, async (_e, input) => {
    const { category } = z.object({ category: z.string().optional() }).parse(input || {});
    return listRecordsWithMeta(category);
  });
  ipcMain.handle(channels.brainLoadRecord, async (_e, input) => {
    const { posterId } = z.object({ posterId: z.string() }).parse(input);
    return loadRecord(posterId);
  });
  ipcMain.handle(channels.brainRecordOutput, async (_e, input) => {
    const { posterId, finalPath, visualCritique, qualityGate } = z.object({ posterId: z.string(), finalPath: z.string(), visualCritique: z.number().optional(), qualityGate: z.number().optional() }).parse(input);
    const r = await loadRecord(posterId);
    if (!r) return null;
    r.finalPosterPath = finalPath;
    if (visualCritique !== undefined) r.qualityScores.visualCritique = visualCritique;
    if (qualityGate !== undefined) r.qualityScores.qualityGate = qualityGate;
    r.updatedAt = new Date().toISOString();
    await saveTrainingRecord(r);
    return r;
  });
  // ── Recent Edits ──
  ipcMain.handle(channels.listRecentEdits, async (_e, input) => {
    const { schoolId, limit: maxItems } = z.object({ schoolId: z.string().optional(), limit: z.number().optional() }).parse(input || {});
    const mgr = await getStorageManager();
    const jobsDir = mgr.getPaths().getJobsDirectory();
    const items: any[] = [];
    try {
      const entries = await readdir(jobsDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      for (const jobId of dirs) {
        try {
          const metaPath = join(jobsDir, jobId, 'meta.json');
          const meta = JSON.parse(await readFile(metaPath, 'utf8'));
          if (schoolId && meta.schoolId !== schoolId) continue;
          items.push({
            jobId,
            title: meta.title || 'Untitled',
            schoolId: meta.schoolId || '',
            schoolName: meta.schoolName || '',
            category: meta.category || 'daily-prayer',
            createdAt: meta.createdAt || '',
            updatedAt: meta.updatedAt || meta.createdAt || '',
            status: meta.status || 'draft',
            thumbnailPath: meta.thumbnailPath || null,
            previewPath: meta.previewPath || null,
            psdPath: meta.psdPath || null,
            pngPath: meta.pngPath || null,
            jpgPath: meta.jpgPath || null,
            storageRoot: mgr.getStorageRoot(),
          });
        } catch { }
      }
    } catch { }
    items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return maxItems ? items.slice(0, maxItems) : items;
  });
  ipcMain.handle(channels.loadJobRecord, async (_e, input) => {
    const { jobId } = z.object({ jobId: z.string().min(1) }).parse(input);
    const mgr = await getStorageManager();
    const metaPath = join(mgr.getPaths().getJobDir(jobId), 'meta.json');
    try {
      return JSON.parse(await readFile(metaPath, 'utf8'));
    } catch {
      return null;
    }
  });
  ipcMain.handle(channels.openFileLocation, async (_e, input) => {
    const { filePath } = z.object({ filePath: z.string() }).parse(input);
    return shell.showItemInFolder(filePath);
  });
  // ── History ──
  const historyDeleteSchema = z.object({ id: z.string().min(1), removeFiles: z.boolean() }).strict();
  ipcMain.handle(channels.historyList, async () => listHistory());
  ipcMain.handle(channels.historyDelete, async (_e, input) => {
    const { id, removeFiles } = historyDeleteSchema.parse(input);
    await deleteHistory(id, removeFiles);
    return { ok: true };
  });
  ipcMain.handle(channels.historyDuplicate, async (_e, input) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(input);
    return getHistoryById(id);
  });
  ipcMain.handle(channels.historyRegenerate, async (_e, input) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(input);
    return getHistoryById(id);
  });
}

installCrashHandlers();
// A second GUI instance focuses the first instead of racing it for job storage
// and blocking installer updates. CLI gates are exempt so tests can run while
// the app is open.
const isGateRun = process.argv.some((a) => a.endsWith('-gate'));
if (!isGateRun && !app.requestSingleInstanceLock()) {
  app.quit();
} else if (!isGateRun) {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
}
registerIpc();
app.whenReady().then(async () => {
  await initializeStorage();
  await initProfiles();
  log('INFO', 'app.ready', { packaged: app.isPackaged, version: app.getVersion() });
  await createWindow();
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
