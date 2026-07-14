// Single Photoshop service used by the Daily Prayer vertical slice.
//
// All mutations continue to use the existing Windows COM -> VBS ->
// ExtendScript transport. Renderer input is converted to a small allow-listed
// operation; arbitrary JSX is never accepted over IPC.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, parse } from 'node:path';
import { detectEnvironment, environmentError } from './environment';
import { atomicJson, containedPath, createJobWorkspace, getStoragePaths } from './storage';
import { sanitizeFilename } from './storage/storagePaths.mjs';
import { log } from './logger';
import { executePlan } from './design-assistant/photoshop-command-executor';
import { readActiveLayer, readSceneGraph } from './design-assistant/photoshop-state-reader';
import { runJsx } from './design-assistant/ps-transport';
import type { ActionPlan, Operation, SceneDocument, SceneLayer } from './design-assistant/types';

export interface PhotoshopOperationResult<T = unknown> {
  success: boolean;
  operation: string;
  message: string;
  data?: T;
  errorCode?: string;
  technicalDetails?: string;
}

export interface PhotoshopStatusData {
  available: boolean;
  running: boolean;
  processId?: number;
  windowTitle?: string;
}

interface ControlResult {
  success: boolean;
  details?: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

const NON_ASCII = new RegExp('[\\u0080-\\uffff]', 'g');
const jsString = (value: string): string => JSON.stringify(value).replace(
  NON_ASCII,
  (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
);

function success<T>(operation: string, message: string, data?: T): PhotoshopOperationResult<T> {
  return { success: true, operation, message, ...(data === undefined ? {} : { data }) };
}

function errorCodeOf(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  const known = [
    'PHOTOSHOP_NOT_INSTALLED', 'CSCRIPT_MISSING', 'BRIDGE_SCRIPT_MISSING',
    'PHOTOSHOP_NOT_RUNNING', 'NO_DOCUMENT_OPEN', 'NO_LAYER_SELECTED',
    'LAYER_TYPE_UNSUPPORTED', 'PSD_NOT_FOUND', 'INVALID_PSD_PATH',
    'PATH_OUTSIDE_APP_STORAGE', 'PS_COM_TIMEOUT', 'PS_RESULT_TIMEOUT',
    'PS_RESULT_PARSE_FAILED', 'PS_OPERATION_FAILED', 'NOTHING_TO_UNDO',
    'NOTHING_TO_REDO', 'UNSUPPORTED_COMMAND',
  ];
  return known.find((candidate) => message.includes(candidate))
    ?? message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0]
    ?? 'PHOTOSHOP_OPERATION_FAILED';
}

function failure<T = never>(operation: string, value: unknown, fallback: string): PhotoshopOperationResult<T> {
  const technicalDetails = value instanceof Error ? value.message : String(value);
  const errorCode = errorCodeOf(value);
  log('ERROR', 'photoshop-bridge.failed', { operation, errorCode, technicalDetails });
  return { success: false, operation, message: fallback, errorCode, technicalDetails };
}

function relabelFailure<T>(operation: string, result: PhotoshopOperationResult<unknown>): PhotoshopOperationResult<T> {
  return {
    success: false,
    operation,
    message: result.message,
    errorCode: result.errorCode,
    technicalDetails: result.technicalDetails,
  };
}

function processStatus(): Promise<{ running: boolean; processId?: number; windowTitle?: string }> {
  const script = [
    "$p=Get-Process Photoshop -ErrorAction SilentlyContinue | Select-Object -First 1;",
    "if($p){[Console]::Out.Write(($p.Id.ToString())+'|'+$p.MainWindowTitle)}",
  ].join('');
  return new Promise((resolve) => {
    try {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      let output = '';
      const timer = setTimeout(() => { child.kill(); resolve({ running: false }); }, 5_000);
      child.stdout.on('data', (chunk) => { output += String(chunk); });
      child.on('error', () => { clearTimeout(timer); resolve({ running: false }); });
      child.on('exit', () => {
        clearTimeout(timer);
        const match = output.trim().match(/^(\d+)\|(.*)$/s);
        resolve(match
          ? { running: true, processId: Number(match[1]), windowTitle: match[2] }
          : { running: false });
      });
    } catch { resolve({ running: false }); }
  });
}

function controlJsx(outputDir: string, body: string): string {
  const output = outputDir.replace(/\\/g, '/');
  return `#target photoshop
(function(){
var out=new Folder(${jsString(output)});if(!out.exists)out.create();
var resultFile=new File(out.fsName+'/result.json');var detail='';var data={};
function esc(v){return String(v).replace(/\\\\/g,'\\\\\\\\').replace(/"/g,'\\\\"').replace(/\\r/g,'\\\\r').replace(/\\n/g,'\\\\n');}
function json(v){var i,p;if(v===null)return'null';if(typeof v==='string')return'"'+esc(v)+'"';if(typeof v==='number'||typeof v==='boolean')return String(v);if(v instanceof Array){p=[];for(i=0;i<v.length;i++)p.push(json(v[i]));return'['+p.join(',')+']';}p=[];for(i in v)if(v.hasOwnProperty(i)&&typeof v[i]!=='undefined')p.push(json(i)+':'+json(v[i]));return'{'+p.join(',')+'}';}
function write(v){resultFile.encoding='UTF8';resultFile.open('w');resultFile.write(json(v));resultFile.close();}
function codeFor(message){var m=String(message||'').match(/^([A-Z][A-Z0-9_]{2,})(?::|$)/);return m?m[1]:'PHOTOSHOP_OPERATION_FAILED';}
try{
app.displayDialogs=DialogModes.NO;
${body}
write({success:true,details:detail,data:data});
}catch(e){var message=(e&&e.message)?e.message:String(e);write({success:false,details:message,errorCode:codeFor(message),data:data});}
}());`;
}

async function runControl(operation: string, body: string): Promise<PhotoshopOperationResult<Record<string, unknown>>> {
  const outputDir = (await createJobWorkspace(`ps-${operation}-${randomUUID()}`)).output;
  try {
    const { raw, log: transportLog } = await runJsx<ControlResult>({
      outputDir,
      jsxPath: join(outputDir, `${operation}.jsx`),
      jsxSource: controlJsx(outputDir, body),
    });
    if (!raw?.success) {
      return {
        success: false,
        operation,
        message: raw?.details || `${operation} failed in Photoshop.`,
        errorCode: raw?.errorCode || errorCodeOf(raw?.details),
        technicalDetails: [raw?.details, transportLog].filter(Boolean).join(' | '),
      };
    }
    return success(operation, raw.details || `${operation} completed.`, raw.data ?? {});
  } catch (error) {
    return failure(operation, error, `${operation} could not be completed.`);
  }
}

async function nextVersionPath(directory: string, sourcePath: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  const source = parse(sourcePath || 'Daily-Prayer.psd');
  const stem = sanitizeFilename(source.name.replace(/_v\d+$/i, ''), 'Daily-Prayer');
  const files = await readdir(directory).catch(() => [] as string[]);
  let version = 2;
  while (files.some((name) => name.toLowerCase() === `${stem}_v${String(version).padStart(3, '0')}.psd`.toLowerCase())) version += 1;
  return join(directory, `${stem}_v${String(version).padStart(3, '0')}.psd`);
}

async function defaultExportPath(format: 'png' | 'jpg', documentPath: string): Promise<string> {
  const outputDir = format === 'png'
    ? getStoragePaths().getOutputsPngDirectory()
    : getStoragePaths().getOutputsJpgDirectory();
  await mkdir(outputDir, { recursive: true });
  const stem = sanitizeFilename(parse(documentPath || 'Daily-Prayer').name, 'Daily-Prayer');
  let outputPath = join(outputDir, `${stem}.${format}`);
  let counter = 2;
  while (await access(outputPath).then(() => true, () => false)) {
    outputPath = join(outputDir, `${stem}_${String(counter).padStart(3, '0')}.${format}`);
    counter += 1;
  }
  return outputPath;
}

async function updateRecentEdit(documentPath: string, patch: Record<string, unknown>): Promise<void> {
  const jobs = getStoragePaths().getJobsDirectory();
  const entries = await readdir(jobs, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = join(jobs, entry.name, 'meta.json');
    try {
      const meta = JSON.parse(await readFile(metaPath, 'utf8')) as Record<string, unknown>;
      const metaPsd = String(meta.psdPath || '');
      const lineage = (value: string) => parse(value).name.replace(/_v\d+$/i, '').toLowerCase();
      const exactMatch = metaPsd.toLowerCase() === documentPath.toLowerCase();
      const versionMatch = Boolean(metaPsd && documentPath && lineage(metaPsd) === lineage(documentPath));
      if (!exactMatch && !versionMatch) continue;
      await atomicJson(metaPath, { ...meta, ...patch, updatedAt: new Date().toISOString() });
      return;
    } catch { /* incomplete and non-poster jobs are ignored */ }
  }
}

export class PhotoshopBridge {
  async checkPhotoshopAvailable(): Promise<PhotoshopOperationResult<PhotoshopStatusData>> {
    const operation = 'checkPhotoshopAvailable';
    try {
      const environment = await detectEnvironment();
      const running = await processStatus();
      const environmentFailure = environmentError(environment);
      if (environmentFailure) return failure(operation, environmentFailure, 'Photoshop automation is unavailable.');
      return success(operation, 'Photoshop automation is available.', { available: true, ...running });
    } catch (error) { return failure(operation, error, 'Photoshop availability could not be checked.'); }
  }

