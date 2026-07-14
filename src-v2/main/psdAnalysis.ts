import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import { atomicJson, createJobWorkspace } from './storage';

const layerSchema: z.ZodType<any> = z.lazy(() => z.object({
  id: z.number(), name: z.string(), type: z.string(), parentPath: z.string(), depth: z.number(),
  bounds: z.object({ left: z.number(), top: z.number(), right: z.number(), bottom: z.number() }).nullable(),
  visible: z.boolean(), locked: z.boolean(), opacity: z.number(), blendMode: z.string(),
  text: z.string().nullable(), smartObject: z.boolean(), clipping: z.boolean(), mask: z.boolean(),
  children: z.array(layerSchema),
}));

const resultSchema = z.object({
  success: z.literal(true), stage: z.literal('completed'),
  document: z.object({ name: z.string(), width: z.number(), height: z.number(), resolution: z.number() }),
  layers: z.array(layerSchema),
});

interface DocumentGeometry { width: number; height: number }

function dateLikeText(value: string): boolean {
  const text = value.trim();
  return /\b(?:0?[1-9]|[12]\d|3[01])[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:19|20)\d{2}\b/.test(text)
    || /\b(?:19|20)\d{2}[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:0?[1-9]|[12]\d|3[01])\b/.test(text)
    || /\b(?:0?[1-9]|[12]\d|3[01])\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(?:19|20)\d{2}\b/i.test(text);
}

export function classifyPsdLayer(item: any, doc: DocumentGeometry): any {
  const name = String(item.name || '').toLowerCase();
  const text = String(item.text || '').trim();
  const lowerText = text.toLowerCase();
  const bounds = item.bounds;
  const width = bounds ? Math.max(0, bounds.right - bounds.left) : 0;
  const height = bounds ? Math.max(0, bounds.bottom - bounds.top) : 0;
  const areaRatio = doc.width && doc.height ? (width * height) / (doc.width * doc.height) : 0;
  const centerY = bounds ? (bounds.top + bounds.bottom) / 2 / doc.height : 0.5;
  const centerX = bounds ? (bounds.left + bounds.right) / 2 / doc.width : 0.5;
  const isText = item.type === 'text' && Boolean(text);
  const isImage = item.smartObject || item.type === 'pixel';

  let probableRole = 'unknown';
  let confidence = 20;

  if (isText && dateLikeText(text)) {
    probableRole = 'date'; confidence = 94;
  } else if (isText && (centerY > 0.88 || /footer|phone|contact|powered by|curriculum/.test(`${name} ${lowerText}`))) {
    probableRole = 'footer'; confidence = 90;
  } else if (isText && /school|academy|college|vidyalaya/.test(lowerText)) {
    probableRole = 'schoolName'; confidence = centerY < 0.28 ? 91 : 72;
  } else if (isText && /subtitle|subheadline/.test(name)) {
    probableRole = 'subheadline'; confidence = 86;
  } else if (isText && centerY < 0.36 && (height > doc.height * 0.022 || /title|headline/.test(name))) {
    probableRole = 'headline'; confidence = 86;
  } else if (isText && /address/.test(name)) {
    probableRole = 'headerText'; confidence = 78;
  } else if (isText) {
    probableRole = 'bodyText'; confidence = 64;
  } else if (isImage && /logo|emblem|crest/.test(name) && areaRatio < 0.12 && (centerY < 0.35 || centerY > 0.78)) {
    probableRole = 'logo'; confidence = 92;
  } else if (isImage && areaRatio > 0.22) {
    probableRole = centerY > 0.82 ? 'background' : 'mainPhoto'; confidence = 72;
  } else if (isImage && (item.mask || item.clipping) && areaRatio > 0.01) {
    probableRole = 'photoPlaceholder'; confidence = 76;
  } else if (isImage && !/whatsapp image|img[_ -]?\d+|dsc[_ -]?\d+/.test(name) && areaRatio > 0.015) {
    probableRole = centerX < 0.5 ? 'supportingPhoto' : 'supportingPhoto'; confidence = 58;
  } else if (item.type === 'group' && /footer/.test(name)) {
    probableRole = 'footerGroup'; confidence = 82;
  } else if (item.type === 'group' && /background/.test(name)) {
    probableRole = 'backgroundGroup'; confidence = 82;
  }

  return {
    ...item, probableRole, confidence,
    children: item.children.map((child: any) => classifyPsdLayer(child, doc)),
  };
}

export async function analyzeActivePsd() {
  const jobId = `analysis-${randomUUID()}`;
  const workspace = await createJobWorkspace(jobId);
  const dir = workspace.root;
  const output = workspace.output;
  await atomicJson(join(dir, 'job.json'), { schemaVersion: 1, jobId, type: 'active-psd-analysis', createdAt: new Date().toISOString() });

  const source = app.isPackaged
    ? join(process.resourcesPath, 'photoshop', 'analyze-active-document.jsx')
    : join(app.getAppPath(), '..', 'photoshop', 'analyze-active-document.jsx');
  const jsx = join(dir, 'analyze.jsx');
  const code = (await readFile(source, 'utf8')).split('__SNHS_OUTPUT__').join(output.replace(/\\/g, '/'));
  await writeFile(jsx, code, 'utf8');
  const vbs = app.isPackaged
    ? join(process.resourcesPath, 'photoshop', 'smoke-test-dojavascript.vbs')
    : join(app.getAppPath(), '..', 'photoshop', 'smoke-test-dojavascript.vbs');

  await new Promise<void>((resolve, reject) => {
    const child = spawn('cscript.exe', ['//Nologo', vbs, jsx], { shell: false, windowsHide: true, env: { ...process.env, SNHS_SMOKE_OUTPUT: output } });
    let transportLog = '';
    child.stdout.on('data', (value) => { transportLog += value; });
    child.stderr.on('data', (value) => { transportLog += value; });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`LAYER_ANALYSIS_TIMEOUT ${transportLog}`)); }, 120_000);
    child.on('exit', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`LAYER_ANALYSIS_VBS_${code} ${transportLog}`)); });
    child.on('error', reject);
  });

  const resultPath = join(output, 'analysis-result.json');
  const deadline = Date.now() + 30_000;
  let raw = '';
  while (Date.now() < deadline) {
    try { raw = await readFile(resultPath, 'utf8'); break; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  if (!raw) throw new Error('LAYER_ANALYSIS_RESULT_TIMEOUT');
  const parsed = JSON.parse(raw);
  if (!parsed.success) throw new Error(`${parsed.code}: ${parsed.details}`);
  const valid = resultSchema.parse(parsed);
  const final = { ...valid, jobId, layers: valid.layers.map((item) => classifyPsdLayer(item, valid.document)) };
  await atomicJson(join(dir, 'final-result.json'), final);
  return final;
}
