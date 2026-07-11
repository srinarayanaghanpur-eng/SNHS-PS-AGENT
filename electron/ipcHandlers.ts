import { ipcMain, BrowserWindow, dialog, shell, app } from 'electron';
import { join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
  unlinkSync, rmSync, copyFileSync, readdirSync, statSync
} from 'node:fs';

import { detectPhotoshop, executeJsxAsync } from '../backend/photoshop/vbsLauncher';
import * as jsx from '../backend/photoshop/jsxGenerators';
import * as storage from '../backend/storage/fileSystemBridge';

const DATA_DIR = join(homedir(), 'AppData', 'Roaming', 'snhs-poster-agent');

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null) {

  // ─── Dialog ─────────────────────────────────────────────
  ipcMain.handle('dialog:openFile', async (_event, options?: { filters?: { name: string; extensions: string[] }[] }) => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: options?.filters || [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    return { name: filePath.split(/[/\\]/).pop()!, path: filePath };
  });

  ipcMain.handle('dialog:openFolder', async () => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:saveFile', async (_event, options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showSaveDialog(win, {
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  ipcMain.handle('shell:openPath', async (_event, p: string) => shell.openPath(p));

  ipcMain.handle('app:getPath', (_event, name: string) => app.getPath(name as any));

  ipcMain.handle('app:getDataDir', () => DATA_DIR);

  // ─── Photoshop API ──────────────────────────────────────
  ipcMain.handle('ps:detect', async () => detectPhotoshop());

  ipcMain.handle('ps:runJsx', async (_event, { script }: { script: string }) => {
    if (!script) throw new Error('script required');
    try {
      const stdout = await executeJsxAsync(script);
      return { stdout, success: true };
    } catch (err: any) {
      return { stdout: err.stdout || err.message || String(err), success: false };
    }
  });

  ipcMain.handle('ps:openFile', async (_event, { filePath }: { filePath: string }) => {
    if (!filePath) throw new Error('filePath required');
    return runJsxHandler(jsx.jsxOpenDocument(filePath));
  });

  ipcMain.handle('ps:createDocument', async (_event, { width = 1920, height = 1080, resolution = 72, name = 'Untitled' }) => {
    return runJsxHandler(jsx.jsxCreateDocument(width, height, resolution, name));
  });

  ipcMain.handle('ps:closeDocument', async (_event, { docId }: { docId: number }) => {
    return runJsxHandler(jsx.jsxCloseDocument(docId));
  });

  ipcMain.handle('ps:duplicateDocument', async (_event, { docId }: { docId?: number }) => {
    return runJsxHandler(jsx.jsxDuplicateDocument(docId));
  });

  ipcMain.handle('ps:savePsd', async (_event, { filePath, docId }: { filePath: string; docId?: number }) => {
    const prefix = docId ? `var doc = app.documents.getById(${docId});\n` : 'var doc = app.activeDocument;\n';
    return runJsxHandler(prefix + jsx.jsxSavePsd(filePath));
  });

  ipcMain.handle('ps:savePng', async (_event, { filePath, docId }: { filePath: string; docId?: number }) => {
    const prefix = docId ? `var doc = app.documents.getById(${docId});\n` : 'var doc = app.activeDocument;\n';
    return runJsxHandler(prefix + jsx.jsxSavePng(filePath));
  });

  ipcMain.handle('ps:saveJpeg', async (_event, { filePath, quality = 11, docId }: { filePath: string; quality?: number; docId?: number }) => {
    const prefix = docId ? `var doc = app.documents.getById(${docId});\n` : 'var doc = app.activeDocument;\n';
    return runJsxHandler(prefix + jsx.jsxSaveJpeg(filePath, quality));
  });

  ipcMain.handle('ps:addGroup', async (_event, { name }: { name: string }) => {
    return runJsxHandler('var doc = app.activeDocument;\n' + jsx.jsxAddGroup(name));
  });

  ipcMain.handle('ps:addTextLayer', async (_event, { text = '', font = 'Arial', size = 24, color = [0, 0, 0], left = 0, top = 0, alignment }) => {
    return runJsxHandler('var doc = app.activeDocument;\n' + jsx.jsxAddTextLayer(text, font, size, color, left, top, alignment));
  });

  ipcMain.handle('ps:placeImage', async (_event, { imagePath, name }: { imagePath: string; name?: string }) => {
    return runJsxHandler('var doc = app.activeDocument;\n' + jsx.jsxAddImageLayer(imagePath, name || 'Image'));
  });

  ipcMain.handle('ps:setVisibility', async (_event, { layerId, visible }: { layerId: number; visible: boolean }) => {
    return runJsxHandler('var doc = app.activeDocument;\n' + jsx.jsxSetLayerVisibility(layerId, visible));
  });

  ipcMain.handle('ps:setOpacity', async (_event, { layerId, opacity }: { layerId: number; opacity: number }) => {
    return runJsxHandler('var doc = app.activeDocument;\n' + jsx.jsxSetLayerOpacity(layerId, opacity));
  });

  ipcMain.handle('ps:moveLayerIntoGroup', async (_event, { layerId, groupId }: { layerId: number; groupId: number }) => {
    return runJsxHandler('var doc = app.activeDocument;\n' + jsx.jsxMoveLayerIntoGroup(layerId, groupId));
  });

  ipcMain.handle('ps:listFonts', async () => {
    const result = await runJsxHandler(jsx.jsxListFonts());
    const fonts = (result.stdout as string).split('\n').filter((l: string) => l.startsWith('FONT:')).map((l: string) => {
      const parts = l.slice(5).split('|');
      return { name: parts[0], postScriptName: parts[1], family: parts[2], style: parts[3] };
    });
    return { ...result, fonts };
  });

  ipcMain.handle('ps:documentInfo', async (_event, { docId }: { docId?: number }) => {
    return runJsxHandler(jsx.jsxGetDocumentInfo(docId));
  });

  ipcMain.handle('ps:readLayers', async (_event, { docId }: { docId?: number }) => {
    const result = await runJsxHandler(jsx.jsxReadLayerInfo(docId));
    const layers: any[] = [];
    const bounds: any[] = [];
    const texts: any[] = [];
    for (const line of (result.stdout as string).split('\n')) {
      if (line.startsWith('LAYER:')) {
        const parts = line.slice(6).split('|');
        layers.push({ id: Number(parts[0]), path: parts[1], type: parts[2], visible: parts[3] === 'true', opacity: Number(parts[4]), locked: parts[5] === 'true' });
      } else if (line.startsWith('BOUNDS:')) {
        const parts = line.slice(7).split('|');
        bounds.push({ id: Number(parts[0]), left: Number(parts[1]), top: Number(parts[2]), right: Number(parts[3]), bottom: Number(parts[4]) });
      } else if (line.startsWith('TEXT:')) {
        const idx = line.indexOf('|');
        texts.push({ id: Number(line.slice(5, idx)), contents: line.slice(idx + 1) });
      }
    }
    return { ...result, layers, bounds, texts };
  });

  // ─── Storage API ─────────────────────────────────────────
  ipcMain.handle('fs:dataDir', async () => ({ path: storage.dataDir() }));

  ipcMain.handle('fs:readText', async (_event, { path }: { path: string }) => {
    if (!existsSync(path)) throw new Error('File not found');
    return { content: storage.readText(path) };
  });

  ipcMain.handle('fs:writeText', async (_event, { path, content }: { path: string; content: string }) => {
    if (!path) throw new Error('path required');
    const d = dirname(path);
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
    storage.writeText(path, content);
    return { success: true };
  });

  ipcMain.handle('fs:readBinary', async (_event, { path }: { path: string }) => {
    if (!existsSync(path)) throw new Error('File not found');
    const data = storage.readBinary(path);
    return Buffer.from(data).toString('base64');
  });

  ipcMain.handle('fs:writeBinary', async (_event, { path, data }: { path: string; data: string }) => {
    if (!path) throw new Error('path required');
    const bytes = new Uint8Array(Buffer.from(data, 'base64'));
    const d = dirname(path);
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
    storage.writeBinary(path, bytes);
    return { success: true, bytes: bytes.length };
  });

  ipcMain.handle('fs:list', async (_event, { path }: { path?: string }) => {
    return { entries: storage.listDir(path || storage.dataDir()) };
  });

  ipcMain.handle('fs:delete', async (_event, { path }: { path: string }) => {
    storage.deleteEntry(path);
    return { success: true };
  });

  ipcMain.handle('fs:copy', async (_event, { src, dst }: { src: string; dst: string }) => {
    storage.copyEntry(src, dst);
    return { success: true };
  });

  ipcMain.handle('fs:exists', async (_event, { path }: { path: string }) => {
    return { exists: existsSync(path) };
  });

  ipcMain.handle('fs:copyFile', async (_event, { sourcePath, destDir }: { sourcePath: string; destDir: string }) => {
    const name = basename(sourcePath);
    storage.ensureDir(destDir);
    const destPath = join(destDir, name);
    copyFileSync(sourcePath, destPath);
    return { name, path: destPath };
  });
}

async function runJsxHandler(jsxCode: string): Promise<{ stdout: string; success: boolean }> {
  try {
    const stdout = await executeJsxAsync(jsxCode);
    return { stdout, success: true };
  } catch (err: any) {
    return { stdout: err.stdout || err.message || String(err), success: false };
  }
}