  async getPhotoshopStatus(): Promise<PhotoshopOperationResult<PhotoshopStatusData>> {
    const operation = 'getPhotoshopStatus';
    const available = await this.checkPhotoshopAvailable();
    if (!available.success || !available.data) return { ...available, operation };
    return success(operation, available.data.running ? 'Photoshop is running.' : 'Photoshop is not running.', available.data);
  }

  async launchPhotoshop(): Promise<PhotoshopOperationResult<PhotoshopStatusData>> {
    const operation = 'launchPhotoshop';
    const available = await this.checkPhotoshopAvailable();
    if (!available.success) return { ...available, operation };
    const launch = await runControl(operation, "app.visible=true;detail='Photoshop launched.';data={running:true};");
    if (!launch.success) return relabelFailure(operation, launch);
    const status = await processStatus();
    return success(operation, 'Photoshop launched.', { available: true, ...status });
  }

  async getActiveDocument(): Promise<PhotoshopOperationResult<SceneDocument>> {
    const operation = 'getActiveDocument';
    const status = await this.getPhotoshopStatus();
    if (!status.success) return relabelFailure(operation, status);
    if (!status.data?.running) return failure(operation, 'PHOTOSHOP_NOT_RUNNING', 'Photoshop is not running.');
    try {
      const scene = await readSceneGraph();
      return success(operation, `Active document: ${scene.document.name}`, scene.document);
    } catch (error) {
      const code = errorCodeOf(error);
      return failure(operation, error, code === 'NO_DOCUMENT_OPEN' ? 'No Photoshop document is open.' : 'The active Photoshop document could not be read.');
    }
  }

