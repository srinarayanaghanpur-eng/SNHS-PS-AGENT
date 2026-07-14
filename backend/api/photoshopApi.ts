import { IncomingMessage, ServerResponse } from 'node:http';
import { detectPhotosystem, executeJsx, generateJsxDocument, generateJsxTextLayer, executeJsxAsync } from '../photoshop/vbsLauncher';
import { jsxOpenDocument, jsxCreateDocument, jsxCloseDocument, jsxSavePsd, jsxSavePng, jsxSaveJpeg, jsxAddGroup, jsxAddTextLayer, jsxAddImageLayer, jsxSetLayerVisibility, jsxSetLayerOpacity, jsxMoveLayerIntoGroup, jsxListFonts, jsxGetDocumentInfo, jsxDuplicateDocument, jsxReadLayerInfo } from '../photoshop/jsxGenerators';
import { readJson, writeText } from '../storage/fileSystemBridge';
import { basename, extname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { createStoragePaths, sanitizeFilename } from '../../src-v2/main/storage/storagePaths.mjs';

const runtime = createStoragePaths();
function exportPath(requested: string | undefined, kind: 'psd' | 'png' | 'jpg'): string {
  const extension = kind === 'jpg' ? '.jpg' : `.${kind}`;
  const rawName = requested ? basename(requested, extname(requested)) : `SNHS_export_${Date.now()}`;
  const stem = sanitizeFilename(rawName, `SNHS_export_${Date.now()}`);
  const directory = kind === 'psd' ? runtime.psd : kind === 'png' ? runtime.png : runtime.jpg;
  let candidate = join(directory, `${stem}${extension}`); let version = 1;
  while (existsSync(candidate)) candidate = join(directory, `${stem}_${String(version++).padStart(3, '0')}${extension}`);
  return candidate;
}

async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => body += chunk.toString());
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function json(res: ServerResponse, data: any, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function runJsx(jsx: string): Promise<{ stdout: string; success: boolean }> {
  try {
    const stdout = await executeJsxAsync(jsx);
    return { stdout, success: true };
  } catch (err: any) {
    return { stdout: err.stdout || err.message || String(err), success: false };
  }
}

export async function handlePhotoshopApi(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
  if (!path.startsWith('/api/ps/')) return false;
  const endpoint = path.slice('/api/ps/'.length);
  const body = await parseBody(req);

  switch (endpoint) {
    case 'detect': {
      const info = detectPhotoshop();
      json(res, info);
      return true;
    }
    case 'open-file': {
      const { filePath } = body;
      if (!filePath) { json(res, { error: 'filePath required' }, 400); return true; }
      const jsx = jsxOpenDocument(filePath);
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'create-document': {
      const { width = 1920, height = 1080, resolution = 72, name = 'Untitled' } = body;
      const jsx = jsxCreateDocument(width, height, resolution, name);
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'close-document': {
      const { docId } = body;
      const jsx = jsxCloseDocument(docId || 0);
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'duplicate-document': {
      const { docId } = body;
      const jsx = jsxDuplicateDocument(docId);
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'save-psd': {
      const { filePath, docId } = body;
      const jsx = (docId ? `var doc = app.documents.getById(${docId});\n` : 'var doc = app.activeDocument;\n') + jsxSavePsd(exportPath(filePath, 'psd'));
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'save-png': {
      const { filePath, docId } = body;
      const jsx = (docId ? `var doc = app.documents.getById(${docId});\n` : 'var doc = app.activeDocument;\n') + jsxSavePng(exportPath(filePath, 'png'));
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'save-jpeg': {
      const { filePath, quality, docId } = body;
      const jsx = (docId ? `var doc = app.documents.getById(${docId});\n` : 'var doc = app.activeDocument;\n') + jsxSaveJpeg(exportPath(filePath, 'jpg'), quality || 11);
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'add-group': {
      const { name } = body;
      const jsx = 'var doc = app.activeDocument;\n' + jsxAddGroup(name);
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'add-text-layer': {
      const { text = '', font = 'Arial', size = 24, color = [0, 0, 0], left = 0, top = 0, alignment } = body;
      const jsx = 'var doc = app.activeDocument;\n' + jsxAddTextLayer(text, font, size, color, left, top, alignment);
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'place-image': {
      const { imagePath, name } = body;
      const jsx = 'var doc = app.activeDocument;\n' + jsxAddImageLayer(imagePath, name || 'Image');
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'set-visibility': {
      const { layerId, visible } = body;
      const jsx = 'var doc = app.activeDocument;\n' + jsxSetLayerVisibility(layerId, visible);
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'set-opacity': {
      const { layerId, opacity } = body;
      const jsx = 'var doc = app.activeDocument;\n' + jsxSetLayerOpacity(layerId, opacity);
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'move-layer-into-group': {
      const { layerId, groupId } = body;
      const jsx = 'var doc = app.activeDocument;\n' + jsxMoveLayerIntoGroup(layerId, groupId);
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'list-fonts': {
      const jsx = jsxListFonts();
      const result = await runJsx(jsx);
      const fonts = result.stdout.split('\n').filter(l => l.startsWith('FONT:')).map(l => {
        const parts = l.slice(5).split('|');
        return { name: parts[0], postScriptName: parts[1], family: parts[2], style: parts[3] };
      });
      json(res, { ...result, fonts });
      return true;
    }
    case 'document-info': {
      const { docId } = body;
      const jsx = jsxGetDocumentInfo(docId);
      const result = await runJsx(jsx);
      json(res, result);
      return true;
    }
    case 'read-layers': {
      const { docId } = body;
      const jsx = jsxReadLayerInfo(docId);
      const result = await runJsx(jsx);
      const layers: any[] = [];
      const bounds: any[] = [];
      const texts: any[] = [];
      for (const line of result.stdout.split('\n')) {
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
      json(res, { ...result, layers, bounds, texts });
      return true;
    }
    case 'run-jsx': {
      const { script } = body;
      if (!script) { json(res, { error: 'script required' }, 400); return true; }
      const result = await runJsx(script);
      json(res, result);
      return true;
    }
    default:
      return false;
  }
}
