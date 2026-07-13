// Shared Photoshop transport for the Design Assistant.
//
// Reuses the EXACT existing automation pathway (main → cscript.exe →
// smoke-test-dojavascript.vbs → $.evalFile → DoJavaScript → JSX), the same one
// used by photoshopSmoke.ts and psdAnalysis.ts. It writes a JSX file into a job
// output dir, runs it, then polls for a result.json the JSX writes. No new
// transport is introduced; this only factors the pattern so the assistant does
// not duplicate or fork it.

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { bridgeVbsPath } from '../environment';
import { log } from '../logger';

export interface RunJsxOptions {
  outputDir: string;        // must exist / be creatable; JSX writes result.json here
  jsxPath: string;          // where to write the generated JSX
  jsxSource: string;        // full JSX text
  resultFileName?: string;  // default result.json
  vbsTimeoutMs?: number;    // default 120s
  resultTimeoutMs?: number; // default 30s
}

// Resolve a bundled photoshop resource in both dev and packaged builds,
// mirroring resource() in photoshopSmoke.ts.
export function photoshopResource(relative: string): string {
  return app.isPackaged ? join(process.resourcesPath, 'photoshop', relative) : join(app.getAppPath(), '..', 'photoshop', relative);
}

export interface RunJsxResult<T = unknown> { raw: T; log: string }

export async function runJsx<T = unknown>(opts: RunJsxOptions): Promise<RunJsxResult<T>> {
  const resultName = opts.resultFileName ?? 'result.json';
  const resultPath = join(opts.outputDir, resultName);
  await mkdir(opts.outputDir, { recursive: true });
  await writeFile(opts.jsxPath, opts.jsxSource, 'utf8');

  const vbs = bridgeVbsPath();
  const collected = await new Promise<string>((resolve, reject) => {
    const child = spawn('cscript.exe', ['//Nologo', vbs, opts.jsxPath], {
      shell: false, windowsHide: true,
      env: { ...process.env, SNHS_SMOKE_OUTPUT: opts.outputDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`PS_COM_TIMEOUT ${out}`)); }, opts.vbsTimeoutMs ?? 120_000);
    child.stdout.on('data', (c) => { out += String(c); });
    child.stderr.on('data', (c) => { out += String(c); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('exit', (code) => { clearTimeout(timer); code === 0 ? resolve(out) : reject(new Error(`PS_VBS_EXIT_${code} ${out}`)); });
  });

  const deadline = Date.now() + (opts.resultTimeoutMs ?? 30_000);
  let rawText = '';
  while (Date.now() < deadline) {
    try { rawText = await readFile(resultPath, 'utf8'); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!rawText) throw new Error('PS_RESULT_TIMEOUT');
  let parsed: T;
  try { parsed = JSON.parse(rawText) as T; } catch (e) { throw new Error(`PS_RESULT_PARSE_FAILED ${(e as Error).message}`); }
  log('INFO', 'design-assistant.runJsx', { jsx: opts.jsxPath });
  return { raw: parsed, log: collected };
}