  async getSelectedLayer(): Promise<PhotoshopOperationResult<{ documentName: string; layer: SceneLayer }>> {
    const operation = 'getSelectedLayer';
    const document = await this.getActiveDocument();
    if (!document.success) return relabelFailure(operation, document);
    try {
      const active = await readActiveLayer();
      if (!active.activeLayer) return failure(operation, 'NO_LAYER_SELECTED', 'No Photoshop layer is selected.');
      return success(operation, `Selected layer: ${active.activeLayer.name}`, {
        documentName: active.documentName,
        layer: active.activeLayer,
      });
    } catch (error) { return failure(operation, error, 'The selected Photoshop layer could not be read.'); }
  }

  async openDocument(psdPath: string): Promise<PhotoshopOperationResult<Record<string, unknown>>> {
    const operation = 'openDocument';
    if (extname(psdPath).toLowerCase() !== '.psd') return failure(operation, 'INVALID_PSD_PATH', 'Select a Photoshop PSD file.');
    if (!(await access(psdPath).then(() => true, () => false))) return failure(operation, `PSD_NOT_FOUND: ${psdPath}`, 'The PSD file does not exist.');
    const status = await this.getPhotoshopStatus();
    if (!status.success) return relabelFailure(operation, status);
    if (!status.data?.running) {
      const launch = await this.launchPhotoshop();
      if (!launch.success) return relabelFailure(operation, launch);
    }
    const body = `var f=new File(${jsString(psdPath.replace(/\\/g, '/'))});if(!f.exists)throw new Error('PSD_NOT_FOUND: '+f.fsName);var doc=null;for(var i=0;i<app.documents.length;i++){try{if(String(app.documents[i].fullName.fsName).toLowerCase()===String(f.fsName).toLowerCase()){doc=app.documents[i];break;}}catch(ePath){}}if(!doc)doc=app.open(f);app.activeDocument=doc;app.visible=true;detail='Opened '+doc.name;data={path:doc.fullName.fsName,documentName:doc.name,width:Number(doc.width),height:Number(doc.height)};`;
    return runControl(operation, body);
  }

  async createDailyPrayerPoster<T>(create: () => Promise<T>): Promise<PhotoshopOperationResult<T>> {
    const operation = 'createDailyPrayerPoster';
    try {
      const data = await create();
      return success(operation, 'Daily Prayer poster created.', data);
    } catch (error) { return failure(operation, error, 'The Daily Prayer poster could not be created.'); }
  }

  private async editSelected(operation: string, operations: Operation[]): Promise<PhotoshopOperationResult<Record<string, unknown>>> {
    const selected = await this.getSelectedLayer();
    if (!selected.success || !selected.data) return { ...selected, operation } as PhotoshopOperationResult<Record<string, unknown>>;
    const before = selected.data.layer;
    const plan: ActionPlan = {
      command: operation,
      targets: [{ layerId: before.id, confidence: 1 }],
      operations,
      requiresPreview: false,
      source: 'deterministic',
      warnings: [],
    };
    const result = await executePlan(plan, { checkpointName: `Assistant - ${operation} - ${Date.now()}`, previewPng: false, createSnapshot: false });
    if (!result.success) return failure(operation, result.error || 'PS_OPERATION_FAILED', `${operation} failed in Photoshop.`);
    const after = await this.getSelectedLayer();
    if (!after.success || !after.data) return { ...after, operation } as PhotoshopOperationResult<Record<string, unknown>>;
    return success(operation, `${operation} completed.`, {
      before,
      after: after.data.layer,
      modifiedLayerIds: result.modifiedLayerIds,
      checkpointId: result.checkpointId,
    });
  }

  moveSelectedLayer(deltaX: number, deltaY: number) { return this.editSelected('moveSelectedLayer', [{ type: 'translate', x: deltaX, y: deltaY }]); }
  resizeSelectedLayer(scalePercent: number) { return this.editSelected('resizeSelectedLayer', [{ type: 'scale', percentage: scalePercent, maintainAspectRatio: true }]); }
  centreSelectedLayer(horizontal: boolean, vertical: boolean) {
    const operations: Operation[] = [];
    if (horizontal) operations.push({ type: 'align', edge: 'centerH' });
    if (vertical) operations.push({ type: 'align', edge: 'centerV' });
    if (!operations.length) return Promise.resolve(failure('centreSelectedLayer', 'PS_OPERATION_FAILED: no axis selected', 'Choose a horizontal or vertical axis.'));
    return this.editSelected('centreSelectedLayer', operations);
  }
  async setSelectedTextLayerContent(text: string) {
    const selected = await this.getSelectedLayer();
    if (!selected.success || !selected.data) return { ...selected, operation: 'setSelectedTextLayerContent' };
    if (selected.data.layer.type !== 'text') return failure('setSelectedTextLayerContent', 'LAYER_TYPE_UNSUPPORTED: selected layer is not text', 'The selected layer is not an editable text layer.');
    return this.editSelected('setSelectedTextLayerContent', [{ type: 'replaceText', text }]);
  }
  hideSelectedLayer() { return this.editSelected('hideSelectedLayer', [{ type: 'setVisibility', visible: false }]); }
  showSelectedLayer() { return this.editSelected('showSelectedLayer', [{ type: 'setVisibility', visible: true }]); }
  lockSelectedLayer() { return this.editSelected('lockSelectedLayer', [{ type: 'setLock', locked: true }]); }
  unlockSelectedLayer() { return this.editSelected('unlockSelectedLayer', [{ type: 'setLock', locked: false }]); }

  async undo(): Promise<PhotoshopOperationResult<Record<string, unknown>>> {
    return runControl('undo', "if(app.documents.length===0)throw new Error('NO_DOCUMENT_OPEN');var doc=app.activeDocument;var states=doc.historyStates;var current=doc.activeHistoryState;var index=-1;for(var i=0;i<states.length;i++){if(states[i]===current){index=i;break;}}if(index<=0)throw new Error('NOTHING_TO_UNDO');var target=states[index-1];doc.activeHistoryState=target;detail='Undo completed.';data={documentName:doc.name,layerName:doc.activeLayer.name,historyIndex:index-1};");
  }

  async redo(): Promise<PhotoshopOperationResult<Record<string, unknown>>> {
    return runControl('redo', "if(app.documents.length===0)throw new Error('NO_DOCUMENT_OPEN');var doc=app.activeDocument;var states=doc.historyStates;var current=doc.activeHistoryState;var index=-1;for(var i=0;i<states.length;i++){if(states[i]===current){index=i;break;}}if(index<0||index>=states.length-1)throw new Error('NOTHING_TO_REDO');var target=states[index+1];doc.activeHistoryState=target;detail='Redo completed.';data={documentName:doc.name,layerName:doc.activeLayer.name,historyIndex:index+1};");
  }

  async saveDocument(): Promise<PhotoshopOperationResult<Record<string, unknown>>> {
    return runControl('saveDocument', "if(app.documents.length===0)throw new Error('NO_DOCUMENT_OPEN');var doc=app.activeDocument;doc.save();detail='Saved '+doc.name;data={path:doc.fullName.fsName,documentName:doc.name};");
  }

  async saveDocumentAs(outputPath: string): Promise<PhotoshopOperationResult<Record<string, unknown>>> {
    const operation = 'saveDocumentAs';
    if (!containedPath(outputPath)) return failure(operation, `PATH_OUTSIDE_APP_STORAGE: ${outputPath}`, 'PSD versions must be saved in application storage.');
    await mkdir(dirname(outputPath), { recursive: true });
    const body = `if(app.documents.length===0)throw new Error('NO_DOCUMENT_OPEN');var doc=app.activeDocument;var f=new File(${jsString(outputPath.replace(/\\/g, '/'))});var options=new PhotoshopSaveOptions();options.layers=true;doc.saveAs(f,options,false,Extension.LOWERCASE);detail='Saved new version '+doc.name;data={path:doc.fullName.fsName,documentName:doc.name};`;
    return runControl(operation, body);
  }

  async saveNewVersion(): Promise<PhotoshopOperationResult<Record<string, unknown>>> {
    const document = await this.getActiveDocument();
    if (!document.success || !document.data) return { ...document, operation: 'saveDocumentAs' } as PhotoshopOperationResult<Record<string, unknown>>;
    const sourcePath = document.data.path || document.data.name;
    const versionDirectory = document.data.path && containedPath(document.data.path)
      ? dirname(document.data.path)
      : getStoragePaths().getOutputsPsdDirectory();
    const outputPath = await nextVersionPath(versionDirectory, sourcePath);
    const saved = await this.saveDocumentAs(outputPath);
    if (saved.success) await updateRecentEdit(sourcePath, { psdPath: outputPath, status: 'edited' });
    return saved;
  }

  async exportPng(outputPath?: string): Promise<PhotoshopOperationResult<Record<string, unknown>>> {
    const document = await this.getActiveDocument();
    if (!document.success || !document.data) return { ...document, operation: 'exportPng' } as PhotoshopOperationResult<Record<string, unknown>>;
    const destination = outputPath ?? await defaultExportPath('png', document.data.path || document.data.name);
    if (!containedPath(destination)) return failure('exportPng', `PATH_OUTSIDE_APP_STORAGE: ${destination}`, 'PNG exports must be saved in application storage.');
    await mkdir(dirname(destination), { recursive: true });
    const body = `if(app.documents.length===0)throw new Error('NO_DOCUMENT_OPEN');var doc=app.activeDocument;var copy=doc.duplicate('__snhs_png_export__',true);copy.flatten();var f=new File(${jsString(destination.replace(/\\/g, '/'))});var options=new PNGSaveOptions();options.compression=7;copy.saveAs(f,options,true,Extension.LOWERCASE);copy.close(SaveOptions.DONOTSAVECHANGES);detail='Exported PNG';data={path:f.fsName,documentName:doc.name};`;
    const exported = await runControl('exportPng', body);
    if (exported.success) await updateRecentEdit(document.data.path, { pngPath: destination, previewPath: destination, thumbnailPath: destination, status: 'edited' });
    return exported;
  }

  async exportJpg(outputPath?: string): Promise<PhotoshopOperationResult<Record<string, unknown>>> {
    const document = await this.getActiveDocument();
    if (!document.success || !document.data) return { ...document, operation: 'exportJpg' } as PhotoshopOperationResult<Record<string, unknown>>;
    const destination = outputPath ?? await defaultExportPath('jpg', document.data.path || document.data.name);
    if (!containedPath(destination)) return failure('exportJpg', `PATH_OUTSIDE_APP_STORAGE: ${destination}`, 'JPG exports must be saved in application storage.');
    await mkdir(dirname(destination), { recursive: true });
    const body = `if(app.documents.length===0)throw new Error('NO_DOCUMENT_OPEN');var doc=app.activeDocument;var copy=doc.duplicate('__snhs_jpg_export__',true);copy.flatten();var f=new File(${jsString(destination.replace(/\\/g, '/'))});var options=new JPEGSaveOptions();options.quality=11;copy.saveAs(f,options,true,Extension.LOWERCASE);copy.close(SaveOptions.DONOTSAVECHANGES);detail='Exported JPG';data={path:f.fsName,documentName:doc.name};`;
    const exported = await runControl('exportJpg', body);
    if (exported.success) await updateRecentEdit(document.data.path, { jpgPath: destination, status: 'edited' });
    return exported;
  }
}

export const photoshopBridge = new PhotoshopBridge();
